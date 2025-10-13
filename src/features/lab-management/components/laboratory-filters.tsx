import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  LaboratoryFiltersState,
  SerializableSoftware,
} from "@/features/lab-management/types";

interface LaboratoryFiltersProps {
  filters: LaboratoryFiltersState;
  softwareOptions: SerializableSoftware[];
}

export function LaboratoryFilters({ filters, softwareOptions }: LaboratoryFiltersProps) {
  const hasSoftwareOptions = softwareOptions.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtrar laboratórios</CardTitle>
        <CardDescription>
          Combine filtros de disponibilidade e softwares instalados para encontrar o laboratório ideal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" method="get">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="availableFrom">Disponível a partir de</Label>
              <Input
                id="availableFrom"
                name="availableFrom"
                type="datetime-local"
                defaultValue={filters.availableFrom ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="availableTo">Disponível até</Label>
              <Input
                id="availableTo"
                name="availableTo"
                type="datetime-local"
                defaultValue={filters.availableTo ?? ""}
              />
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
              href="/dashboard/laboratories"
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
