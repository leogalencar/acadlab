"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ReservationStatus, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ReservationSlot } from "@/features/scheduling/types";
import {
  buildDailySchedule,
  findNonTeachingRuleForDate,
  getIsoDateInTimeZone,
  getWeekDayInTimeZone,
} from "@/features/scheduling/utils";
import { getReservationsForDay } from "@/features/scheduling/server/queries";
import type { ActionState } from "@/features/shared/types";
import { getSystemRules } from "@/features/system-rules/server/queries";
import type { SerializableSystemRules } from "@/features/system-rules/types";

const MAX_OCCURRENCES = 26;
const CANCEL_REASON_MAX_LENGTH = 500;

const createReservationSchema = z.object({
  laboratoryId: z.string().min(1, "Selecione um laboratório válido."),
  date: z
    .string()
    .regex(/^(\d{4})-(\d{2})-(\d{2})$/, "Informe uma data válida."),
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
});

const cancelReservationSchema = z.object({
  reservationId: z.string().min(1, "Selecione uma reserva válida."),
  reason: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    })
    .refine(
      (value) => !value || value.length <= CANCEL_REASON_MAX_LENGTH,
      `O motivo do cancelamento deve ter no máximo ${CANCEL_REASON_MAX_LENGTH} caracteres.`,
    ),
});

const assignClassPeriodSchema = z.object({
  teacherId: z.string().min(1, "Selecione um professor."),
  laboratoryId: z.string().min(1, "Selecione um laboratório válido."),
  date: z
    .string()
    .regex(/^(\d{4})-(\d{2})-(\d{2})$/, "Informe uma data válida."),
  slotIds: z.array(z.string().min(1)).min(1, "Selecione pelo menos um horário."),
  subject: z
    .string()
    .trim()
    .min(2, "Informe a disciplina ou turma.")
    .max(120, "O nome da disciplina deve ter no máximo 120 caracteres."),
});

type SubjectColumnSupport = {
  reservation: boolean;
  recurrence: boolean;
};

let cachedSubjectColumnSupport: SubjectColumnSupport | null = null;
let lastSubjectColumnInspection = 0;
let warnedAboutMissingSubjectColumns = false;

async function getSubjectColumnSupport(): Promise<SubjectColumnSupport> {
  const now = Date.now();

  if (cachedSubjectColumnSupport && now - lastSubjectColumnInspection < 5 * 60_000) {
    return cachedSubjectColumnSupport;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT LOWER(TABLE_NAME) AS tableName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('Reservation', 'ReservationRecurrence')
        AND COLUMN_NAME = 'subject'
    `;

    const foundTables = new Set(rows.map((row) => row.tableName));

    cachedSubjectColumnSupport = {
      reservation: foundTables.has("reservation"),
      recurrence: foundTables.has("reservationrecurrence"),
    };
    lastSubjectColumnInspection = now;

    if (
      (!cachedSubjectColumnSupport.reservation || !cachedSubjectColumnSupport.recurrence) &&
      !warnedAboutMissingSubjectColumns
    ) {
      console.warn(
        "[scheduling] Subject column not available on all reservation tables. Skipping subject persistence until migrations run.",
      );
      warnedAboutMissingSubjectColumns = true;
    }

    return cachedSubjectColumnSupport;
  } catch (error) {
    console.warn("[scheduling] Failed to inspect subject column support", error);

    cachedSubjectColumnSupport = { reservation: false, recurrence: false };
    lastSubjectColumnInspection = now;

    if (!warnedAboutMissingSubjectColumns) {
      console.warn(
        "[scheduling] Proceeding without subject columns due to inspection failure.",
      );
      warnedAboutMissingSubjectColumns = true;
    }

    return cachedSubjectColumnSupport;
  }
}

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
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar a reserva.";
    return { status: "error", message };
  }

  const { laboratoryId, date, slotIds } = parsed.data;
  let occurrences = parsed.data.occurrences ?? 1;

  if (occurrences > 1 && session.user.role === Role.PROFESSOR) {
    occurrences = 1;
  }

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

  const uniqueSlots = Array.from(new Set(slots.map((slot) => slot.id)));

  if (uniqueSlots.length !== slots.length) {
    return {
      status: "error",
      message: "Não é possível selecionar o mesmo horário mais de uma vez.",
    };
  }

  const systemRules = await getSystemRules();

  const slotsMatchSelectedDay = slots.every((slot) => {
    const slotDate = getIsoDateInTimeZone(slot.start, systemRules.timeZone);
    return slotDate === date;
  });

  if (!slotsMatchSelectedDay) {
    return {
      status: "error",
      message: "Todos os horários devem pertencer ao mesmo dia.",
    };
  }

  const dayReservations = await getReservationsForDay({
    laboratoryId,
    date,
    timeZone: systemRules.timeZone,
  });

  const nonTeachingRule = findNonTeachingRuleForDate(
    date,
    systemRules.nonTeachingDays,
    systemRules.timeZone,
  );

  if (nonTeachingRule) {
    const reason = nonTeachingRule.description?.trim();
    return {
      status: "error",
      message:
        reason && reason.length > 0
          ? `Este dia está marcado como não letivo (${reason}). Agende outra data.`
          : "Este dia está marcado como não letivo. Agende outra data.",
    };
  }

  const schedule = buildDailySchedule({
    date,
    systemRules,
    reservations: dayReservations,
    now: new Date(),
    nonTeachingRule,
  });

  const slotsMap = new Map<string, ReservationSlot>();
  schedule.periods.forEach((period) => {
    period.slots.forEach((slot) => {
      slotsMap.set(slot.id, slot);
    });
  });

  const resolvedSlots = uniqueSlots.map((slotId) => slotsMap.get(slotId));

  if (resolvedSlots.some((slot) => !slot)) {
    return {
      status: "error",
      message: "Um ou mais horários selecionados não estão mais disponíveis.",
    };
  }

  const resolvedSlotEntries = resolvedSlots.map((slot) => slot!);
  const sortedResolvedSlots = [...resolvedSlotEntries].sort(
    (left, right) =>
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  );

  if (resolvedSlotEntries.some((slot) => slot.isOccupied)) {
    return {
      status: "error",
      message: "Um dos horários selecionados ficou indisponível. Atualize a agenda e tente novamente.",
    };
  }

  if (resolvedSlotEntries.some((slot) => slot.isPast)) {
    return {
      status: "error",
      message: "Não é possível reservar horários que já passaram.",
    };
  }

  const selectionSet = new Set(uniqueSlots);
  const firstSlot = sortedResolvedSlots[0]!;
  const lastSlot = sortedResolvedSlots[sortedResolvedSlots.length - 1]!;

  const intermediateSlots = schedule.periods
    .flatMap((period) => period.slots)
    .filter((slot) => {
      if (slot.startTime < firstSlot.startTime) {
        return false;
      }
      if (slot.endTime > lastSlot.endTime) {
        return false;
      }
      return true;
    });

  const missingIntermediate = intermediateSlots.filter((slot) => !selectionSet.has(slot.id));

  if (missingIntermediate.length > 0) {
    return {
      status: "error",
      message: "Selecione todos os horários intermediários entre o início e o fim da reserva.",
    };
  }

  const reservationStart = new Date(firstSlot.startTime);
  const reservationEnd = new Date(lastSlot.endTime);

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
            weekDay: getWeekDayInTimeZone(
              getIsoDateInTimeZone(reservationStart, systemRules.timeZone),
              systemRules.timeZone,
            ),
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

        const occurrenceDateIso = getIsoDateInTimeZone(occurrenceStart, systemRules.timeZone);
        const occurrenceNonTeachingRule = findNonTeachingRuleForDate(
          occurrenceDateIso,
          systemRules.nonTeachingDays,
          systemRules.timeZone,
        );

        if (occurrenceNonTeachingRule) {
          throw new NonTeachingDayError(occurrenceStart, occurrenceNonTeachingRule.description);
        }

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
            createdById: session.user.id,
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
            status: ReservationStatus.CONFIRMED,
            recurrenceId: recurrenceId ?? undefined,
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

    if (error instanceof NonTeachingDayError) {
      const formatted = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: undefined,
      }).format(error.date);

      return {
        status: "error",
        message: error.reason
          ? `${formatted} está marcado como não letivo (${error.reason}). Ajuste a recorrência.`
          : `${formatted} está marcado como não letivo. Ajuste a recorrência.`,
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
  revalidatePath("/dashboard/scheduling/overview");

  const successMessage =
    occurrences > 1
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
      message: "Você precisa estar autenticado para cancelar uma reserva.",
    };
  }

  const parsed = cancelReservationSchema.safeParse({
    reservationId: formData.get("reservationId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar o cancelamento.";
    return { status: "error", message };
  }

  const { reservationId, reason } = parsed.data;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      createdById: true,
      startTime: true,
      endTime: true,
    },
  });

  if (!reservation) {
    return {
      status: "error",
      message: "Reserva não encontrada. Atualize a página e tente novamente.",
    };
  }

  const canCancel =
    session.user.role === Role.ADMIN ||
    session.user.role === Role.TECHNICIAN ||
    reservation.createdById === session.user.id;

  if (!canCancel) {
    return {
      status: "error",
      message: "Você não tem permissão para cancelar esta reserva.",
    };
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    return {
      status: "success",
      message: "Esta reserva já havia sido cancelada anteriormente.",
    };
  }

  const cancellationReason = reason ?? null;

  try {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CANCELLED,
        cancellationReason,
        cancelledAt: new Date(),
      },
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
  revalidatePath("/dashboard/scheduling/overview");

  return {
    status: "success",
    message: "Reserva cancelada com sucesso.",
  };
}

export async function assignClassPeriodReservationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== Role.ADMIN && session.user.role !== Role.TECHNICIAN)
  ) {
    return {
      status: "error",
      message: "Você não tem permissão para agendar períodos letivos.",
    };
  }

  const rawSlotIds = formData
    .getAll("slotIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const parsed = assignClassPeriodSchema.safeParse({
    teacherId: formData.get("teacherId"),
    laboratoryId: formData.get("laboratoryId"),
    date: formData.get("date"),
    subject: formData.get("subject"),
    slotIds: rawSlotIds,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados do agendamento.";
    return { status: "error", message };
  }

  const { teacherId, laboratoryId, date, subject, slotIds } = parsed.data;

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      name: true,
      role: true,
    },
  });

  if (!teacher || teacher.role !== Role.PROFESSOR) {
    return {
      status: "error",
      message: "Selecione um professor válido para o agendamento.",
    };
  }

  const systemRules = await getSystemRules();
  const academicPeriod = resolveAcademicPeriodConfig(systemRules);

  if (!academicPeriod) {
    return {
      status: "error",
      message:
        "Configure o período letivo nas regras do sistema antes de criar um agendamento completo.",
    };
  }

  const uniqueSlots = Array.from(new Set(slotIds));
  const dayReservations = await getReservationsForDay({
    laboratoryId,
    date,
    timeZone: systemRules.timeZone,
  });

  const nonTeachingRule = findNonTeachingRuleForDate(
    date,
    systemRules.nonTeachingDays,
    systemRules.timeZone,
  );

  if (nonTeachingRule) {
    const reason = nonTeachingRule.description?.trim();
    return {
      status: "error",
      message:
        reason && reason.length > 0
          ? `O dia selecionado está marcado como não letivo (${reason}). Escolha outra data inicial.`
          : "O dia selecionado está marcado como não letivo. Escolha outra data inicial.",
    };
  }

  const schedule = buildDailySchedule({
    date,
    systemRules,
    reservations: dayReservations,
    now: new Date(),
    nonTeachingRule,
  });

  const slotMap = new Map<string, ReservationSlot>();
  schedule.periods.forEach((period) => {
    period.slots.forEach((slot) => {
      slotMap.set(slot.id, slot);
    });
  });

  const resolvedSlots = uniqueSlots.map((slotId) => slotMap.get(slotId));

  if (resolvedSlots.some((slot) => !slot)) {
    return {
      status: "error",
      message: "Um ou mais horários selecionados não estão mais disponíveis.",
    };
  }

  const resolvedSlotEntries = resolvedSlots.map((slot) => slot!);
  const sortedResolvedSlots = [...resolvedSlotEntries].sort(
    (left, right) =>
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  );

  if (resolvedSlotEntries.some((slot) => slot.isOccupied)) {
    return {
      status: "error",
      message:
        "Um dos horários selecionados ficou indisponível. Atualize a agenda e tente novamente.",
    };
  }

  if (resolvedSlotEntries.some((slot) => slot.isPast)) {
    return {
      status: "error",
      message: "Não é possível reservar horários que já passaram.",
    };
  }

  const firstSlot = sortedResolvedSlots[0]!;
  const lastSlot = sortedResolvedSlots[sortedResolvedSlots.length - 1]!;

  const intermediateSlots = schedule.periods
    .flatMap((period) => period.slots)
    .filter((slot) => slot.startTime >= firstSlot.startTime && slot.endTime <= lastSlot.endTime);

  const missingIntermediate = intermediateSlots.filter((slot) => !uniqueSlots.includes(slot.id));

  if (missingIntermediate.length > 0) {
    return {
      status: "error",
      message: "Selecione todos os horários intermediários entre o início e o fim da reserva.",
    };
  }

  const subjectColumnSupport = await getSubjectColumnSupport();
  const reservationStart = new Date(firstSlot.startTime);
  const reservationEnd = new Date(lastSlot.endTime);
  const recurrenceWeekDay = getWeekDayInTimeZone(date, systemRules.timeZone);
  const occurrences = Math.min(Math.max(academicPeriod.durationWeeks, 1), MAX_OCCURRENCES);
  const dayDuration = 7 * 24 * 60 * 60_000;

  try {
    await prisma.$transaction(async (tx) => {
      let recurrenceId: string | null = null;

      if (occurrences > 1) {
        const recurrence = await tx.reservationRecurrence.create({
          data: {
            laboratoryId,
            createdById: teacher.id,
            frequency: "WEEKLY",
            interval: 1,
            weekDay: recurrenceWeekDay,
            startDate: reservationStart,
            endDate: new Date(reservationEnd.getTime() + (occurrences - 1) * dayDuration),
            ...(subjectColumnSupport.recurrence ? { subject } : {}),
          },
          select: { id: true },
        });

        recurrenceId = recurrence.id;
      }

      for (let index = 0; index < occurrences; index += 1) {
        const offset = index * dayDuration;
        const occurrenceStart = new Date(reservationStart.getTime() + offset);
        const occurrenceEnd = new Date(reservationEnd.getTime() + offset);
        const occurrenceIso = getIsoDateInTimeZone(occurrenceStart, systemRules.timeZone);

        const occurrenceNonTeaching = findNonTeachingRuleForDate(
          occurrenceIso,
          systemRules.nonTeachingDays,
          systemRules.timeZone,
        );

        if (occurrenceNonTeaching) {
          throw new NonTeachingDayError(occurrenceStart, occurrenceNonTeaching.description);
        }

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
            createdById: teacher.id,
            startTime: occurrenceStart,
            endTime: occurrenceEnd,
            status: ReservationStatus.CONFIRMED,
            recurrenceId: recurrenceId ?? undefined,
            ...(subjectColumnSupport.reservation ? { subject } : {}),
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
        message: `Já existe uma reserva confirmada para ${formatted}. Ajuste a seleção de horários.`,
      };
    }

    if (error instanceof NonTeachingDayError) {
      const formatted = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
      }).format(error.date);

      return {
        status: "error",
        message: error.reason
          ? `${formatted} está marcado como não letivo (${error.reason}). Ajuste a recorrência.`
          : `${formatted} está marcado como não letivo. Ajuste a recorrência.`,
      };
    }

    console.error("[scheduling] Failed to assign class period reservation", error);
    return {
      status: "error",
      message: "Não foi possível completar o agendamento do período letivo. Tente novamente mais tarde.",
    };
  }

  revalidatePath("/dashboard/scheduling");
  revalidatePath("/dashboard/scheduling/agenda");
  revalidatePath("/dashboard/scheduling/history");
  revalidatePath("/dashboard/scheduling/overview");

  return {
    status: "success",
    message: `Reservas cadastradas para ${teacher.name} ao longo de ${occurrences} semana${occurrences > 1 ? "s" : ""}.`,
  };
}

function resolveAcademicPeriodConfig(systemRules: SerializableSystemRules): {
  label: string;
  durationWeeks: number;
  description?: string;
} | null {
  const { academicPeriod } = systemRules;

  if (!academicPeriod?.durationWeeks || academicPeriod.durationWeeks <= 0) {
    return null;
  }

  return {
    label: academicPeriod.label ?? "Período letivo",
    durationWeeks: academicPeriod.durationWeeks,
    description: academicPeriod.description ?? undefined,
  };
}

class ReservationConflictError extends Error {
  constructor(public readonly date: Date) {
    super("Reservation conflict");
  }
}

class NonTeachingDayError extends Error {
  constructor(public readonly date: Date, public readonly reason?: string | null) {
    super("Non teaching day");
  }
}
