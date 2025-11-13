import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { UserFilters } from "@/features/user-management/components/user-filters";
import { UserManagementView } from "@/features/user-management/components/user-management-view";
import { buildUserFiltersState, getUsersWithFilters } from "@/features/user-management/server/queries";
import { getAllowedEmailDomains } from "@/features/system-rules/server/queries";
import { resolveSearchParams, type SearchParamsLike } from "@/features/shared/search-params";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Gestão de usuários",
};

type UsersSearchParams = Record<string, string | string[] | undefined>;

export default async function UsersManagementPage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<UsersSearchParams>;
}) {
  const audit = createAuditSpan(
    { module: "page", action: "UsersManagementPage" },
    { hasSearchParams: Boolean(searchParams) },
    "Rendering /users",
    { importance: "low", logStart: false, logSuccess: false },
  );
  const session = await auth();

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    redirect("/login?callbackUrl=/users");
  }

  const actorRole = session.user.role;
  const canManage = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;

  if (!canManage) {
    audit.validationFailure({ reason: "forbidden", role: actorRole });
    redirect("/dashboard");
  }

  try {
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
    const allowedEmailDomains = await getAllowedEmailDomains();

    audit.success({ users: users.length, total });

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
          actorUserId={session.user.id}
          sorting={sorting}
          pagination={paginationState}
          availableRoles={availableRoles}
          allowedEmailDomains={allowedEmailDomains}
        />
      </div>
    );
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
