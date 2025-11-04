import Link from "next/link";
import { SoftwareRequestStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiCombobox } from "@/features/shared/components/multi-combobox";
import type { SoftwareRequestFiltersState, SoftwareRequestLaboratoryOption, SoftwareRequestSortingState } from "@/features/software-requests/types";
import { SOFTWARE_REQUEST_STATUS_LABELS } from "@/features/software-requests/types";

interface SoftwareRequestFiltersProps {
  filters: SoftwareRequestFiltersState;
  sorting: SoftwareRequestSortingState;
  laboratoryOptions: SoftwareRequestLaboratoryOption[];
  perPage: number;
}

export function SoftwareRequestFilters({ filters, sorting, laboratoryOptions, perPage }: SoftwareRequestFiltersProps) {
  const statusOptions = Object.values(SoftwareRequestStatus).map((status) => ({
    value: status,
    label: SOFTWARE_REQUEST_STATUS_LABELS[status],
  }));

  const hasLaboratoryOptions = laboratoryOptions.length > 0;
  const laboratoryComboboxOptions = laboratoryOptions.map((laboratory) => ({
    value: laboratory.id,
    label: laboratory.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtrar solicitações</CardTitle>
        <CardDescription>
          Combine busca, status e laboratório para localizar rapidamente solicitações de instalação de software.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" method="get">
          <input type="hidden" name="sortBy" value={sorting.sortBy} />
          <input type="hidden" name="sortOrder" value={sorting.sortOrder} />
          <input type="hidden" name="perPage" value={perPage} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="request-search">Buscar por software ou justificativa</Label>
              <Input
                id="request-search"
                name="search"
                defaultValue={filters.search ?? ""}
                placeholder="Ex.: editor de vídeo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="request-created-from">Criada a partir de</Label>
              <Input
                id="request-created-from"
                name="createdFrom"
                type="date"
                defaultValue={filters.createdFrom ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="request-created-to">Criada até</Label>
              <Input id="request-created-to" name="createdTo" type="date" defaultValue={filters.createdTo ?? ""} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label>Status da solicitação</Label>
              <MultiCombobox
                name="status"
                options={statusOptions}
                defaultValue={filters.statuses}
                placeholder="Selecione status"
                searchPlaceholder="Pesquisar status..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Laboratórios</Label>
              {hasLaboratoryOptions ? (
                <MultiCombobox
                  name="laboratory"
                  options={laboratoryComboboxOptions}
                  defaultValue={filters.laboratoryIds}
                  placeholder="Filtrar por laboratórios"
                  searchPlaceholder="Pesquisar laboratórios..."
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cadastre laboratórios para habilitar este filtro.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Aplicar filtros</Button>
            <Link
              href="/software-requests"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Limpar filtros
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
