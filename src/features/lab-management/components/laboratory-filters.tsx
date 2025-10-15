import Link from "next/link";
import { LaboratoryStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LaboratoryFiltersState, LaboratorySortingState } from "@/features/lab-management/types";
import type { SerializableSoftware } from "@/features/software-management/types";

interface LaboratoryFiltersProps {
  filters: LaboratoryFiltersState;
  sorting: LaboratorySortingState;
  softwareOptions: SerializableSoftware[];
  perPage: number;
}

const STATUS_LABELS: Record<LaboratoryStatus, string> = {
  [LaboratoryStatus.ACTIVE]: "Ativo",
  [LaboratoryStatus.INACTIVE]: "Inativo",
};

export function LaboratoryFilters({ filters, sorting, softwareOptions, perPage }: LaboratoryFiltersProps) {
  const hasSoftwareOptions = softwareOptions.length > 0;
  const selectedStatuses = new Set(filters.statuses);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtrar laboratórios</CardTitle>
        <CardDescription>
          Combine filtros de capacidade e softwares instalados para encontrar o laboratório ideal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" method="get">
          <input type="hidden" name="sortBy" value={sorting.sortBy} />
          <input type="hidden" name="sortOrder" value={sorting.sortOrder} />
          <input type="hidden" name="perPage" value={perPage} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="search">Buscar por nome ou descrição</Label>
              <Input
                id="search"
                name="search"
                defaultValue={filters.search ?? ""}
                placeholder="Ex.: Redes, manutenção"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacidade (total de estações)</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={filters.capacity ?? ""}
                placeholder="Ex.: 40"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="updatedFrom">Atualizado a partir de</Label>
              <Input
                id="updatedFrom"
                name="updatedFrom"
                type="date"
                defaultValue={filters.updatedFrom ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="updatedTo">Atualizado até</Label>
              <Input
                id="updatedTo"
                name="updatedTo"
                type="date"
                defaultValue={filters.updatedTo ?? ""}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Status operacional</Label>
            <div className="flex flex-wrap gap-2">
              {Object.values(LaboratoryStatus).map((status) => (
                <label
                  key={status}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <input
                    type="checkbox"
                    name="status"
                    value={status}
                    defaultChecked={selectedStatuses.has(status)}
                    className="size-4 rounded border border-input accent-primary"
                  />
                  <span>{STATUS_LABELS[status]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Softwares instalados</Label>
            {hasSoftwareOptions ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {softwareOptions.map((software) => {
                  const optionId = `software-${software.id}`;
                  const isSelected = filters.softwareIds.includes(software.id);

                  return (
                    <label
                      key={software.id}
                      htmlFor={optionId}
                      className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <input
                        id={optionId}
                        name="software"
                        type="checkbox"
                        value={software.id}
                        defaultChecked={isSelected}
                        className="mt-1 size-4 rounded border border-input accent-primary"
                      />
                      <span className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {software.name} • {software.version}
                        </span>
                        {software.supplier ? (
                          <span className="text-xs">Fornecedor: {software.supplier}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cadastre softwares para habilitar filtros por instalação.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Aplicar filtros</Button>
            <Link
              href="/laboratories"
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
