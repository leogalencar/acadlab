import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SoftwareFiltersState, SoftwareSortingState } from "@/features/software-management/types";

interface SoftwareFiltersProps {
  filters: SoftwareFiltersState;
  sorting: SoftwareSortingState;
  supplierOptions: string[];
  perPage: number;
}

export function SoftwareFilters({ filters, sorting, supplierOptions, perPage }: SoftwareFiltersProps) {
  const selectedSuppliers = new Set(filters.suppliers);
  const hasSupplierOptions = supplierOptions.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtrar softwares</CardTitle>
        <CardDescription>
          Combine busca textual, fornecedores e intervalo de atualização para localizar softwares com rapidez.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" method="get">
          <input type="hidden" name="sortBy" value={sorting.sortBy} />
          <input type="hidden" name="sortOrder" value={sorting.sortOrder} />
          <input type="hidden" name="perPage" value={perPage} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="search">Buscar por nome, versão ou fornecedor</Label>
              <Input
                id="search"
                name="search"
                defaultValue={filters.search ?? ""}
                placeholder="Ex.: Office, antivírus"
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
            <div className="grid gap-2">
              <Label htmlFor="createdFrom">Criado a partir de</Label>
              <Input
                id="createdFrom"
                name="createdFrom"
                type="date"
                defaultValue={filters.createdFrom ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="createdTo">Criado até</Label>
              <Input
                id="createdTo"
                name="createdTo"
                type="date"
                defaultValue={filters.createdTo ?? ""}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Fornecedores</Label>
            {hasSupplierOptions ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {supplierOptions.map((supplier) => {
                  const optionId = `supplier-${supplier}`;
                  const isSelected = selectedSuppliers.has(supplier);

                  return (
                    <label
                      key={supplier}
                      htmlFor={optionId}
                      className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <input
                        id={optionId}
                        name="supplier"
                        type="checkbox"
                        value={supplier}
                        defaultChecked={isSelected}
                        className="size-4 rounded border border-input accent-primary"
                      />
                      <span>{supplier}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cadastre softwares com fornecedores para habilitar este filtro.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Aplicar filtros</Button>
            <Link
              href="/software"
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
