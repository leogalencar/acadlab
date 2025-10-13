import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  SerializableSoftware,
  SoftwareFiltersState,
  SoftwarePaginationState,
  SoftwareSortField,
  SoftwareSortingState,
} from "@/features/software-management/types";
import { DEFAULT_PAGE_SIZE } from "@/features/shared/table";

const SOFTWARE_SORT_FIELDS: SoftwareSortField[] = ["name", "version", "updatedAt"];

interface GetSoftwareCatalogOptions {
  searchTerm?: string;
  suppliers: string[];
  updatedFrom?: Date;
  updatedTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
  sorting: SoftwareSortingState;
  pagination: { page: number; perPage: number };
}

export async function getSoftwareCatalog({
  searchTerm,
  suppliers,
  updatedFrom,
  updatedTo,
  createdFrom,
  createdTo,
  sorting,
  pagination,
}: GetSoftwareCatalogOptions): Promise<{
  software: SerializableSoftware[];
  total: number;
  supplierOptions: string[];
}> {
  const conditions: Prisma.SoftwareWhereInput[] = [];

  if (searchTerm) {
    conditions.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { version: { contains: searchTerm, mode: "insensitive" } },
        { supplier: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (suppliers.length > 0) {
    conditions.push({ supplier: { in: suppliers } });
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

  const createdFilter: Prisma.DateTimeFilter = {};
  if (createdFrom) {
    createdFilter.gte = createdFrom;
  }
  if (createdTo) {
    createdFilter.lte = createdTo;
  }
  if (Object.keys(createdFilter).length > 0) {
    conditions.push({ createdAt: createdFilter });
  }

  const where = conditions.length > 0 ? { AND: conditions } : undefined;

  const orderBy: Prisma.SoftwareOrderByWithRelationInput[] = [];
  switch (sorting.sortBy) {
    case "version":
      orderBy.push({ version: sorting.sortOrder });
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

  const [total, softwareList, supplierRecords] = await Promise.all([
    prisma.software.count({ where }),
    prisma.software.findMany({
      where,
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.software.findMany({
      where: { supplier: { not: null } },
      distinct: ["supplier"],
      orderBy: { supplier: "asc" },
      select: { supplier: true },
    }),
  ]);

  const supplierOptions = supplierRecords
    .map((record) => record.supplier)
    .filter((value): value is string => Boolean(value));

  const software = softwareList.map((item) => ({
    id: item.id,
    name: item.name,
    version: item.version,
    supplier: item.supplier,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return { software, total, supplierOptions };
}

export function buildSoftwareFiltersState(
  params: Record<string, string | string[] | undefined>,
): {
  filters: SoftwareFiltersState;
  searchTerm?: string;
  suppliers: string[];
  updatedFrom?: Date;
  updatedTo?: Date;
  sorting: SoftwareSortingState;
  pagination: SoftwarePaginationState;
} {
  const searchRaw = getFirst(params["search"]);
  const suppliersRaw = params["supplier"];
  const updatedFromRaw = getFirst(params["updatedFrom"]);
  const updatedToRaw = getFirst(params["updatedTo"]);
  const createdFromRaw = getFirst(params["createdFrom"]);
  const createdToRaw = getFirst(params["createdTo"]);
  const sortByRaw = getFirst(params["sortBy"]);
  const sortOrderRaw = getFirst(params["sortOrder"]);
  const pageRaw = getFirst(params["page"]);
  const perPageRaw = getFirst(params["perPage"]);

  const searchTerm = searchRaw?.trim() ? searchRaw.trim() : undefined;
  const suppliers = normalizeToArray(suppliersRaw).filter(Boolean);
  let updatedFrom = parseDate(updatedFromRaw);
  let updatedTo = parseDate(updatedToRaw);
  let createdFrom = parseDate(createdFromRaw);
  let createdTo = parseDate(createdToRaw);

  if (updatedFrom && updatedTo && updatedFrom > updatedTo) {
    updatedFrom = undefined;
    updatedTo = undefined;
  }

  if (createdFrom && createdTo && createdFrom > createdTo) {
    createdFrom = undefined;
    createdTo = undefined;
  }

  const sortBy = SOFTWARE_SORT_FIELDS.includes(sortByRaw as SoftwareSortField)
    ? (sortByRaw as SoftwareSortField)
    : "name";
  const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";

  const page = Math.max(1, parseInteger(pageRaw) ?? 1);
  const perPage = normalizePageSize(parseInteger(perPageRaw));

  const filters: SoftwareFiltersState = {
    search: searchTerm,
    suppliers,
    updatedFrom: updatedFromRaw ?? undefined,
    updatedTo: updatedToRaw ?? undefined,
    createdFrom: createdFromRaw ?? undefined,
    createdTo: createdToRaw ?? undefined,
  };

  const sorting: SoftwareSortingState = { sortBy, sortOrder };
  const pagination: SoftwarePaginationState = { page, perPage, total: 0 };

  return {
    filters,
    searchTerm,
    suppliers,
    updatedFrom,
    updatedTo,
    createdFrom,
    createdTo,
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
