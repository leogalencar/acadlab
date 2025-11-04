import { Role, SoftwareRequestStatus } from "@prisma/client";

import { MANAGER_ROLES } from "@/features/shared/roles";
import type { PaginationState, SortingState } from "@/features/shared/table";

export interface SerializableSoftwareRequest {
  id: string;
  softwareName: string;
  softwareVersion: string | null;
  justification: string | null;
  status: SoftwareRequestStatus;
  laboratory: {
    id: string;
    name: string;
  };
  requester: {
    id: string;
    name: string;
  };
  reviewer: {
    id: string;
    name: string;
  } | null;
  responseNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export interface SoftwareRequestFiltersState {
  statuses: SoftwareRequestStatus[];
  laboratoryIds: string[];
  search?: string;
  createdFrom?: string;
  createdTo?: string;
}

export type SoftwareRequestSortField =
  | "softwareName"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "laboratoryName";

export type SoftwareRequestSortingState = SortingState<SoftwareRequestSortField>;

export type SoftwareRequestPaginationState = PaginationState;

export type SoftwareRequestStatusCounts = Record<SoftwareRequestStatus, number>;

export interface SoftwareRequestLaboratoryOption {
  id: string;
  name: string;
}

export function canManageSoftwareRequests(role: Role): boolean {
  return MANAGER_ROLES.includes(role);
}

export const SOFTWARE_REQUEST_STATUS_LABELS: Record<SoftwareRequestStatus, string> = {
  [SoftwareRequestStatus.PENDING]: "Pendente",
  [SoftwareRequestStatus.APPROVED]: "Aprovado",
  [SoftwareRequestStatus.REJECTED]: "Rejeitado",
};
