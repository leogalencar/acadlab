import { ReservationStatus, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSystemRules } from "@/features/system-rules/server/queries";
import {
  buildDailySchedule,
  findNonTeachingRuleForDate,
  getEndOfDayInTimeZone,
  getStartOfDayInTimeZone,
  getIsoDateInTimeZone,
  getWeekDayInTimeZone,
} from "@/features/scheduling/utils";
import type {
  AcademicPeriodSummary,
  AgendaReservation,
  DailySchedule,
  OverviewRankingEntry,
  OverviewReservation,
  ReservationHistoryEntry,
  SchedulingOverviewData,
  SerializableLaboratoryOption,
  SerializableReservationSummary,
  SerializableUserOption,
} from "@/features/scheduling/types";
import type { NonTeachingDayRule, SerializableSystemRules } from "@/features/system-rules/types";

interface GetSchedulingBoardOptions {
  laboratoryId: string;
  date: string;
  now: Date;
}

interface SchedulingBoardSnapshot {
  schedule: DailySchedule;
  timeZone: string;
  nonTeachingRules: NonTeachingDayRule[];
  classPeriod?: AcademicPeriodSummary | null;
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
    classPeriod: extractAcademicPeriodSummary(systemRules),
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
      subject: true,
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
    subject: reservation.subject,
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
      subject: true,
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
    subject: reservation.subject,
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
      subject: true,
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
    subject: reservation.subject,
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

export async function getProfessorOptions(): Promise<SerializableUserOption[]> {
  const professors = await prisma.user.findMany({
    where: {
      role: Role.PROFESSOR,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  return professors.map((professor) => ({
    id: professor.id,
    name: professor.name,
  }));
}

export async function getSchedulingOverview(
  actor: { id: string; role: Role },
): Promise<SchedulingOverviewData> {
  if (actor.role === Role.PROFESSOR) {
    throw new Error("Professores não têm acesso à visão geral de agendamentos.");
  }

  const systemRules = await getSystemRules();
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const dayDurationMs = 24 * 60 * 60_000;

  const todayIso = getIsoDateInTimeZone(now, systemRules.timeZone);
  const todayStart = getStartOfDayInTimeZone(todayIso, systemRules.timeZone);
  const weekDayIndex = getWeekDayInTimeZone(todayIso, systemRules.timeZone);
  const mondayOffset = (weekDayIndex + 6) % 7;
  const weekStartDate = new Date(todayStart.getTime() - mondayOffset * dayDurationMs);
  const weekEndDate = new Date(weekStartDate.getTime() + 7 * dayDurationMs);
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    getIsoDateInTimeZone(new Date(weekStartDate.getTime() + index * dayDurationMs), systemRules.timeZone),
  );

  const [
    activeNow,
    reservationsThisMonth,
    cancelledThisMonth,
    pendingApproval,
    upcomingReservationsRaw,
    topLaboratoriesRaw,
    topRequestersRaw,
    weeklyReservations,
  ] = await Promise.all([
    prisma.reservation.count({
      where: {
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
        startTime: { lte: now },
        endTime: { gt: now },
      },
    }),
    prisma.reservation.count({
      where: {
        status: { not: ReservationStatus.CANCELLED },
        startTime: { gte: startOfMonth, lt: nextMonthStart },
      },
    }),
    prisma.reservation.count({
      where: {
        status: ReservationStatus.CANCELLED,
        cancelledAt: { gte: startOfMonth, lt: nextMonthStart },
      },
    }),
    prisma.reservation.count({
      where: {
        status: ReservationStatus.PENDING,
        startTime: { gte: now },
      },
    }),
    prisma.reservation.findMany({
      where: {
        status: { not: ReservationStatus.CANCELLED },
        startTime: { gte: now },
      },
      orderBy: { startTime: "asc" },
      take: 5,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        subject: true,
        laboratory: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.reservation.groupBy({
      by: ["laboratoryId"],
      where: {
        status: { not: ReservationStatus.CANCELLED },
        startTime: { gte: startOfMonth, lt: nextMonthStart },
      },
      _count: { _all: true },
    }),
    prisma.reservation.groupBy({
      by: ["createdById"],
      where: {
        status: { not: ReservationStatus.CANCELLED },
        startTime: { gte: startOfMonth, lt: nextMonthStart },
      },
      _count: { _all: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { not: ReservationStatus.CANCELLED },
        startTime: { gte: weekStartDate, lt: weekEndDate },
      },
      select: {
        startTime: true,
      },
    }),
  ]);

  const laboratoryIds = topLaboratoriesRaw.map((entry) => entry.laboratoryId);
  const laboratoriesMap = laboratoryIds.length
    ? new Map(
        (
          await prisma.laboratory.findMany({
            where: { id: { in: laboratoryIds } },
            select: { id: true, name: true },
          })
        ).map((lab) => [lab.id, lab.name]),
      )
    : new Map<string, string>();

  const requesterIds = topRequestersRaw.map((entry) => entry.createdById);
  const requestersMap = requesterIds.length
    ? new Map(
        (
          await prisma.user.findMany({
            where: { id: { in: requesterIds } },
            select: { id: true, name: true },
          })
        ).map((user) => [user.id, user.name]),
      )
    : new Map<string, string>();

  const rankedLaboratories = [...topLaboratoriesRaw]
    .sort((left, right) => right._count._all - left._count._all)
    .slice(0, 5);
  const rankedRequesters = [...topRequestersRaw]
    .sort((left, right) => right._count._all - left._count._all)
    .slice(0, 5);

  const topLaboratories: OverviewRankingEntry[] = rankedLaboratories.map((entry) => ({
    id: entry.laboratoryId,
    name: laboratoriesMap.get(entry.laboratoryId) ?? "Laboratório",
    reservationsCount: entry._count._all,
  }));

  const topRequesters: OverviewRankingEntry[] = rankedRequesters.map((entry) => ({
    id: entry.createdById,
    name: requestersMap.get(entry.createdById) ?? "Usuário",
    reservationsCount: entry._count._all,
  }));

  const weeklyUsageMap = new Map<string, number>();
  weeklyReservations.forEach((reservation) => {
    const iso = getIsoDateInTimeZone(reservation.startTime, systemRules.timeZone);
    weeklyUsageMap.set(iso, (weeklyUsageMap.get(iso) ?? 0) + 1);
  });

  const weeklyUsage = weekDays.map((iso) => ({
    date: iso,
    reservationsCount: weeklyUsageMap.get(iso) ?? 0,
  }));

  const upcoming: OverviewReservation[] = upcomingReservationsRaw.map((reservation) => ({
    id: reservation.id,
    laboratoryName: reservation.laboratory.name,
    startTime: reservation.startTime.toISOString(),
    endTime: reservation.endTime.toISOString(),
    status: reservation.status,
    subject: reservation.subject,
    createdByName: reservation.createdBy.name,
  }));

  const classPeriod = extractAcademicPeriodSummary(systemRules);

  return {
    totals: {
      activeNow,
      reservationsThisMonth,
      cancelledThisMonth,
      pendingApproval,
    },
    upcoming,
    topLaboratories,
    topRequesters,
    weeklyUsage,
    classPeriod,
    timeZone: systemRules.timeZone,
    generatedAt: now.toISOString(),
  };
}

function extractAcademicPeriodSummary(systemRules: SerializableSystemRules): AcademicPeriodSummary | null {
  const rawConfig = (systemRules as unknown as {
    academicPeriod?: { label?: string; durationWeeks?: number; description?: string | null };
  }).academicPeriod;

  if (!rawConfig?.durationWeeks || rawConfig.durationWeeks <= 0) {
    return null;
  }

  return {
    label: rawConfig.label ?? "Período letivo",
    durationWeeks: rawConfig.durationWeeks,
    description: rawConfig.description ?? undefined,
  };
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
