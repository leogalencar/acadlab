import { LaboratoryStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  LaboratoryFiltersState,
  LaboratoryPaginationState,
  LaboratorySortField,
  LaboratorySortingState,
  SerializableLaboratory,
} from "@/features/lab-management/types";
import { DEFAULT_PAGE_SIZE } from "@/features/shared/table";

interface GetLaboratoriesOptions {
  softwareIds: string[];
  statuses: LaboratoryStatus[];
  capacity?: number;
  searchTerm?: string;
  updatedFrom?: Date;
  updatedTo?: Date;
  sorting: LaboratorySortingState;
  pagination: { page: number; perPage: number };
}

const LAB_SORT_FIELDS: LaboratorySortField[] = [
  "name",
  "capacity",
  "status",
  "updatedAt",
];

export async function getLaboratoriesWithFilters({
  softwareIds,
  statuses,
  capacity,
  searchTerm,
  updatedFrom,
  updatedTo,
  sorting,
  pagination,
}: GetLaboratoriesOptions): Promise<{
  laboratories: SerializableLaboratory[];
  total: number;
}> {
  const conditions: Prisma.LaboratoryWhereInput[] = [];

  if (softwareIds.length > 0) {
    conditions.push({
      softwareAssociations: {
        some: {
          softwareId: { in: softwareIds },
        },
      },
    });
  }

  if (statuses.length > 0) {
    conditions.push({ status: { in: statuses } });
  }

  if (typeof capacity === "number") {
    conditions.push({ capacity });
  }

  if (searchTerm) {
    conditions.push({
      OR: [
        { name: { contains: searchTerm } },
        { description: { contains: searchTerm } },
      ],
    });
  }

  const updatedFilter: Prisma.DateTimeFilter = {};
  if (updatedFrom) {
    updatedFilter.gte = updatedFrom;
  }
  if (updatedTo) {
    updatedFilter.lte = updatedTo;
  }
  if (Object.keys(updatedFilter).length > 0) {
    conditions.push({ updatedAt: updatedFilter });
  }

  const where = conditions.length > 0 ? { AND: conditions } : undefined;

  const orderBy: Prisma.LaboratoryOrderByWithRelationInput[] = [];
  switch (sorting.sortBy) {
    case "capacity":
      orderBy.push({ capacity: sorting.sortOrder });
      break;
    case "status":
      orderBy.push({ status: sorting.sortOrder });
      break;
    case "updatedAt":
      orderBy.push({ updatedAt: sorting.sortOrder });
      break;
    case "name":
    default:
      orderBy.push({ name: sorting.sortOrder });
      break;
  }
  if (sorting.sortBy !== "name") {
    orderBy.push({ name: "asc" });
  }

  const page = Math.max(1, pagination.page);
  const perPage = Math.max(1, pagination.perPage);
  const skip = (page - 1) * perPage;

  const [total, laboratories] = await Promise.all([
    prisma.laboratory.count({ where }),
    prisma.laboratory.findMany({
      where,
      orderBy,
      skip,
      take: perPage,
      include: {
        softwareAssociations: {
          include: {
            software: true,
            installedBy: { select: { id: true, name: true } },
          },
          orderBy: { software: { name: "asc" } },
        },
      },
    }),
  ]);

  return {
    total,
    laboratories: laboratories.map((laboratory) => ({
      id: laboratory.id,
      name: laboratory.name,
      capacity: laboratory.capacity,
      status: laboratory.status,
      description: laboratory.description,
      createdAt: laboratory.createdAt.toISOString(),
      updatedAt: laboratory.updatedAt.toISOString(),
      software: laboratory.softwareAssociations.map((association) => ({
        softwareId: association.softwareId,
        name: association.software.name,
        version: association.software.version,
        supplier: association.software.supplier,
        installedAt: association.installedAt.toISOString(),
        installedByName: association.installedBy?.name ?? null,
        installedById: association.installedBy?.id ?? null,
      })),
    })),
  };
}

export function buildFiltersState(
  params: Record<string, string | string[] | undefined>,
): {
  filters: LaboratoryFiltersState;
  softwareIds: string[];
  statuses: LaboratoryStatus[];
  capacity?: number;
  searchTerm?: string;
  updatedFrom?: Date;
  updatedTo?: Date;
  sorting: LaboratorySortingState;
  pagination: LaboratoryPaginationState;
} {
  const softwareRaw = params["software"];
  const statusesRaw = params["status"];
  const capacityRaw = getFirst(params["capacity"]);
  const searchRaw = getFirst(params["search"]);
  const sortByRaw = getFirst(params["sortBy"]);
  const sortOrderRaw = getFirst(params["sortOrder"]);
  const pageRaw = getFirst(params["page"]);
  const perPageRaw = getFirst(params["perPage"]);

  const updatedFromRaw = getFirst(params["updatedFrom"]);
  const updatedToRaw = getFirst(params["updatedTo"]);
  let updatedFrom = parseDate(updatedFromRaw);
  let updatedTo = parseDate(updatedToRaw);

  if (updatedFrom && updatedTo && updatedFrom > updatedTo) {
    updatedFrom = undefined;
    updatedTo = undefined;
  }
  const softwareIds = normalizeToArray(softwareRaw);
  const statuses = normalizeToArray(statusesRaw)
    .map((status) => safeParseStatus(status))
    .filter((status): status is LaboratoryStatus => Boolean(status));

  const capacity = parseInteger(capacityRaw);
  const searchTerm = searchRaw?.trim() ? searchRaw.trim() : undefined;

  const sortBy = LAB_SORT_FIELDS.includes(sortByRaw as LaboratorySortField)
    ? (sortByRaw as LaboratorySortField)
    : "name";
  const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";

  const page = Math.max(1, parseInteger(pageRaw) ?? 1);
  const perPage = normalizePageSize(parseInteger(perPageRaw));

  const filters: LaboratoryFiltersState = {
    softwareIds,
    statuses,
    capacity: capacityRaw ?? undefined,
    search: searchTerm,
    updatedFrom: updatedFromRaw ?? undefined,
    updatedTo: updatedToRaw ?? undefined,
  };

  const sorting: LaboratorySortingState = { sortBy, sortOrder };
  const pagination: LaboratoryPaginationState = { page, perPage, total: 0 };

  return {
    filters,
    softwareIds,
    statuses,
    capacity,
    searchTerm,
    updatedFrom,
    updatedTo,
    sorting,
    pagination,
  };
}

function getFirst(value?: string | string[] | null): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
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

function normalizeToArray(value?: string | string[] | null): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
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

function safeParseStatus(value?: string | null): LaboratoryStatus | undefined {
  if (!value) {
    return undefined;
  }

  if (value === LaboratoryStatus.ACTIVE || value === LaboratoryStatus.INACTIVE) {
    return value;
  }

  return undefined;
}
