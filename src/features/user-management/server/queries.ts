import { Prisma, Role, UserStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  SerializableUser,
  UserFiltersState,
  UserPaginationState,
  UserSortField,
  UserSortingState,
} from "@/features/user-management/types";
import { DEFAULT_PAGE_SIZE } from "@/features/shared/table";

const USER_SORT_FIELDS: UserSortField[] = ["name", "email", "role", "status", "updatedAt"];

interface UserDateFilters {
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;
}

interface GetUsersOptions extends UserDateFilters {
  actorRole: Role;
  searchTerm?: string;
  roles: Role[];
  statuses: UserStatus[];
  sorting: UserSortingState;
  pagination: { page: number; perPage: number };
}

export async function getUsersWithFilters({
  actorRole,
  searchTerm,
  roles,
  statuses,
  createdFrom,
  createdTo,
  updatedFrom,
  updatedTo,
  sorting,
  pagination,
}: GetUsersOptions): Promise<{ users: SerializableUser[]; total: number }> {
  const conditions: Prisma.UserWhereInput[] = [];

  const allowedRoles = actorRole === Role.ADMIN ? Object.values(Role) : [Role.PROFESSOR];
  const normalizedRoles = roles.length > 0 ? roles.filter((role) => allowedRoles.includes(role)) : allowedRoles;

  conditions.push({ role: { in: normalizedRoles } });

  if (searchTerm) {
    conditions.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (statuses.length > 0) {
    conditions.push({ status: { in: statuses } });
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

  const where = { AND: conditions } satisfies Prisma.UserWhereInput;

  const orderBy: Prisma.UserOrderByWithRelationInput[] = [];
  switch (sorting.sortBy) {
    case "email":
      orderBy.push({ email: sorting.sortOrder });
      break;
    case "role":
      orderBy.push({ role: sorting.sortOrder });
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

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: perPage,
    }),
  ]);

  return {
    total,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })),
  };
}

interface BuildUserFiltersStateResult {
  filters: UserFiltersState;
  searchTerm?: string;
  roles: Role[];
  statuses: UserStatus[];
  dateFilters: UserDateFilters;
  sorting: UserSortingState;
  pagination: UserPaginationState;
}

export function buildUserFiltersState(
  params: Record<string, string | string[] | undefined>,
): BuildUserFiltersStateResult {
  const searchRaw = getFirst(params["search"]);
  const rolesRaw = params["role"];
  const statusesRaw = params["status"];
  const createdFromRaw = getFirst(params["createdFrom"]);
  const createdToRaw = getFirst(params["createdTo"]);
  const updatedFromRaw = getFirst(params["updatedFrom"]);
  const updatedToRaw = getFirst(params["updatedTo"]);
  const sortByRaw = getFirst(params["sortBy"]);
  const sortOrderRaw = getFirst(params["sortOrder"]);
  const pageRaw = getFirst(params["page"]);
  const perPageRaw = getFirst(params["perPage"]);

  const searchTerm = searchRaw?.trim() ? searchRaw.trim() : undefined;
  const roles = normalizeToArray(rolesRaw)
    .map((value) => safeParseRole(value))
    .filter((role): role is Role => Boolean(role));
  const statuses = normalizeToArray(statusesRaw)
    .map((value) => safeParseStatus(value))
    .filter((status): status is UserStatus => Boolean(status));
  let createdFrom = parseDate(createdFromRaw);
  let createdTo = parseDate(createdToRaw);
  let updatedFrom = parseDate(updatedFromRaw);
  let updatedTo = parseDate(updatedToRaw);

  if (createdFrom && createdTo && createdFrom > createdTo) {
    createdFrom = undefined;
    createdTo = undefined;
  }

  if (updatedFrom && updatedTo && updatedFrom > updatedTo) {
    updatedFrom = undefined;
    updatedTo = undefined;
  }

  const sortBy = USER_SORT_FIELDS.includes(sortByRaw as UserSortField)
    ? (sortByRaw as UserSortField)
    : "updatedAt";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";

  const page = Math.max(1, parseInteger(pageRaw) ?? 1);
  const perPage = normalizePageSize(parseInteger(perPageRaw));

  const filters: UserFiltersState = {
    search: searchTerm,
    roles,
    statuses,
    createdFrom: createdFromRaw ?? undefined,
    createdTo: createdToRaw ?? undefined,
    updatedFrom: updatedFromRaw ?? undefined,
    updatedTo: updatedToRaw ?? undefined,
  };

  const sorting: UserSortingState = { sortBy, sortOrder };
  const pagination: UserPaginationState = { page, perPage, total: 0 };

  return {
    filters,
    searchTerm,
    roles,
    statuses,
    dateFilters: {
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
    },
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

function safeParseRole(value?: string | null): Role | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(Role).includes(value as Role) ? (value as Role) : undefined;
}

function safeParseStatus(value?: string | null): UserStatus | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(UserStatus).includes(value as UserStatus) ? (value as UserStatus) : undefined;
}
