import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SoftwareManagementClient } from "@/features/software-management/components/software-management-client";
import { SoftwareFilters } from "@/features/software-management/components/software-filters";
import { buildSoftwareFiltersState, getSoftwareCatalog } from "@/features/software-management/server/queries";
import { resolveSearchParams, type SearchParamsLike } from "@/features/shared/search-params";

export const metadata: Metadata = {
  title: "Catálogo de softwares",
};

type SoftwareSearchParams = Record<string, string | string[] | undefined>;

export default async function SoftwarePage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<SoftwareSearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/software");
  }

  const canManageSoftware =
    session.user.role === Role.ADMIN || session.user.role === Role.TECHNICIAN;

  if (!canManageSoftware) {
    redirect("/dashboard");
  }

  const resolvedParams = await resolveSearchParams<SoftwareSearchParams>(searchParams);
  const {
    filters,
    searchTerm,
    suppliers,
    updatedFrom,
    updatedTo,
    createdFrom,
    createdTo,
    sorting,
    pagination,
  } =
    buildSoftwareFiltersState(resolvedParams);

  const { software, total, supplierOptions } = await getSoftwareCatalog({
    searchTerm,
    suppliers,
    updatedFrom,
    updatedTo,
    createdFrom,
    createdTo,
    sorting,
    pagination,
  });

  const paginationState = { ...pagination, total };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Catálogo oficial</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Softwares</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre novas aplicações e mantenha o catálogo disponível para associação aos laboratórios.
          </p>
        </div>
      </header>

      <SoftwareFilters
        filters={filters}
        sorting={sorting}
        supplierOptions={supplierOptions}
        perPage={paginationState.perPage}
      />

      <SoftwareManagementClient
        software={software}
        sorting={sorting}
        pagination={paginationState}
      />
    </div>
  );
}
