import Link from "next/link";
import { Role, UserStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserFiltersState, UserSortingState } from "@/features/user-management/types";

interface UserFiltersProps {
  filters: UserFiltersState;
  sorting: UserSortingState;
  perPage: number;
  availableRoles: Role[];
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: "Administrador",
  [Role.TECHNICIAN]: "Técnico",
  [Role.PROFESSOR]: "Professor",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: "Ativo",
  [UserStatus.INACTIVE]: "Inativo",
};

export function UserFilters({ filters, sorting, perPage, availableRoles }: UserFiltersProps) {
  const selectedRoles = new Set(filters.roles);
  const selectedStatuses = new Set(filters.statuses);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtrar usuários</CardTitle>
        <CardDescription>
          Busque por nome, e-mail ou utilize filtros por perfil e status para encontrar rapidamente o usuário desejado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" method="get">
          <input type="hidden" name="sortBy" value={sorting.sortBy} />
          <input type="hidden" name="sortOrder" value={sorting.sortOrder} />
          <input type="hidden" name="perPage" value={perPage} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2 md:col-span-2 lg:col-span-4">
              <Label htmlFor="search">Buscar por nome ou e-mail</Label>
              <Input
                id="search"
                name="search"
                defaultValue={filters.search ?? ""}
                placeholder="Ex.: Maria, usuario@instituicao.edu.br"
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              <Label>Perfis de acesso</Label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <input
                      type="checkbox"
                      name="role"
                      value={role}
                      defaultChecked={selectedRoles.has(role)}
                      className="size-4 rounded border border-input accent-primary"
                    />
                    <span>{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {Object.values(UserStatus).map((status) => (
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Aplicar filtros</Button>
            <Link
              href="/users"
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
