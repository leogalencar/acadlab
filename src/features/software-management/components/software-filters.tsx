import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SoftwareFiltersState, SoftwareSortingState } from "@/features/software-management/types";
import { MultiCombobox } from "@/features/shared/components/multi-combobox";

interface SoftwareFiltersProps {
  filters: SoftwareFiltersState;
  sorting: SoftwareSortingState;
  supplierOptions: string[];
  perPage: number;
}

export function SoftwareFilters({ filters, sorting, supplierOptions, perPage }: SoftwareFiltersProps) {
  const hasSupplierOptions = supplierOptions.length > 0;
  const supplierComboboxOptions = supplierOptions.map((supplier) => ({
    value: supplier,
    label: supplier,
  }));

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
          </div>

          <div className="space-y-3">
            <Label>Fornecedores</Label>
            {hasSupplierOptions ? (
              <MultiCombobox
                name="supplier"
                options={supplierComboboxOptions}
                defaultValue={filters.suppliers}
                placeholder="Selecione fornecedores"
                searchPlaceholder="Pesquisar fornecedores..."
              />
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
