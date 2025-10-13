export type SortOrder = "asc" | "desc";

export interface SortingState<TField extends string> {
  sortBy: TField;
  sortOrder: SortOrder;
}

export interface PaginationState {
  page: number;
  perPage: number;
  total: number;
}

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50];
