import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SoftwareRequestFilters } from "@/features/software-requests/components/software-request-filters";
import { SoftwareRequestsClient } from "@/features/software-requests/components/software-requests-client";
import { buildSoftwareRequestFiltersState, getSoftwareRequestsWithFilters } from "@/features/software-requests/server/queries";
import { resolveSearchParams, type SearchParamsLike } from "@/features/shared/search-params";

export const metadata: Metadata = {
  title: "Solicitações de software",
};

type SoftwareRequestsSearchParams = Record<string, string | string[] | undefined>;

export default async function SoftwareRequestsPage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<SoftwareRequestsSearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/software-requests");
  }

  const resolvedParams = await resolveSearchParams<SoftwareRequestsSearchParams>(searchParams);
  const {
    filters,
    statuses,
    laboratoryIds,
    searchTerm,
    createdFrom,
    createdTo,
    sorting,
    pagination,
  } = buildSoftwareRequestFiltersState(resolvedParams);

  const { requests, total, laboratoryOptions, statusCounts } = await getSoftwareRequestsWithFilters({
    actor: {
      id: session.user.id,
      role: session.user.role,
    },
    statuses,
    laboratoryIds,
    searchTerm,
    createdFrom,
    createdTo,
    sorting,
    pagination,
  });

  const paginationState = { ...pagination, total };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Suporte e manutenção</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Solicitações de software</h1>
          <p className="text-sm text-muted-foreground">
            Professores acompanham o andamento dos pedidos de instalação enquanto técnicos e administradores podem aprovar,
            adiar ou rejeitar solicitações.
          </p>
        </div>
      </header>

      <SoftwareRequestFilters
        filters={filters}
        sorting={sorting}
        laboratoryOptions={laboratoryOptions}
        perPage={paginationState.perPage}
      />

      <SoftwareRequestsClient
        actorId={session.user.id}
        actorRole={session.user.role}
        requests={requests}
        sorting={sorting}
        pagination={paginationState}
        statusCounts={statusCounts}
      />
    </div>
  );
}
