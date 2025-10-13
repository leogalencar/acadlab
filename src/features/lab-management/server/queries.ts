import { ReservationStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  LaboratoryFiltersState,
  SerializableLaboratory,
  SerializableSoftware,
} from "@/features/lab-management/types";

interface GetLaboratoriesOptions {
  availableFrom?: Date;
  availableTo?: Date;
  softwareIds?: string[];
}

export async function getLaboratoriesWithFilters({
  availableFrom,
  availableTo,
  softwareIds,
}: GetLaboratoriesOptions): Promise<SerializableLaboratory[]> {
  const conditions: Prisma.LaboratoryWhereInput[] = [];

  if (availableFrom && availableTo) {
    conditions.push({
      reservations: {
        none: {
          startTime: { lt: availableTo },
          endTime: { gt: availableFrom },
          status: { not: ReservationStatus.CANCELLED },
        },
      },
    });
  }

  if (softwareIds && softwareIds.length > 0) {
    conditions.push(
      ...softwareIds.map((softwareId) => ({
        softwareAssociations: {
          some: { softwareId },
        },
      })),
    );
  }

  const laboratories = await prisma.laboratory.findMany({
    where: conditions.length > 0 ? { AND: conditions } : undefined,
    orderBy: [{ name: "asc" }],
    include: {
      softwareAssociations: {
        include: {
          software: true,
          installedBy: { select: { id: true, name: true } },
        },
        orderBy: { software: { name: "asc" } },
      },
    },
  });

  return laboratories.map((laboratory) => ({
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
    isAvailableForSelectedRange: Boolean(availableFrom && availableTo),
  }));
}

export async function getSoftwareCatalog(): Promise<SerializableSoftware[]> {
  const softwareList = await prisma.software.findMany({
    orderBy: [
      { name: "asc" },
      { version: "asc" },
    ],
  });

  return softwareList.map((software) => ({
    id: software.id,
    name: software.name,
    version: software.version,
    supplier: software.supplier,
    createdAt: software.createdAt.toISOString(),
    updatedAt: software.updatedAt.toISOString(),
  }));
}

export function buildFiltersState(
  params: Record<string, string | string[] | undefined>,
): {
  filters: LaboratoryFiltersState;
  availableFrom?: Date;
  availableTo?: Date;
  softwareIds: string[];
} {
  const availableFromRaw = getFirst(params["availableFrom"]);
  const availableToRaw = getFirst(params["availableTo"]);
  const softwareRaw = params["software"];

  const availableFrom = parseDate(availableFromRaw);
  const availableTo = parseDate(availableToRaw);
  const softwareIds = normalizeToArray(softwareRaw);

  const filters: LaboratoryFiltersState = {
    availableFrom: availableFromRaw ?? undefined,
    availableTo: availableToRaw ?? undefined,
    softwareIds,
  };

  if (!availableFrom || !availableTo || availableFrom >= availableTo) {
    return {
      filters: {
        availableFrom: undefined,
        availableTo: undefined,
        softwareIds,
      },
      softwareIds,
    };
  }

  return { filters, availableFrom, availableTo, softwareIds };
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
