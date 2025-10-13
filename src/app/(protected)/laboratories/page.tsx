import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LaboratoryFilters } from "@/features/lab-management/components/laboratory-filters";
import { LaboratoriesClient } from "@/features/lab-management/components/laboratories-client";
import { buildFiltersState, getLaboratoriesWithFilters } from "@/features/lab-management/server/queries";
import { getSoftwareCatalog } from "@/features/software-management/server/queries";

export const metadata: Metadata = {
  title: "Laboratórios • AcadLab",
};

type SearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

export default async function LaboratoriesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/laboratories");
  }

  const resolvedParams = await resolveSearchParams(searchParams);
  const { filters, availableFrom, availableTo, softwareIds } = buildFiltersState(resolvedParams);

  const [laboratories, softwareCatalog] = await Promise.all([
    getLaboratoriesWithFilters({
      availableFrom,
      availableTo,
      softwareIds,
    }),
    getSoftwareCatalog(),
  ]);

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

      <LaboratoryFilters filters={filters} softwareOptions={softwareCatalog} />

      <LaboratoriesClient
        actorRole={session.user.role}
        laboratories={laboratories}
        softwareCatalog={softwareCatalog}
      />
    </div>
  );
}

async function resolveSearchParams(params: SearchParams) {
  if (!params) {
    return {} as Record<string, string | string[] | undefined>;
  }

  if (typeof (params as Promise<unknown>).then === "function") {
    return ((await params) ?? {}) as Record<string, string | string[] | undefined>;
  }

  return params;
}
