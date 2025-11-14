import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/features/shared/table";
import { prisma } from "@/lib/prisma";

export type AuditLogFilters = {
  level?: string;
  module?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  fromTime?: string;
  toTime?: string;
  page?: number;
  perPage?: number;
};

type AuditLogWhere = NonNullable<Parameters<typeof prisma.auditLog.findMany>[0]>["where"];

export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const where: AuditLogWhere = {};

  if (filters.level) {
    where.level = filters.level;
  }

  if (filters.module) {
    where.module = filters.module;
  }

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.search) {
    const term = filters.search.trim();
    if (term.length > 0) {
      where.OR = [
        { message: { contains: term } },
        { module: { contains: term } },
        { action: { contains: term } },
        { actorId: { contains: term } },
        { id: { contains: term } },
      ];
    }
  }

  const createdAtFilter = resolveCreatedAtFilter(filters);
  if (createdAtFilter) {
    where.createdAt = createdAtFilter;
  }

  const perPageCandidate = filters.perPage ?? DEFAULT_PAGE_SIZE;
  const allowedPageSizes = new Set(PAGE_SIZE_OPTIONS);
  const perPage = allowedPageSizes.has(perPageCandidate)
    ? perPageCandidate
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const skip = (page - 1) * perPage;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
  ]);

  return {
    logs,
    pagination: {
      page,
      perPage,
      total,
    },
  };
}

export async function getDistinctLogModules() {
  const rows = await prisma.auditLog.findMany({
    distinct: ["module"],
    orderBy: { module: "asc" },
    select: { module: true },
    take: 200,
  });

  return rows.map((row) => row.module).filter(Boolean);
}

function resolveCreatedAtFilter(filters: AuditLogFilters) {
  const range: { gte?: Date; lte?: Date } = {};
  const fromDate = buildDate(filters.from, filters.fromTime, "start");
  const toDate = buildDate(filters.to, filters.toTime, "end");

  if (fromDate) {
    range.gte = fromDate;
  }
  if (toDate) {
    range.lte = toDate;
  }

  if (!range.gte && !range.lte) {
    return undefined;
  }

  if (range.gte && range.lte && range.lte < range.gte) {
    return { gte: range.lte, lte: range.gte };
  }

  return range;
}

function buildDate(date?: string, time?: string, boundary: "start" | "end" = "start") {
  if (!date) {
    return undefined;
  }

  const parsedDate = date.split("-").map((value) => Number.parseInt(value, 10));
  if (parsedDate.length !== 3) {
    return undefined;
  }

  const [year, month, day] = parsedDate;
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return undefined;
  }

  const hasTime = Boolean(time && time.length >= 4);
  const parsedTime = hasTime ? time!.split(":").map((value) => Number.parseInt(value, 10)) : [];
  const [hours, minutes] = hasTime
    ? [parsedTime[0] ?? 0, parsedTime[1] ?? 0]
    : boundary === "start"
      ? [0, 0]
      : [23, 59];

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return undefined;
  }

  const constructed = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  if (boundary === "start") {
    constructed.setUTCMilliseconds(0);
    constructed.setUTCSeconds(0);
  } else if (hasTime) {
    constructed.setUTCSeconds(59, 999);
  } else {
    constructed.setUTCHours(23, 59, 59, 999);
  }

  return constructed;
}
