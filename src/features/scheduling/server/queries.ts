import type { Prisma } from "@prisma/client";
import { ReservationStatus, Role } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { buildDailySchedule } from "@/features/scheduling/utils";
import type {
  AgendaReservation,
  DailySchedule,
  LaboratoryAvailabilitySummary,
  ReservationHistoryEntry,
  SerializableLaboratoryOption,
  SerializableReservationSummary,
  SchedulableUserOption,
} from "@/features/scheduling/types";
import type { SerializableSystemRules } from "@/features/system-rules/types";

interface GetSchedulingBoardOptions {
  laboratoryId: string;
  date: string;
  now: Date;
}

const AVAILABILITY_LOOKAHEAD_DAYS = 120;

export interface ReservationHistoryFilters {
  status?: ReservationStatus | "ALL";
  laboratoryId?: string;
  userId?: string;
  from?: string;
  to?: string;
  recurrence?: "single" | "recurring" | "all";
}

export interface SchedulingOverviewData {
  totals: {
    upcoming: number;
    pending: number;
    cancelledLast30: number;
  };
  topLaboratories: Array<{
    laboratory: {
      id: string;
      name: string;
    };
    reservations: number;
  }>;
  topUsers: Array<{
    user: {
      id: string;
      name: string;
    };
    reservations: number;
  }>;
  upcomingReservations: AgendaReservation[];
}

export async function getSchedulingBoardData({
  laboratoryId,
  date,
  now,
}: GetSchedulingBoardOptions): Promise<{
  schedule: DailySchedule;
  availability: LaboratoryAvailabilitySummary;
  academicPeriods: SerializableSystemRules["academicPeriods"];
}> {
  const systemRules = await getSystemRules();
  const [reservations, availability] = await Promise.all([
    getReservationsForDay({ laboratoryId, date, timeZone: systemRules.timeZone }),
    getLaboratoryAvailabilitySummary({
      laboratoryId,
      systemRules,
      now,
      lookaheadInDays: AVAILABILITY_LOOKAHEAD_DAYS,
    }),
  ]);

  const schedule = buildDailySchedule({
    date,
    systemRules,
    reservations,
    now,
  });

  return {
    schedule,
    availability,
    academicPeriods: systemRules.academicPeriods ?? [],
  };
}

export async function getActiveLaboratoryOptions(): Promise<SerializableLaboratoryOption[]> {
  const laboratories = await prisma.laboratory.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  return laboratories.map((laboratory) => ({
    id: laboratory.id,
    name: laboratory.name,
  }));
}

interface GetReservationsForDayOptions {
  laboratoryId: string;
  date: string;
}

export async function getReservationsForDay({
  laboratoryId,
  date,
}: GetReservationsForDayOptions): Promise<SerializableReservationSummary[]> {
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60_000);

  const reservations = await prisma.reservation.findMany({
    where: {
      laboratoryId,
      startTime: { lt: endOfDay },
      endTime: { gt: startOfDay },
      status: { not: ReservationStatus.CANCELLED },
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      laboratoryId: true,
      startTime: true,
      endTime: true,
      status: true,
      recurrenceId: true,
      subject: true,
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return reservations.map((reservation) => ({
    id: reservation.id,
    laboratoryId: reservation.laboratoryId,
    startTime: reservation.startTime.toISOString(),
    endTime: reservation.endTime.toISOString(),
    status: reservation.status,
    recurrenceId: reservation.recurrenceId,
    createdBy: {
      id: reservation.createdBy.id,
      name: reservation.createdBy.name,
    },
  }));
}

export async function getUpcomingReservations(
  actor: { id: string; role: Role },
): Promise<AgendaReservation[]> {
  const now = new Date();
  const canViewAll = actor.role === Role.TECHNICIAN || actor.role === Role.ADMIN;

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(canViewAll ? {} : { createdById: actor.id }),
      status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      endTime: { gte: now },
    },
    orderBy: { startTime: "asc" },
    take: 100,
    select: {
      id: true,
      laboratoryId: true,
      startTime: true,
      endTime: true,
      status: true,
      recurrenceId: true,
      createdBy: {
        select: { id: true, name: true },
      },
      laboratory: {
        select: { id: true, name: true },
      },
    },
  });

  return reservations.map((reservation) => ({
    id: reservation.id,
    laboratoryId: reservation.laboratoryId,
    startTime: reservation.startTime.toISOString(),
    endTime: reservation.endTime.toISOString(),
    status: reservation.status,
    recurrenceId: reservation.recurrenceId,
    subject: reservation.subject,
    createdBy: {
      id: reservation.createdBy.id,
      name: reservation.createdBy.name,
    },
    laboratory: {
      id: reservation.laboratory.id,
      name: reservation.laboratory.name,
    },
  }));
}

export async function getReservationHistory(
  actor: { id: string; role: Role },
): Promise<ReservationHistoryEntry[]> {
  const canViewAll = actor.role === Role.TECHNICIAN || actor.role === Role.ADMIN;

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(canViewAll ? {} : { createdById: actor.id }),
    },
    orderBy: { startTime: "desc" },
    take: 250,
    select: {
      id: true,
      laboratoryId: true,
      startTime: true,
      endTime: true,
      status: true,
      recurrenceId: true,
      cancellationReason: true,
      cancelledAt: true,
      createdBy: {
        select: { id: true, name: true },
      },
      laboratory: {
        select: { id: true, name: true },
      },
    },
  });

  return reservations.map((reservation) => ({
    id: reservation.id,
    laboratoryId: reservation.laboratoryId,
    startTime: reservation.startTime.toISOString(),
    endTime: reservation.endTime.toISOString(),
    status: reservation.status,
    recurrenceId: reservation.recurrenceId,
    cancellationReason: reservation.cancellationReason,
    cancelledAt: reservation.cancelledAt?.toISOString() ?? null,
    createdBy: {
      id: reservation.createdBy.id,
      name: reservation.createdBy.name,
    },
    laboratory: {
      id: reservation.laboratory.id,
      name: reservation.laboratory.name,
    },
  }));
}

export function normalizeDateParam(rawDate?: string | string[]): string {
  const value = Array.isArray(rawDate) ? rawDate[0] : rawDate;
  if (!value) {
    return formatDate(new Date());
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return formatDate(new Date());
  }

  return value;
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface GetLaboratoryAvailabilitySummaryOptions {
  laboratoryId: string;
  systemRules: SerializableSystemRules;
  now: Date;
  lookaheadInDays: number;
}

async function getLaboratoryAvailabilitySummary({
  laboratoryId,
  systemRules,
  now,
  lookaheadInDays,
}: GetLaboratoryAvailabilitySummaryOptions): Promise<LaboratoryAvailabilitySummary> {
  const timeZone = systemRules.timeZone;
  const rangeStartIso = formatDateInTimeZone(now, timeZone);

  const reservations = await prisma.reservation.findMany({
    where: {
      laboratoryId,
      status: { not: ReservationStatus.CANCELLED },
      startTime: { lt: fromZonedTime(shiftIsoDate(rangeStartIso, lookaheadInDays + 1) + "T00:00:00", timeZone) },
      endTime: { gt: fromZonedTime(`${rangeStartIso}T00:00:00`, timeZone) },
    },
    select: {
      id: true,
      laboratoryId: true,
      startTime: true,
      endTime: true,
      status: true,
      recurrenceId: true,
      subject: true,
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const serializedReservations: SerializableReservationSummary[] = reservations.map(
    (reservation) => ({
      id: reservation.id,
      laboratoryId: reservation.laboratoryId,
      startTime: reservation.startTime.toISOString(),
      endTime: reservation.endTime.toISOString(),
      status: reservation.status,
      recurrenceId: reservation.recurrenceId,
      subject: reservation.subject,
      createdBy: {
        id: reservation.createdBy.id,
        name: reservation.createdBy.name,
      },
    }),
  );

  const reservationsByDate = new Map<string, SerializableReservationSummary[]>();
  for (const reservation of serializedReservations) {
    const coveredDates = enumerateDatesBetween(
      new Date(reservation.startTime),
      new Date(reservation.endTime),
      timeZone,
    );

    for (const date of coveredDates) {
      const existing = reservationsByDate.get(date);
      if (existing) {
        existing.push(reservation);
      } else {
        reservationsByDate.set(date, [reservation]);
      }
    }
  }

  const fullyBookedDates: string[] = [];

  for (let offset = 0; offset <= lookaheadInDays; offset += 1) {
    const isoDate = shiftIsoDate(rangeStartIso, offset);
    const dailyReservations = reservationsByDate.get(isoDate) ?? [];

    const schedule = buildDailySchedule({
      date: isoDate,
      systemRules,
      reservations: dailyReservations,
      now,
    });

    const hasAvailableSlot = schedule.periods.some((period) =>
      period.slots.some((slot) => !slot.isPast && !slot.isOccupied),
    );

    if (!hasAvailableSlot) {
      fullyBookedDates.push(isoDate);
    }
  }

  return {
    fullyBookedDates,
  };
}

function enumerateDatesBetween(start: Date, end: Date, timeZone: string): string[] {
  const dates = new Set<string>();
  const endAdjusted = end.getTime() === start.getTime()
    ? new Date(end.getTime())
    : new Date(end.getTime() - 1);

  let cursor = new Date(start.getTime());

  while (cursor.getTime() <= endAdjusted.getTime()) {
    dates.add(formatDateInTimeZone(cursor, timeZone));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60_000);
  }

  return Array.from(dates).sort();
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function shiftIsoDate(isoDate: string, offset: number): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10) - 1;
  const day = Number.parseInt(match[3]!, 10);

  const target = new Date(Date.UTC(year, month, day + offset));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const targetDay = target.getUTCDate();

  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}
