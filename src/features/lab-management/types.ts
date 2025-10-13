import { LaboratoryStatus, Role } from "@prisma/client";

import { MANAGER_ROLES } from "@/features/shared/roles";
import type { PaginationState, SortingState } from "@/features/shared/table";

export interface SerializableLaboratorySoftware {
  softwareId: string;
  name: string;
  version: string;
  supplier: string | null;
  installedAt: string;
  installedByName: string | null;
  installedById: string | null;
}

export interface SerializableLaboratory {
  id: string;
  name: string;
  capacity: number;
  status: LaboratoryStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  software: SerializableLaboratorySoftware[];
  isAvailableForSelectedRange: boolean;
}

export interface LaboratoryFiltersState {
  availableFrom?: string;
  availableTo?: string;
  softwareIds: string[];
  statuses: LaboratoryStatus[];
  minCapacity?: string;
  maxCapacity?: string;
  search?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

export type LaboratorySortField = "name" | "capacity" | "status" | "updatedAt";

export type LaboratorySortingState = SortingState<LaboratorySortField>;

export type LaboratoryPaginationState = PaginationState;

export function canManageLaboratories(role: Role): boolean {
  return MANAGER_ROLES.includes(role);
}
