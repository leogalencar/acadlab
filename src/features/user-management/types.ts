import { Role, UserStatus } from "@prisma/client";

import type { PaginationState, SortingState } from "@/features/shared/table";

export interface SerializableUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserFiltersState {
  search?: string;
  roles: Role[];
  statuses: UserStatus[];
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

export type UserSortField = "name" | "email" | "role" | "status" | "updatedAt";

export type UserSortingState = SortingState<UserSortField>;

export type UserPaginationState = PaginationState;
