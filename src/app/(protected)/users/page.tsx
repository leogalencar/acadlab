import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { UserFilters } from "@/features/user-management/components/user-filters";
import { UserManagementView } from "@/features/user-management/components/user-management-view";
import { buildUserFiltersState, getUsersWithFilters } from "@/features/user-management/server/queries";
import { resolveSearchParams, type SearchParamsLike } from "@/features/shared/search-params";

export const metadata: Metadata = {
  title: "Gestão de usuários • AcadLab",
};

type UsersSearchParams = Record<string, string | string[] | undefined>;

export default async function UsersManagementPage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<UsersSearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/users");
  }

  const actorRole = session.user.role;
  const canManage = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;

  if (!canManage) {
    redirect("/dashboard");
  }

  const resolvedParams = await resolveSearchParams<UsersSearchParams>(searchParams);
  const {
    filters,
    searchTerm,
    roles,
    statuses,
    dateFilters,
    sorting,
    pagination,
  } = buildUserFiltersState(resolvedParams);

  const { users, total } = await getUsersWithFilters({
    actorRole,
    searchTerm,
    roles,
    statuses,
    ...dateFilters,
    sorting,
    pagination,
  });

  const paginationState = { ...pagination, total };
  const availableRoles = actorRole === Role.ADMIN ? Object.values(Role) : [Role.PROFESSOR];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">
          Cadastro e controle de acessos
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Gestão de usuários
          </h1>
          <p className="text-muted-foreground">
            Crie contas para novos membros da equipe e mantenha os perfis atualizados de acordo com as funções desempenhadas.
          </p>
        </div>
      </header>
      <UserFilters
        filters={filters}
        sorting={sorting}
        perPage={paginationState.perPage}
        availableRoles={availableRoles}
      />
      <UserManagementView
        users={users}
        actorRole={actorRole}
        sorting={sorting}
        pagination={paginationState}
        availableRoles={availableRoles}
      />
    </div>
  );
}
