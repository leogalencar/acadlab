import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LaboratoryFilters } from "@/features/lab-management/components/laboratory-filters";
import { LaboratoriesClient } from "@/features/lab-management/components/laboratories-client";
import { buildFiltersState, getLaboratoriesWithFilters } from "@/features/lab-management/server/queries";
import { resolveSearchParams, type SearchParamsLike } from "@/features/shared/search-params";
import { getSoftwareCatalog } from "@/features/software-management/server/queries";

export const metadata: Metadata = {
  title: "Laboratórios • AcadLab",
};

type LaboratoriesSearchParams = Record<string, string | string[] | undefined>;

export default async function LaboratoriesPage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<LaboratoriesSearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/laboratories");
  }

  const resolvedParams = await resolveSearchParams<LaboratoriesSearchParams>(searchParams);
  const {
    filters,
    availableFrom,
    availableTo,
    softwareIds,
    statuses,
    minCapacity,
    maxCapacity,
    searchTerm,
    updatedFrom,
    updatedTo,
    sorting,
    pagination,
  } = buildFiltersState(resolvedParams);

  const [{ laboratories, total }, softwareCatalog] = await Promise.all([
    getLaboratoriesWithFilters({
      availableFrom,
      availableTo,
      softwareIds,
      statuses,
      minCapacity,
      maxCapacity,
      searchTerm,
      updatedFrom,
      updatedTo,
      sorting,
      pagination,
    }),
    getSoftwareCatalog(),
  ]);

  const paginationState = { ...pagination, total };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Gestão de infraestrutura</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Laboratórios</h1>
          <p className="text-sm text-muted-foreground">
            Visualize laboratórios disponíveis, softwares instalados e mantenha o cadastro sempre atualizado.
          </p>
        </div>
      </header>

      <LaboratoryFilters
        filters={filters}
        sorting={sorting}
        softwareOptions={softwareCatalog}
        perPage={paginationState.perPage}
      />

      <LaboratoriesClient
        actorRole={session.user.role}
        laboratories={laboratories}
        softwareCatalog={softwareCatalog}
        sorting={sorting}
        pagination={paginationState}
      />
    </div>
  );
}

