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

const MAX_OCCURRENCES = 26;

const createReservationSchema = z.object({
  laboratoryId: z.string().min(1, "Selecione um laboratório válido."),
  date: z
    .string()
    .regex(/^(\\d{4})-(\\d{2})-(\\d{2})$/, "Informe uma data válida."),
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

  const systemRules = await getSystemRules();
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

  if (resolvedSlots.some((slot) => slot!.isOccupied)) {
    return {
      status: "error",
      message: "Um dos horários selecionados ficou indisponível. Atualize a agenda e tente novamente.",
    };
  }

  if (resolvedSlots.some((slot) => slot!.isPast)) {
    return {
      status: "error",
      message: "Não é possível reservar horários que já passaram.",
    };
  }

  const selectionSet = new Set(uniqueSlots);
  const firstSlot = resolvedSlots[0]!;
  const lastSlot = resolvedSlots[resolvedSlots.length - 1]!;

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

  const successMessage =
    occurrences > 1
      ? "Recorrência criada com sucesso. Todas as reservas foram confirmadas."
      : "Reserva confirmada com sucesso.";

  return { status: "success", message: successMessage };
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
