import type { PaginationState, SortingState } from "@/features/shared/table";

export interface SerializableSoftware {
  id: string;
  name: string;
  version: string;
  supplier: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoftwareFiltersState {
  search?: string;
  suppliers: string[];
  updatedFrom?: string;
  updatedTo?: string;
  createdFrom?: string;
  createdTo?: string;
}

export type SoftwareSortField = "name" | "version" | "updatedAt";

export type SoftwareSortingState = SortingState<SoftwareSortField>;

export type SoftwarePaginationState = PaginationState;
