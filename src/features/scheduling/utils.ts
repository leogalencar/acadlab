import { ReservationStatus } from "@prisma/client";

import { PERIOD_IDS, type PeriodId } from "@/features/system-rules/constants";
import { parseTimeToMinutes } from "@/features/system-rules/utils";

import type {
  DailySchedule,
  PeriodSchedule,
  ReservationSlot,
  SerializableReservationSummary,
} from "@/features/scheduling/types";
import type { SerializableSystemRules } from "@/features/system-rules/types";

interface BuildDailyScheduleOptions {
  date: string;
  systemRules: SerializableSystemRules;
  reservations: SerializableReservationSummary[];
  now: Date;
}

interface IntervalDefinition {
  start: number;
  durationMinutes: number;
}

interface PeriodDefinition {
  id: PeriodId;
  label: string;
  firstClassTime: number;
  classDurationMinutes: number;
  classesCount: number;
  intervals: IntervalDefinition[];
}

const PERIOD_LABELS: Record<PeriodId, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};

export function buildDailySchedule({
  date,
  systemRules,
  reservations,
  now,
}: BuildDailyScheduleOptions): DailySchedule {
  const baseDate = buildStartOfDay(date);
  const baseTimestamp = baseDate.getTime();
  const normalizedReservations = reservations.map((reservation) => ({
    ...reservation,
    startTimestamp: new Date(reservation.startTime).getTime(),
    endTimestamp: new Date(reservation.endTime).getTime(),
  }));

  const nowTimestamp = now.getTime();

  const periods: PeriodSchedule[] = PERIOD_IDS.map((periodId) => {
    const rule = systemRules.periods[periodId];

    if (!rule) {
      return {
        id: periodId,
        label: PERIOD_LABELS[periodId],
        slots: [],
      } satisfies PeriodSchedule;
    }

    const definition: PeriodDefinition = {
      id: periodId,
      label: PERIOD_LABELS[periodId],
      firstClassTime: parseTimeToMinutes(rule.firstClassTime),
      classDurationMinutes: rule.classDurationMinutes,
      classesCount: rule.classesCount,
      intervals: [...(rule.intervals ?? [])]
        .map((interval) => ({
          start: parseTimeToMinutes(interval.start),
          durationMinutes: interval.durationMinutes,
        }))
        .sort((left, right) => left.start - right.start),
    };

    const slots = buildPeriodSlots({
      baseTimestamp,
      nowTimestamp,
      reservations: normalizedReservations,
      definition,
    });

    return {
      id: periodId,
      label: definition.label,
      slots,
    } satisfies PeriodSchedule;
  });

  return { date, periods };
}

interface BuildPeriodSlotsOptions {
  baseTimestamp: number;
  nowTimestamp: number;
  reservations: Array<SerializableReservationSummary & {
    startTimestamp: number;
    endTimestamp: number;
  }>;
  definition: PeriodDefinition;
}

function buildPeriodSlots({
  baseTimestamp,
  nowTimestamp,
  reservations,
  definition,
}: BuildPeriodSlotsOptions): ReservationSlot[] {
  const slots: ReservationSlot[] = [];
  const intervals = definition.intervals;
  let intervalIndex = 0;
  let currentMinutes = definition.firstClassTime;

  for (let index = 0; index < definition.classesCount; index += 1) {
    while (intervalIndex < intervals.length && currentMinutes >= intervals[intervalIndex]!.start) {
      currentMinutes = Math.max(currentMinutes, intervals[intervalIndex]!.start) +
        intervals[intervalIndex]!.durationMinutes;
      intervalIndex += 1;
    }

    const nextInterval = intervals[intervalIndex];
    if (
      nextInterval &&
      currentMinutes + definition.classDurationMinutes > nextInterval.start
    ) {
      currentMinutes = Math.max(currentMinutes, nextInterval.start) +
        nextInterval.durationMinutes;
      intervalIndex += 1;
    }

    const slotStart = baseTimestamp + currentMinutes * 60_000;
    const slotEnd = slotStart + definition.classDurationMinutes * 60_000;

    const conflictingReservation = findConflictingReservation(
      reservations,
      slotStart,
      slotEnd,
    );

    const isOccupied =
      conflictingReservation !== null &&
      conflictingReservation.status !== ReservationStatus.CANCELLED;

    slots.push({
      id: new Date(slotStart).toISOString(),
      periodId: definition.id,
      classIndex: index + 1,
      startTime: new Date(slotStart).toISOString(),
      endTime: new Date(slotEnd).toISOString(),
      isOccupied,
      isPast: slotEnd <= nowTimestamp,
      reservation: conflictingReservation ?? undefined,
    });

    currentMinutes += definition.classDurationMinutes;
  }

  return slots;
}

function findConflictingReservation(
  reservations: Array<SerializableReservationSummary & {
    startTimestamp: number;
    endTimestamp: number;
  }>,
  slotStart: number,
  slotEnd: number,
): (SerializableReservationSummary & {
  startTimestamp: number;
  endTimestamp: number;
}) | null {
  for (const reservation of reservations) {
    if (reservation.status === ReservationStatus.CANCELLED) {
      continue;
    }

    const overlaps = reservation.startTimestamp < slotEnd && reservation.endTimestamp > slotStart;

    if (overlaps) {
      return reservation;
    }
  }

  return null;
}

function buildStartOfDay(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  return new Date(`${date}T00:00:00.000Z`);
}
