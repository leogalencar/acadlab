import { Role } from "@prisma/client";

export const MANAGER_ROLES: Role[] = [Role.ADMIN, Role.TECHNICIAN];

export function canManageWithManagerRoles(role: Role): boolean {
  return MANAGER_ROLES.includes(role);
}
