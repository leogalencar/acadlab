import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HistoryTable } from "@/features/scheduling/components/history-table";
import {
  getActiveLaboratoryOptions,
  getReservationHistory,
  getSchedulableUserOptions,
  type ReservationHistoryFilters,
} from "@/features/scheduling/server/queries";
import type { SearchParamsLike } from "@/features/shared/search-params";
import { resolveSearchParams } from "@/features/shared/search-params";

export const metadata: Metadata = {
  title: "Histórico de reservas • AcadLab",
};

type HistorySearchParams = {
  status?: string | string[];
  laboratoryId?: string | string[];
  userId?: string | string[];
  from?: string | string[];
  to?: string | string[];
  recurrence?: string | string[];
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<HistorySearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/scheduling/history");
  }

  const resolvedParams = await resolveSearchParams<HistorySearchParams>(searchParams);
  const flattenedParams: Record<string, string | undefined> = {};
  Object.entries(resolvedParams ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      flattenedParams[key] = value[0];
    } else {
      flattenedParams[key] = value;
    }
  });

  const { filters, canViewAllUsers } = normalizeHistoryFilters(flattenedParams, {
    canViewAll: session.user.role === "ADMIN" || session.user.role === "TECHNICIAN",
  });

  const reservations = await getReservationHistory({
    id: session.user.id,
    role: session.user.role,
  }, filters);
  const [laboratories, schedulableUsers] = await Promise.all([
    getActiveLaboratoryOptions(),
    canViewAllUsers ? getSchedulableUserOptions() : Promise.resolve([]),
  ]);

  return (
    <HistoryTable
      reservations={reservations}
      actorRole={session.user.role}
      filters={filters}
      laboratories={laboratories}
      users={schedulableUsers}
      canViewAllUsers={canViewAllUsers}
    />
  );
}

function normalizeHistoryFilters(
  params: Record<string, string | undefined>,
  options: { canViewAll: boolean },
): { filters: ReservationHistoryFilters; canViewAllUsers: boolean } {
  const status = params.status?.toUpperCase();
  const recurrence = params.recurrence?.toLowerCase();

  const filters: ReservationHistoryFilters = {};

  if (status === "PENDING" || status === "CONFIRMED" || status === "CANCELLED") {
    filters.status = status;
  } else {
    filters.status = status === "ALL" ? "ALL" : undefined;
  }

  if (params.laboratoryId) {
    filters.laboratoryId = params.laboratoryId;
  }

  if (options.canViewAll && params.userId) {
    filters.userId = params.userId;
  }

  if (params.from) {
    filters.from = params.from;
  }

  if (params.to) {
    filters.to = params.to;
  }

  if (recurrence === "single" || recurrence === "recurring") {
    filters.recurrence = recurrence;
  } else if (recurrence === "all") {
    filters.recurrence = "all";
  }

  return { filters, canViewAllUsers: options.canViewAll };
}
