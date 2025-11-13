import { ReservationStatus, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";
import type { AuditSpan } from "@/lib/logging/audit";
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
  SchedulingLaboratorySearchResult,
  SerializableReservationSummary,
  SerializableUserOption,
} from "@/features/scheduling/types";
import type { NonTeachingDayRule, SerializableSystemRules } from "@/features/system-rules/types";
import { parseTimeToMinutes } from "@/features/system-rules/utils";

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

type SchedulingQueryAuditOptions = {
  correlationId?: string;
};

async function withSchedulingQueryAudit<T>(
  action: string,
  details: Record<string, unknown> | undefined,
  executor: (audit: AuditSpan) => Promise<T>,
  options: SchedulingQueryAuditOptions = {},
): Promise<T> {
  const audit = createAuditSpan(
    { module: "scheduling-queries", action, correlationId: options.correlationId },
    details,
    `Executing scheduling query: ${action}`,
    { importance: "low", logStart: false, logSuccess: false },
  );

  try {
    const result = await executor(audit);
    if (Array.isArray(result)) {
      audit.success({ resultCount: result.length });
    } else if (result && typeof result === "object") {
      audit.success({ keys: Object.keys(result as Record<string, unknown>).slice(0, 5) });
    } else {
      audit.success({ resultType: typeof result });
    }
    return result;
  } catch (error) {
    audit.failure(error, { stage: action });
    throw error;
  }
}

export async function getSchedulingBoardData({
  laboratoryId,
  date,
  now,
}: GetSchedulingBoardOptions, auditOptions: SchedulingQueryAuditOptions = {}): Promise<SchedulingBoardSnapshot> {
  return withSchedulingQueryAudit(
    "getSchedulingBoardData",
    { laboratoryId, date },
    async (audit) => {
      const systemRules = await getSystemRules();
      const reservations = await getReservationsForDay({
        laboratoryId,
        date,
        timeZone: systemRules.timeZone,
      }, { correlationId: audit.correlationId });

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
    },
    auditOptions,
  );
}

export async function getActiveLaboratoryOptions(
  auditOptions: SchedulingQueryAuditOptions = {},
): Promise<SerializableLaboratoryOption[]> {
  return withSchedulingQueryAudit("getActiveLaboratoryOptions", undefined, async (audit) => {
    const laboratories = await audit.trackPrisma(
      { model: "laboratory", action: "findMany", meta: { status: "ACTIVE" } },
      () =>
        prisma.laboratory.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
          },
        }),
    );

    return laboratories.map((laboratory) => ({
      id: laboratory.id,
      name: laboratory.name,
    }));
  }, auditOptions);
}

export async function getActiveLaboratoryOption(
  id: string,
  auditOptions: SchedulingQueryAuditOptions = {},
): Promise<SerializableLaboratoryOption | null> {
  return withSchedulingQueryAudit(
    "getActiveLaboratoryOption",
    { laboratoryId: id },
    async (audit) => {
      const laboratory = await audit.trackPrisma(
        { model: "laboratory", action: "findFirst", targetIds: id },
        () =>
          prisma.laboratory.findFirst({
            where: {
              id,
              status: "ACTIVE",
            },
            select: {
              id: true,
              name: true,
            },
          }),
      );

      if (!laboratory) {
        return null;
      }

      return {
        id: laboratory.id,
        name: laboratory.name,
      };
    },
    auditOptions,
  );
}

interface SearchLaboratoriesForSchedulingOptions {
  date: string;
  time?: string;
  softwareIds: string[];
  minimumCapacity?: number;
  now: Date;
}

export async function searchLaboratoriesForScheduling({
  date,
  time,
  softwareIds,
  minimumCapacity,
  now,
}: SearchLaboratoriesForSchedulingOptions, auditOptions: SchedulingQueryAuditOptions = {}): Promise<{
  timeZone: string;
  results: SchedulingLaboratorySearchResult[];
}> {
  return withSchedulingQueryAudit(
    "searchLaboratoriesForScheduling",
    {
      date,
      time,
      softwareCount: softwareIds.length,
      minimumCapacity: minimumCapacity ?? null,
    },
    async (audit) => {
      const normalizedDate = normalizeDateParam(date);
      const [systemRules, laboratories] = await Promise.all([
        getSystemRules(),
        audit.trackPrisma(
          { model: "laboratory", action: "findMany", meta: { filtersApplied: softwareIds.length > 0 } },
          () =>
            prisma.laboratory.findMany({
              where: {
                status: "ACTIVE",
                ...(minimumCapacity ? { capacity: { gte: minimumCapacity } } : {}),
                ...(softwareIds.length > 0
                  ? {
                      AND: softwareIds.map((softwareId) => ({
                        softwareAssociations: { some: { softwareId } },
                      })),
                    }
                  : {}),
              },
              orderBy: { name: "asc" },
              include: {
                softwareAssociations: {
                  include: {
                    software: {
                      select: {
                        id: true,
                        name: true,
                        version: true,
                      },
                    },
                  },
                },
              },
            }),
        ),
      ]);

      if (laboratories.length === 0) {
        return { timeZone: systemRules.timeZone, results: [] };
      }

      const nonTeachingRule = findNonTeachingRuleForDate(
        normalizedDate,
        systemRules.nonTeachingDays,
        systemRules.timeZone,
      );

      if (nonTeachingRule) {
        return { timeZone: systemRules.timeZone, results: [] };
      }

      const laboratoryIds = laboratories.map((laboratory) => laboratory.id);
      const startOfDay = getStartOfDayInTimeZone(normalizedDate, systemRules.timeZone);
      const endOfDay = getEndOfDayInTimeZone(normalizedDate, systemRules.timeZone);

      const reservations = await audit.trackPrisma(
        { model: "reservation", action: "findMany", meta: { laboratoryCount: laboratoryIds.length } },
        () =>
          prisma.reservation.findMany({
            where: {
              laboratoryId: { in: laboratoryIds },
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
          }),
      );

      const reservationsByLaboratory = new Map<string, SerializableReservationSummary[]>();
      reservations.forEach((reservation) => {
        const serialized: SerializableReservationSummary = {
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
        };

        if (!reservationsByLaboratory.has(reservation.laboratoryId)) {
          reservationsByLaboratory.set(reservation.laboratoryId, []);
        }

        reservationsByLaboratory.get(reservation.laboratoryId)!.push(serialized);
      });

      let requestedMinutes: number | undefined;
      if (time) {
        try {
          requestedMinutes = parseTimeToMinutes(time);
        } catch {
          requestedMinutes = undefined;
        }
      }

      const results: SchedulingLaboratorySearchResult[] = [];

      laboratories.forEach((laboratory) => {
        const laboratoryReservations = reservationsByLaboratory.get(laboratory.id) ?? [];
        const schedule = buildDailySchedule({
          date: normalizedDate,
          systemRules,
          reservations: laboratoryReservations,
          now,
          nonTeachingRule: null,
        });

        if (schedule.isNonTeachingDay) {
          return;
        }

        const availableSlots = schedule.periods.flatMap((period) =>
          period.slots
            .filter((slot) => !slot.isOccupied && !slot.isPast)
            .map((slot) => ({
              startTime: slot.startTime,
              endTime: slot.endTime,
              periodId: period.id,
              classIndex: slot.classIndex,
            })),
        );

        if (availableSlots.length === 0) {
          return;
        }

        let relevantSlots = availableSlots;

        if (requestedMinutes !== undefined) {
          relevantSlots = availableSlots.filter((slot) => {
            const startMinutes = getMinutesSinceStartOfDay(slot.startTime, systemRules.timeZone);
            return startMinutes === requestedMinutes;
          });

          if (relevantSlots.length === 0) {
            return;
          }
        }

        relevantSlots.sort((left, right) => left.startTime.localeCompare(right.startTime));

        results.push({
          id: laboratory.id,
          name: laboratory.name,
          capacity: laboratory.capacity,
          software: laboratory.softwareAssociations
            .map((association) => ({
              id: association.softwareId,
              name: association.software.name,
              version: association.software.version,
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
          availableSlots: relevantSlots.slice(0, 3),
          totalMatchingSlots: relevantSlots.length,
        });
      });

      return {
        timeZone: systemRules.timeZone,
        results,
      };
    },
    auditOptions,
  );
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
}: GetReservationsForDayOptions, auditOptions: SchedulingQueryAuditOptions = {}): Promise<SerializableReservationSummary[]> {
  return withSchedulingQueryAudit(
    "getReservationsForDay",
    { laboratoryId, date },
    async (audit) => {
      const startOfDay = getStartOfDayInTimeZone(date, timeZone);
      const endOfDay = getEndOfDayInTimeZone(date, timeZone);

      const reservations = await audit.trackPrisma(
        { model: "reservation", action: "findMany", targetIds: laboratoryId },
        () =>
          prisma.reservation.findMany({
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
          }),
      );

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
    },
    auditOptions,
  );
}

export async function getUpcomingReservations(
  actor: { id: string; role: Role },
  auditOptions: SchedulingQueryAuditOptions = {},
): Promise<AgendaReservation[]> {
  return withSchedulingQueryAudit(
    "getUpcomingReservations",
    { actorId: actor.id, role: actor.role },
    async (audit) => {
      const now = new Date();
      const canViewAll = actor.role === Role.TECHNICIAN || actor.role === Role.ADMIN;

      const reservations = await audit.trackPrisma(
        { model: "reservation", action: "findMany", meta: { canViewAll } },
        () =>
          prisma.reservation.findMany({
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
          }),
      );

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
    },
    auditOptions,
  );
}

export async function getReservationHistory(
  actor: { id: string; role: Role },
  auditOptions: SchedulingQueryAuditOptions = {},
): Promise<ReservationHistoryEntry[]> {
  return withSchedulingQueryAudit(
    "getReservationHistory",
    { actorId: actor.id, role: actor.role },
    async (audit) => {
      const canViewAll = actor.role === Role.TECHNICIAN || actor.role === Role.ADMIN;

      const reservations = await audit.trackPrisma(
        { model: "reservation", action: "findMany", meta: { canViewAll } },
        () =>
          prisma.reservation.findMany({
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
          }),
      );

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
    },
    auditOptions,
  );
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

export async function getProfessorOptions(
  auditOptions: SchedulingQueryAuditOptions = {},
): Promise<SerializableUserOption[]> {
  return withSchedulingQueryAudit(
    "getProfessorOptions",
    undefined,
    async (audit) => {
      const professors = await audit.trackPrisma(
        { model: "user", action: "findMany", meta: { role: Role.PROFESSOR } },
        () =>
          prisma.user.findMany({
            where: {
              role: Role.PROFESSOR,
            },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
            },
          }),
      );

      return professors.map((professor) => ({
        id: professor.id,
        name: professor.name,
      }));
    },
    auditOptions,
  );
}

export async function getSchedulingOverview(
  actor: { id: string; role: Role },
  auditOptions: SchedulingQueryAuditOptions = {},
): Promise<SchedulingOverviewData> {
  if (actor.role === Role.PROFESSOR) {
    throw new Error("Professores não têm acesso à visão geral de agendamentos.");
  }

  const systemRules = await getSystemRules();
  return withSchedulingQueryAudit(
    "getSchedulingOverview",
    { actorId: actor.id, role: actor.role },
    async (audit) => {
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
        audit.trackPrisma(
          { model: "reservation", action: "count", meta: { metric: "activeNow" } },
          () =>
            prisma.reservation.count({
              where: {
                status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
                startTime: { lte: now },
                endTime: { gt: now },
              },
            }),
        ),
        audit.trackPrisma(
          { model: "reservation", action: "count", meta: { metric: "reservationsThisMonth" } },
          () =>
            prisma.reservation.count({
              where: {
                status: { not: ReservationStatus.CANCELLED },
                startTime: { gte: startOfMonth, lt: nextMonthStart },
              },
            }),
        ),
        audit.trackPrisma(
          { model: "reservation", action: "count", meta: { metric: "cancelledThisMonth" } },
          () =>
            prisma.reservation.count({
              where: {
                status: ReservationStatus.CANCELLED,
                cancelledAt: { gte: startOfMonth, lt: nextMonthStart },
              },
            }),
        ),
        audit.trackPrisma(
          { model: "reservation", action: "count", meta: { metric: "pendingApproval" } },
          () =>
            prisma.reservation.count({
              where: {
                status: ReservationStatus.PENDING,
                startTime: { gte: now },
              },
            }),
        ),
        audit.trackPrisma(
          { model: "reservation", action: "findMany", meta: { metric: "upcoming" } },
          () =>
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
        ),
        audit.trackPrisma(
          { model: "reservation", action: "groupBy", meta: { by: "laboratoryId" } },
          () =>
            prisma.reservation.groupBy({
              by: ["laboratoryId"],
              where: {
                status: { not: ReservationStatus.CANCELLED },
                startTime: { gte: startOfMonth, lt: nextMonthStart },
              },
              _count: { _all: true },
            }),
        ),
        audit.trackPrisma(
          { model: "reservation", action: "groupBy", meta: { by: "createdById" } },
          () =>
            prisma.reservation.groupBy({
              by: ["createdById"],
              where: {
                status: { not: ReservationStatus.CANCELLED },
                startTime: { gte: startOfMonth, lt: nextMonthStart },
              },
              _count: { _all: true },
            }),
        ),
        audit.trackPrisma(
          { model: "reservation", action: "findMany", meta: { metric: "weekly" } },
          () =>
            prisma.reservation.findMany({
              where: {
                status: { not: ReservationStatus.CANCELLED },
                startTime: { gte: weekStartDate, lt: weekEndDate },
              },
              select: {
                startTime: true,
              },
            }),
        ),
      ]);

      const laboratoryIds = topLaboratoriesRaw.map((entry) => entry.laboratoryId);
      const laboratoriesMap = laboratoryIds.length
        ? new Map(
            (
              await audit.trackPrisma(
                { model: "laboratory", action: "findMany", meta: { count: laboratoryIds.length } },
                () =>
                  prisma.laboratory.findMany({
                    where: { id: { in: laboratoryIds } },
                    select: { id: true, name: true },
                  }),
              )
            ).map((lab) => [lab.id, lab.name]),
          )
        : new Map<string, string>();

      const requesterIds = topRequestersRaw.map((entry) => entry.createdById);
      const requestersMap = requesterIds.length
        ? new Map(
            (
              await audit.trackPrisma(
                { model: "user", action: "findMany", meta: { count: requesterIds.length } },
                () =>
                  prisma.user.findMany({
                    where: { id: { in: requesterIds } },
                    select: { id: true, name: true },
                  }),
              )
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
    },
    auditOptions,
  );
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

function getMinutesSinceStartOfDay(isoDate: string, timeZone: string): number {
  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hours = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minutes = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);

  return hours * 60 + minutes;
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
