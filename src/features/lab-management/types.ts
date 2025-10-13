import { LaboratoryStatus, Role } from "@prisma/client";

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
}

export const LAB_MANAGER_ROLES: Role[] = [Role.ADMIN, Role.TECHNICIAN];

export function canManageLaboratories(role: Role): boolean {
  return LAB_MANAGER_ROLES.includes(role);
}
