import { ReservationStatus, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSystemRules } from "@/features/system-rules/server/queries";
import {
  buildDailySchedule,
  findNonTeachingRuleForDate,
  getEndOfDayInTimeZone,
  getStartOfDayInTimeZone,
} from "@/features/scheduling/utils";
import type {
  AgendaReservation,
  DailySchedule,
  ReservationHistoryEntry,
  SerializableLaboratoryOption,
  SerializableReservationSummary,
} from "@/features/scheduling/types";
import type { NonTeachingDayRule } from "@/features/system-rules/types";

interface GetSchedulingBoardOptions {
  laboratoryId: string;
  date: string;
  now: Date;
}

interface SchedulingBoardSnapshot {
  schedule: DailySchedule;
  timeZone: string;
  nonTeachingRules: NonTeachingDayRule[];
}

export async function getSchedulingBoardData({
  laboratoryId,
  date,
  now,
}: GetSchedulingBoardOptions): Promise<SchedulingBoardSnapshot> {
  const systemRules = await getSystemRules();
  const reservations = await getReservationsForDay({
    laboratoryId,
    date,
    timeZone: systemRules.timeZone,
  });

  const nonTeachingRule = findNonTeachingRuleForDate(
    date,
    systemRules.nonTeachingDays,
    systemRules.timeZone,
  );

  const schedule = buildDailySchedule({
    date,
    systemRules,
    reservations,
    now,
    nonTeachingRule,
  });

  return {
    schedule,
    timeZone: systemRules.timeZone,
    nonTeachingRules: systemRules.nonTeachingDays,
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
  timeZone: string;
}

export async function getReservationsForDay({
  laboratoryId,
  date,
  timeZone,
}: GetReservationsForDayOptions): Promise<SerializableReservationSummary[]> {
  const startOfDay = getStartOfDayInTimeZone(date, timeZone);
  const endOfDay = getEndOfDayInTimeZone(date, timeZone);

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
      createdAt: true,
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
    createdAt: reservation.createdAt.toISOString(),
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
