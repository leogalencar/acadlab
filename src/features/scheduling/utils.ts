import { ReservationStatus } from "@prisma/client";

import { PERIOD_IDS, type PeriodId } from "@/features/system-rules/constants";
import type { NonTeachingDayRule } from "@/features/system-rules/types";
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
  nonTeachingRule?: NonTeachingDayRule | null;
}

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function getIsoDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getStartOfDayInTimeZone(date: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const reference = new Date(utcMidnight);
  const offset = getTimeZoneOffset(reference, timeZone);

  return new Date(utcMidnight - offset);
}

export function getEndOfDayInTimeZone(date: string, timeZone: string): Date {
  const start = getStartOfDayInTimeZone(date, timeZone);
  return new Date(start.getTime() + 24 * 60 * 60_000);
}

export function formatIsoDateInTimeZone(
  date: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    ...options,
  });

  return formatter.format(getStartOfDayInTimeZone(date, timeZone));
}

export function getWeekDayInTimeZone(date: string, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });

  const weekdayPart = formatter
    .formatToParts(getStartOfDayInTimeZone(date, timeZone))
    .find((part) => part.type === "weekday")?.value;

  if (!weekdayPart) {
    return getStartOfDayInTimeZone(date, timeZone).getUTCDay();
  }

  const normalized = weekdayPart.slice(0, 3).toLowerCase();
  return WEEKDAY_INDEX[normalized] ?? 0;
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "0", 10);
  const month = Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "1", 10) - 1;
  const day = Number.parseInt(parts.find((part) => part.type === "day")?.value ?? "1", 10);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
  const second = Number.parseInt(parts.find((part) => part.type === "second")?.value ?? "0", 10);

  const zonedTime = Date.UTC(year, month, day, hour, minute, second);
  return zonedTime - date.getTime();
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
  nonTeachingRule,
}: BuildDailyScheduleOptions): DailySchedule {
  const baseDate = buildStartOfDay(date, systemRules.timeZone);
  const baseTimestamp = baseDate.getTime();
  const normalizedReservations = reservations.map((reservation) => ({
    ...reservation,
    startTimestamp: new Date(reservation.startTime).getTime(),
    endTimestamp: new Date(reservation.endTime).getTime(),
  }));

  const nowTimestamp = now.getTime();
  const isNonTeachingDay = Boolean(nonTeachingRule);
  const nonTeachingReason = nonTeachingRule?.description?.trim() ?? undefined;

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

  return { date, periods, isNonTeachingDay, nonTeachingReason };
}

export function findNonTeachingRuleForDate(
  date: string,
  rules: NonTeachingDayRule[],
  timeZone: string,
): NonTeachingDayRule | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const weekDay = getWeekDayInTimeZone(date, timeZone);
  const monthDay = date.slice(5);

  for (const rule of rules) {
    if (rule.kind === "weekday") {
      if (rule.weekDay === weekDay) {
        return rule;
      }
      continue;
    }

    if (!rule.date) {
      continue;
    }

    if (rule.repeatsAnnually) {
      if (rule.date.slice(5) === monthDay) {
        return rule;
      }
      continue;
    }

    if (rule.date === date) {
      return rule;
    }
  }

  return null;
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

function buildStartOfDay(date: string, timeZone: string): Date {
  return getStartOfDayInTimeZone(date, timeZone);
}
