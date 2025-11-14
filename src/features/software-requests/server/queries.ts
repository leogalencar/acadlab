import { Prisma, Role, SoftwareRequestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";
import { DEFAULT_PAGE_SIZE } from "@/features/shared/table";
import type {
  SerializableSoftwareRequest,
  SoftwareRequestFiltersState,
  SoftwareRequestLaboratoryOption,
  SoftwareRequestPaginationState,
  SoftwareRequestSortField,
  SoftwareRequestSortingState,
  SoftwareRequestStatusCounts,
} from "@/features/software-requests/types";
import { canManageSoftwareRequests } from "@/features/software-requests/types";

const SOFTWARE_REQUEST_SORT_FIELDS: SoftwareRequestSortField[] = [
  "softwareName",
  "status",
  "createdAt",
  "updatedAt",
  "laboratoryName",
];

interface GetSoftwareRequestsOptions {
  actor: {
    id: string;
    role: Role;
  };
  statuses: SoftwareRequestStatus[];
  laboratoryIds: string[];
  searchTerm?: string;
  createdFrom?: Date;
  createdTo?: Date;
  sorting: SoftwareRequestSortingState;
  pagination: {
    page: number;
    perPage: number;
  };
}

export async function getSoftwareRequestsWithFilters({
  actor,
  statuses,
  laboratoryIds,
  searchTerm,
  createdFrom,
  createdTo,
  sorting,
  pagination,
}: GetSoftwareRequestsOptions): Promise<{
  requests: SerializableSoftwareRequest[];
  total: number;
  laboratoryOptions: SoftwareRequestLaboratoryOption[];
  statusCounts: SoftwareRequestStatusCounts;
}> {
  const scopedConditions: Prisma.SoftwareRequestWhereInput[] = [];

  if (!canManageSoftwareRequests(actor.role)) {
    scopedConditions.push({ requesterId: actor.id });
  }

  if (laboratoryIds.length > 0) {
    scopedConditions.push({ laboratoryId: { in: laboratoryIds } });
  }

  if (searchTerm) {
    scopedConditions.push({
      OR: [
        { softwareName: { contains: searchTerm } },
        { softwareVersion: { contains: searchTerm } },
        { justification: { contains: searchTerm } },
      ],
    });
  }

  if (createdFrom || createdTo) {
    const createdFilter: Prisma.DateTimeFilter = {};
    if (createdFrom) {
      createdFilter.gte = createdFrom;
    }
    if (createdTo) {
      createdFilter.lte = createdTo;
    }
    scopedConditions.push({ createdAt: createdFilter });
  }

  const scopedWhere = scopedConditions.length > 0 ? { AND: scopedConditions } : undefined;
  const whereConditions = scopedConditions.slice();

  if (statuses.length > 0) {
    whereConditions.push({ status: { in: statuses } });
  }

  const where = whereConditions.length > 0 ? { AND: whereConditions } : undefined;

  const orderBy: Prisma.SoftwareRequestOrderByWithRelationInput[] = [];
  switch (sorting.sortBy) {
    case "status":
      orderBy.push({ status: sorting.sortOrder });
      break;
    case "createdAt":
      orderBy.push({ createdAt: sorting.sortOrder });
      break;
    case "updatedAt":
      orderBy.push({ updatedAt: sorting.sortOrder });
      break;
    case "laboratoryName":
      orderBy.push({ laboratory: { name: sorting.sortOrder } });
      break;
    case "softwareName":
    default:
      orderBy.push({ softwareName: sorting.sortOrder });
      break;
  }

  if (sorting.sortBy !== "createdAt") {
    orderBy.push({ createdAt: "desc" });
  }

  const page = Math.max(1, pagination.page);
  const perPage = Math.max(1, pagination.perPage);
  const skip = (page - 1) * perPage;

  const audit = createAuditSpan(
    { module: "software-requests", action: "getSoftwareRequestsWithFilters", actorId: actor.id, actorRole: actor.role },
    {
      filters: {
        statusCount: statuses.length,
        labCount: laboratoryIds.length,
        hasSearch: Boolean(searchTerm),
        hasDateRange: Boolean(createdFrom || createdTo),
      },
      sorting,
      pagination: { page, perPage },
    },
    "Preparing software request query",
    { importance: "low", logStart: false, logSuccess: false },
  );

  try {
    const [requests, total, statusGroups, laboratoryOptions] = await Promise.all([
      audit.trackPrisma(
        {
          model: "softwareRequest",
          action: "findMany",
          meta: { skip, take: perPage },
        },
        () =>
          prisma.softwareRequest.findMany({
            where,
            orderBy,
            skip,
            take: perPage,
            include: {
              laboratory: { select: { id: true, name: true } },
              requester: { select: { id: true, name: true } },
              reviewer: { select: { id: true, name: true } },
            },
          }),
      ),
      audit.trackPrisma(
        { model: "softwareRequest", action: "count", meta: { hasFilter: Boolean(where) } },
        () => prisma.softwareRequest.count({ where }),
      ),
      audit.trackPrisma(
        { model: "softwareRequest", action: "groupBy", meta: { by: "status" } },
        () =>
          prisma.softwareRequest.groupBy({
            by: ["status"],
            _count: true,
            where: scopedWhere,
          }),
      ),
      audit.trackPrisma(
        { model: "laboratory", action: "findMany", meta: { select: "id,name" } },
        () =>
          prisma.laboratory.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
      ),
    ]);

    const statusCounts = buildStatusCounts(statusGroups);

    const result = {
      total,
      statusCounts,
      laboratoryOptions,
      requests: requests.map((request) => ({
        id: request.id,
        softwareName: request.softwareName,
        softwareVersion: request.softwareVersion,
        justification: request.justification,
        status: request.status,
        laboratory: {
          id: request.laboratory.id,
          name: request.laboratory.name,
        },
        requester: {
          id: request.requester.id,
          name: request.requester.name,
        },
        reviewer: request.reviewer
          ? {
              id: request.reviewer.id,
              name: request.reviewer.name,
            }
          : null,
        responseNotes: request.responseNotes,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
      })),
    };

    audit.success({ total: result.total, returned: result.requests.length }, "Software requests fetched");

    return result;
  } catch (error) {
    audit.failure(error, { stage: "getSoftwareRequestsWithFilters" });
    throw error;
  }
}

export function buildSoftwareRequestFiltersState(
  params: Record<string, string | string[] | undefined>,
): {
  filters: SoftwareRequestFiltersState;
  statuses: SoftwareRequestStatus[];
  laboratoryIds: string[];
  searchTerm?: string;
  createdFrom?: Date;
  createdTo?: Date;
  sorting: SoftwareRequestSortingState;
  pagination: SoftwareRequestPaginationState;
} {
  const statusesRaw = params["status"];
  const laboratoriesRaw = params["laboratory"];
  const searchRaw = getFirst(params["search"]);
  const createdFromRaw = getFirst(params["createdFrom"]);
  const createdToRaw = getFirst(params["createdTo"]);
  const sortByRaw = getFirst(params["sortBy"]);
  const sortOrderRaw = getFirst(params["sortOrder"]);
  const pageRaw = getFirst(params["page"]);
  const perPageRaw = getFirst(params["perPage"]);

  let createdFrom = parseDate(createdFromRaw);
  let createdTo = parseDate(createdToRaw);

  if (createdFrom && createdTo && createdFrom > createdTo) {
    createdFrom = undefined;
    createdTo = undefined;
  }

  const statuses = normalizeToArray(statusesRaw)
    .map((status) => safeParseStatus(status))
    .filter((status): status is SoftwareRequestStatus => Boolean(status));

  const laboratoryIds = normalizeToArray(laboratoriesRaw);
  const searchTerm = searchRaw?.trim() ? searchRaw.trim() : undefined;

  const sortBy = SOFTWARE_REQUEST_SORT_FIELDS.includes(sortByRaw as SoftwareRequestSortField)
    ? (sortByRaw as SoftwareRequestSortField)
    : "createdAt";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";

  const page = Math.max(1, parseInteger(pageRaw) ?? 1);
  const perPage = normalizePageSize(parseInteger(perPageRaw));

  const filters: SoftwareRequestFiltersState = {
    statuses,
    laboratoryIds,
    search: searchRaw ?? undefined,
    createdFrom: createdFromRaw ?? undefined,
    createdTo: createdToRaw ?? undefined,
  };

  const sorting: SoftwareRequestSortingState = { sortBy, sortOrder };
  const pagination: SoftwareRequestPaginationState = { page, perPage, total: 0 };

  return {
    filters,
    statuses,
    laboratoryIds,
    searchTerm,
    createdFrom,
    createdTo,
    sorting,
    pagination,
  };
}

function buildStatusCounts(
  groups: Array<{ status: SoftwareRequestStatus; _count: number }>,
): SoftwareRequestStatusCounts {
  return {
    [SoftwareRequestStatus.PENDING]: groups.find((group) => group.status === SoftwareRequestStatus.PENDING)?._count ?? 0,
    [SoftwareRequestStatus.APPROVED]: groups.find((group) => group.status === SoftwareRequestStatus.APPROVED)?._count ?? 0,
    [SoftwareRequestStatus.REJECTED]: groups.find((group) => group.status === SoftwareRequestStatus.REJECTED)?._count ?? 0,
    [SoftwareRequestStatus.CANCELLED]: groups.find((group) => group.status === SoftwareRequestStatus.CANCELLED)?._count ?? 0,
  };
}

function getFirst(value?: string | string[] | null): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeToArray(value?: string | string[] | null): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function parseDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function parseInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

function normalizePageSize(value?: number): number {
  if (!value) {
    return DEFAULT_PAGE_SIZE;
  }

  if (value <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function safeParseStatus(value?: string | null): SoftwareRequestStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (
    value === SoftwareRequestStatus.PENDING ||
    value === SoftwareRequestStatus.APPROVED ||
    value === SoftwareRequestStatus.REJECTED ||
    value === SoftwareRequestStatus.CANCELLED
  ) {
    return value;
  }

  return undefined;
}
