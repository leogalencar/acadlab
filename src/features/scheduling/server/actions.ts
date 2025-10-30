"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ReservationStatus, Role } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/features/shared/types";
import { getSystemRules } from "@/features/system-rules/server/queries";

const MAX_OCCURRENCES = 52;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const cancelReservationSchema = z.object({
  reservationId: z.string().min(1, "Selecione uma reserva válida."),
  reason: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? "")
    .refine((value) => value.length <= 500, {
      message: "A justificativa deve ter no máximo 500 caracteres.",
    }),
  cancelSeries: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

const optionalInputString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

const createReservationSchema = z.object({
  laboratoryId: z.string().min(1, "Selecione um laboratório válido."),
  date: z
    .string()
    .transform((value, ctx) => {
      const normalized = normalizeIsoDate(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Informe uma data válida.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  slotIds: z
    .array(z.string().min(1))
    .min(1, "Selecione pelo menos um horário."),
  occurrences: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return 1;
      }

      const parsed = Number.parseInt(value, 10);

      if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
      }

      return Math.min(parsed, MAX_OCCURRENCES);
    }),
  targetUserId: optionalInputString,
  subject: optionalInputString.refine((value) => !value || value.length <= 160, {
    message: "Use no máximo 160 caracteres para a disciplina/assunto.",
  }),
  academicPeriodId: optionalInputString,
});

export async function createReservationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return {
      status: "error",
      message: "Você precisa estar autenticado para reservar um laboratório.",
    };
  }

  const rawSlotIds = formData
    .getAll("slotIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const parsed = createReservationSchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
    date: formData.get("date"),
    slotIds: rawSlotIds,
    occurrences: formData.get("occurrences"),
    targetUserId: typeof formData.get("targetUserId") === "string"
      ? formData.get("targetUserId")
      : undefined,
    subject: typeof formData.get("subject") === "string"
      ? formData.get("subject")
      : undefined,
    academicPeriodId: typeof formData.get("academicPeriodId") === "string"
      ? formData.get("academicPeriodId")
      : undefined,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar a reserva.";
    return { status: "error", message };
  }

  const systemRules = await getSystemRules();
  const {
    laboratoryId,
    date,
    slotIds,
    targetUserId,
    subject: subjectInput,
    academicPeriodId,
  } = parsed.data;

  const academicPeriod = academicPeriodId
    ? systemRules.academicPeriods.find((period) => period.id === academicPeriodId)
    : undefined;

  if (academicPeriodId && !academicPeriod) {
    return {
      status: "error",
      message: "Período letivo selecionado inválido.",
    };
  }

  if (academicPeriod && session.user.role !== Role.ADMIN) {
    return {
      status: "error",
      message: "Somente administradores podem utilizar períodos letivos completos.",
    };
  }

  let occurrences = parsed.data.occurrences ?? 1;

  if (!academicPeriod && occurrences > 1 && session.user.role === Role.PROFESSOR) {
    occurrences = 1;
  }

  let ownerId = session.user.id;

  if (targetUserId) {
    if (session.user.role === Role.PROFESSOR) {
      return {
        status: "error",
        message: "Você não tem permissão para agendar em nome de outro usuário.",
      };
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, status: "ACTIVE" },
      select: { id: true },
    });

    if (!targetUser) {
      return {
        status: "error",
        message: "Usuário responsável não encontrado ou inativo.",
      };
    }

    ownerId = targetUser.id;
  }

  const reservationSubject = subjectInput ?? null;

  const slots = slotIds
    .map((slotId) => ({
      id: slotId,
      start: new Date(slotId),
    }))
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  if (slots.some((slot) => Number.isNaN(slot.start.getTime()))) {
    return {
      status: "error",
      message: "Horário selecionado inválido. Atualize a página e tente novamente.",
    };
  }

  const isSameDay = slots.every((slot) => slot.start.toISOString().startsWith(`${date}T`));

  if (!isSameDay) {
    return {
      status: "error",
      message: "Todos os horários devem pertencer ao mesmo dia.",
    };
  }

  const uniqueSlots = Array.from(new Set(slots.map((slot) => slot.id)));

  if (uniqueSlots.length !== slots.length) {
    return {
      status: "error",
      message: "Não é possível selecionar o mesmo horário mais de uma vez.",
    };
  }

  const slotDurationMinutes = await inferSlotDurationMinutes(laboratoryId);

  if (!slotDurationMinutes) {
    return {
      status: "error",
      message: "Não foi possível validar os horários da reserva.",
    };
  }

  const reservationStart = slots[0]!.start;
  const reservationEnd = new Date(
    slots[slots.length - 1]!.start.getTime() + slotDurationMinutes * 60_000,
  );

  if (academicPeriod) {
    const periodStart = fromZonedTime(`${academicPeriod.startDate}T00:00:00`, systemRules.timeZone);
    const periodEnd = fromZonedTime(`${academicPeriod.endDate}T23:59:59`, systemRules.timeZone);

    if (reservationStart < periodStart || reservationStart > periodEnd) {
      return {
        status: "error",
        message: "A data selecionada deve estar dentro do período letivo escolhido.",
      };
    }

    const weekMs = 7 * 24 * 60 * 60_000;
    const weeksBetween = Math.floor((periodEnd.getTime() - reservationStart.getTime()) / weekMs);
    occurrences = Math.max(weeksBetween + 1, 1);
  }

  try {
    await prisma.$transaction(async (tx) => {
      let recurrenceId: string | null = null;

      if (occurrences > 1 && session.user.role !== Role.PROFESSOR) {
        const recurrence = await tx.reservationRecurrence.create({
          data: {
            laboratoryId,
            createdById: session.user.id,
            frequency: "WEEKLY",
            interval: 1,
            weekDay: reservationStart.getUTCDay(),
            startDate: reservationStart,
            endDate: new Date(
              reservationEnd.getTime() + (occurrences - 1) * 7 * 24 * 60 * 60_000,
            ),
          },
          select: { id: true },
        });

        recurrenceId = recurrence.id;
      }

      for (let occurrenceIndex = 0; occurrenceIndex < occurrences; occurrenceIndex += 1) {
        const offset = occurrenceIndex * 7 * 24 * 60 * 60_000;
        const occurrenceStart = new Date(reservationStart.getTime() + offset);
        const occurrenceEnd = new Date(reservationEnd.getTime() + offset);

        const hasConflict = await tx.reservation.findFirst({
          where: {
            laboratoryId,
            status: { not: ReservationStatus.CANCELLED },
            startTime: { lt: occurrenceEnd },
            endTime: { gt: occurrenceStart },
          },
          select: { id: true },
        });

        if (hasConflict) {
          throw new ReservationConflictError(occurrenceStart);
        }

        await tx.reservation.create({
          data: {
            laboratoryId,
            createdById: ownerId,
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
            status: ReservationStatus.CONFIRMED,
            recurrenceId: recurrenceId ?? undefined,
            subject: reservationSubject ?? undefined,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof ReservationConflictError) {
      const formatted = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(error.date);

      return {
        status: "error",
        message: "Já existe uma reserva confirmada para " +
          formatted +
          ". Selecione outro horário.",
      };
    }

    console.error("[scheduling] Failed to create reservation", error);
    return {
      status: "error",
      message: "Não foi possível criar a reserva. Tente novamente mais tarde.",
    };
  }

  revalidatePath("/dashboard/scheduling");
  revalidatePath("/dashboard/scheduling/agenda");
  revalidatePath("/dashboard/scheduling/history");

  const successMessage = academicPeriod
    ? "Reserva confirmada para todo o período letivo selecionado."
    : occurrences > 1
      ? "Recorrência criada com sucesso. Todas as reservas foram confirmadas."
      : "Reserva confirmada com sucesso.";

  return { status: "success", message: successMessage };
}

export async function cancelReservationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return {
      status: "error",
      message: "Você precisa estar autenticado para cancelar reservas.",
    };
  }

  const parsed = cancelReservationSchema.safeParse({
    reservationId: (formData.get("reservationId") ?? "").toString(),
    reason: (formData.get("reason") ?? "").toString(),
    cancelSeries: formData.get("cancelSeries") ?? undefined,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível cancelar a reserva.";
    return { status: "error", message };
  }

  const { reservationId, reason, cancelSeries } = parsed.data;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      laboratoryId: true,
      createdById: true,
      status: true,
      recurrenceId: true,
      startTime: true,
    },
  });

  if (!reservation) {
    return {
      status: "error",
      message: "Reserva não encontrada.",
    };
  }

  const canManageAll = session.user.role === Role.ADMIN || session.user.role === Role.TECHNICIAN;
  const isOwner = reservation.createdById === session.user.id;

  if (!canManageAll && !isOwner) {
    return {
      status: "error",
      message: "Você não tem permissão para cancelar esta reserva.",
    };
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    return {
      status: "success",
      message: "Esta reserva já estava cancelada.",
    };
  }

  const cancellationReason = reason && reason.length > 0 ? reason : null;
  const cancelledAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      if (cancelSeries && reservation.recurrenceId) {
        await tx.reservation.updateMany({
          where: {
            recurrenceId: reservation.recurrenceId,
            status: { not: ReservationStatus.CANCELLED },
            startTime: { gte: reservation.startTime },
          },
          data: {
            status: ReservationStatus.CANCELLED,
            cancellationReason,
            cancelledAt,
          },
        });
      } else {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.CANCELLED,
            cancellationReason,
            cancelledAt,
          },
        });
      }
    });
  } catch (error) {
    console.error("[scheduling] Failed to cancel reservation", error);
    return {
      status: "error",
      message: "Não foi possível cancelar a reserva. Tente novamente mais tarde.",
    };
  }

  revalidatePath("/dashboard/scheduling");
  revalidatePath("/dashboard/scheduling/agenda");
  revalidatePath("/dashboard/scheduling/history");

  return {
    status: "success",
    message: cancelSeries && reservation.recurrenceId
      ? "Todas as ocorrências futuras desta recorrência foram canceladas."
      : "Reserva cancelada com sucesso.",
  };
}

class ReservationConflictError extends Error {
  constructor(public readonly date: Date) {
    super("Reservation conflict");
  }
}

async function inferSlotDurationMinutes(laboratoryId: string): Promise<number | null> {
  const latestReservation = await prisma.reservation.findFirst({
    where: { laboratoryId },
    orderBy: { startTime: "desc" },
    select: { startTime: true, endTime: true },
  });

  if (latestReservation) {
    const difference =
      (latestReservation.endTime.getTime() - latestReservation.startTime.getTime()) / 60_000;

    if (Number.isFinite(difference) && difference > 0) {
      return Math.round(difference);
    }
  }

  const systemRules = await getSystemRules();
  const periods = Object.values(systemRules.periods);

  if (periods.length === 0) {
    return null;
  }

  const duration = periods[0]?.classDurationMinutes;
  return typeof duration === "number" && Number.isFinite(duration) ? duration : null;
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (ISO_DATE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (match && ISO_DATE_PATTERN.test(match[1]!)) {
    return match[1]!;
  }

  return null;
}
