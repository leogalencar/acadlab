"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Role, UserStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "@/features/shared/components/confirmation-dialog";
import { PAGE_SIZE_OPTIONS } from "@/features/shared/table";
import {
  createUserAction,
  deleteUserAction,
  type UserManagementActionState,
  updateUserAction,
} from "@/features/user-management/server/actions";
import type {
  SerializableUser,
  UserPaginationState,
  UserSortField,
  UserSortingState,
} from "@/features/user-management/types";

const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: "Administrador",
  [Role.TECHNICIAN]: "Técnico",
  [Role.PROFESSOR]: "Professor",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: "Ativo",
  [UserStatus.INACTIVE]: "Inativo",
};

const STATUS_BADGE_STYLES: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30",
  [UserStatus.INACTIVE]: "bg-muted text-muted-foreground border-muted-foreground/30",
};

const initialActionState: UserManagementActionState = { status: "idle" };

interface UserManagementViewProps {
  users: SerializableUser[];
  actorRole: Role;
  actorUserId: string;
  sorting: UserSortingState;
  pagination: UserPaginationState;
  availableRoles: Role[];
  allowedEmailDomains: string[];
}

export function UserManagementView({
  users,
  actorRole,
  actorUserId,
  sorting,
  pagination,
  availableRoles,
  allowedEmailDomains,
}: UserManagementViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }

    return users.find((user) => user.id === selectedUserId) ?? null;
  }, [selectedUserId, users]);

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    const exists = users.some((user) => user.id === selectedUserId);
    if (!exists) {
      setDialogOpen(false);
      setDialogMode("create");
      setSelectedUserId(null);
    }
  }, [selectedUserId, users]);

  const handleCreate = () => {
    setDialogMode("create");
    setSelectedUserId(null);
    setDialogOpen(true);
  };

  const handleRowClick = (user: SerializableUser) => {
    const canEditUser = canManageUser(actorRole, actorUserId, user);
    setDialogMode(canEditUser ? "edit" : "view");
    setSelectedUserId(user.id);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setDialogOpen(nextOpen);
    if (!nextOpen) {
      setDialogMode("create");
      setSelectedUserId(null);
      setDialogKey((key) => key + 1);
    }
  };

  const updateQueryParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const query = params.toString();
    router.push(query ? `?${query}` : "");
  };

  const handleSortChange = (field: UserSortField) => {
    const isSameField = sorting.sortBy === field;
    const nextOrder = isSameField && sorting.sortOrder === "asc" ? "desc" : "asc";

    updateQueryParams({ sortBy: field, sortOrder: nextOrder, page: null });
  };

  const handlePageChange = (page: number) => {
    updateQueryParams({ page: String(page) });
  };

  const handlePerPageChange = (perPage: number) => {
    updateQueryParams({ perPage: String(perPage), page: "1" });
  };

  const { page, perPage, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasResults = total > 0;
  const rangeStart = hasResults ? (page - 1) * perPage + 1 : 0;
  const rangeEnd = hasResults ? Math.min(total, page * perPage) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-6 text-foreground">Usuários cadastrados</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie perfis de acesso conforme suas permissões e mantenha as informações sempre atualizadas.
          </p>
        </div>
        {availableRoles.length > 0 ? (
          <Button onClick={handleCreate}>Novo usuário</Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Nome" field="name" sorting={sorting} onSort={handleSortChange} />
              <SortableHeader label="E-mail" field="email" sorting={sorting} onSort={handleSortChange} />
              <SortableHeader label="Perfil" field="role" sorting={sorting} onSort={handleSortChange} />
              <SortableHeader label="Status" field="status" sorting={sorting} onSort={handleSortChange} />
              <SortableHeader label="Atualizado em" field="updatedAt" sorting={sorting} onSort={handleSortChange} />
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => handleRowClick(user)}
                  className={cn(
                    "transition-colors",
                    canManageUser(actorRole, actorUserId, user) && "cursor-pointer hover:bg-muted/60",
                  )}
                >
                  <td className="p-4 font-medium text-foreground">{user.name}</td>
                  <td className="p-4 text-muted-foreground">{user.email}</td>
                  <td className="p-4 text-muted-foreground">{ROLE_LABELS[user.role]}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${STATUS_BADGE_STYLES[user.status]}`}
                    >
                      {STATUS_LABELS[user.status]}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {new Date(user.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 text-sm md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground">
          {hasResults
            ? `Mostrando ${rangeStart}-${rangeEnd} de ${total} usuário${total === 1 ? "" : "s"}`
            : "Nenhum usuário encontrado."}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-muted-foreground">
            Linhas por página
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
              value={perPage}
              onChange={(event) => handlePerPageChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              {PAGE_SIZE_OPTIONS.includes(perPage) ? null : (
                <option value={perPage}>{perPage}</option>
              )}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <span className="text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Próxima
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <UserDialog
        key={dialogKey}
        mode={dialogMode}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        user={selectedUser}
        actorRole={actorRole}
        actorUserId={actorUserId}
        allowedEmailDomains={allowedEmailDomains}
      />
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: UserSortField;
  sorting: UserSortingState;
  onSort: (field: UserSortField) => void;
}

function SortableHeader({ label, field, sorting, onSort }: SortableHeaderProps) {
  const isActive = sorting.sortBy === field;
  const iconRotation = isActive && sorting.sortOrder === "desc" ? "rotate-180" : "";

  return (
    <th
      className="p-3 text-left"
      scope="col"
      aria-sort={isActive ? (sorting.sortOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "flex items-center gap-1 text-xs font-medium uppercase tracking-wide",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <ChevronUp
          className={cn(
            "h-4 w-4 transition-transform",
            iconRotation,
            isActive ? "text-foreground" : "text-muted-foreground/60",
          )}
        />
      </button>
    </th>
  );
}

interface UserDialogProps {
  mode: "create" | "edit" | "view";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SerializableUser | null;
  actorRole: Role;
  actorUserId: string;
  allowedEmailDomains: string[];
}

function UserDialog({
  mode,
  open,
  onOpenChange,
  user,
  actorRole,
  actorUserId,
  allowedEmailDomains,
}: UserDialogProps) {
  const router = useRouter();
  const [deleteFeedback, setDeleteFeedback] = useState<UserManagementActionState>(initialActionState);
  const [isDeleting, startDeleting] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDeleteFeedback(initialActionState);
      setIsDeleteDialogOpen(false);
    }
    onOpenChange(nextOpen);
  };

  const isSelf = user?.id === actorUserId;
  const canDelete = mode === "edit" && user ? canManageRole(actorRole, user.role) && !isSelf : false;

  const requestDelete = () => {
    if (!user || !canDelete) {
      return;
    }
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!user || !canDelete) {
      return;
    }

    setIsDeleteDialogOpen(false);

    const formData = new FormData();
    formData.append("userId", user.id);

    setDeleteFeedback(initialActionState);
    startDeleting(async () => {
      const result = await deleteUserAction(formData);
      setDeleteFeedback(result);
      if (result.status === "success") {
        router.refresh();
        handleClose(false);
      }
    });
  };

  const titleMap: Record<UserDialogProps["mode"], string> = {
    create: "Cadastrar usuário",
    edit: user?.name ?? "Editar usuário",
    view: user?.name ?? "Usuário",
  };

  const descriptionMap: Record<UserDialogProps["mode"], string> = {
    create:
      "Informe os dados iniciais do usuário. Uma senha provisória será enviada automaticamente ao e-mail informado.",
    edit:
      "Atualize dados pessoais, perfil de acesso ou status. A redefinição de senha deve ser solicitada pelo próprio usuário na página de login.",
    view: "Consulte os dados do usuário e acompanhe histórico de criação e atualização.",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle>{titleMap[mode]}</DialogTitle>
          <DialogDescription>{descriptionMap[mode]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "view" ? (
            user ? <UserDetails user={user} /> : null
          ) : (
            <UserForm
              mode={mode}
              user={mode === "edit" ? user : null}
              actorRole={actorRole}
              actorUserId={actorUserId}
              allowedEmailDomains={allowedEmailDomains}
              onCompleted={() => {
                router.refresh();
                handleClose(false);
              }}
            />
          )}

          {mode === "edit" && user ? (
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-4">
              <p className="text-sm font-medium text-destructive">Remover usuário</p>
              <p className="text-xs text-muted-foreground">
                A remoção impede o acesso do usuário ao sistema. Essa ação não pode ser desfeita.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={requestDelete}
                disabled={!canDelete || isDeleting}
              >
                {isDeleting ? "Removendo..." : "Remover usuário"}
              </Button>
              {deleteFeedback.status === "error" ? (
                <p className="text-sm text-destructive">{deleteFeedback.message}</p>
              ) : null}
              <ConfirmationDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title="Remover usuário"
                description={`Remover o usuário ${user.name}? Esta ação não pode ser desfeita.`}
                confirmLabel="Remover"
                confirmingLabel="Removendo..."
                onConfirm={handleDelete}
                isConfirming={isDeleting}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UserFormProps {
  mode: "create" | "edit";
  user: SerializableUser | null;
  actorRole: Role;
  actorUserId: string;
  allowedEmailDomains: string[];
  onCompleted: () => void;
}

function UserForm({ mode, user, actorRole, actorUserId, allowedEmailDomains, onCompleted }: UserFormProps) {
  const [formState, formAction, isPending] = useActionState(
    mode === "create" ? createUserAction : updateUserAction,
    initialActionState,
  );
  const assignableRoles = useMemo(() => getAssignableRoles(actorRole, user?.role), [actorRole, user?.role]);
  const isSelf = user?.id === actorUserId;

  useEffect(() => {
    if (formState.status === "success") {
      onCompleted();
    }
  }, [formState.status, onCompleted]);

  if (isSelf) {
    return (
      <div role="alert" className="rounded-md bg-muted/60 p-3">
        <p className="text-sm text-muted-foreground">
          Você não pode editar os seus próprios dados por este módulo.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {mode === "edit" && user ? <input type="hidden" name="userId" value={user.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="user-name">Nome completo</Label>
          <Input
            id="user-name"
            name="name"
            defaultValue={user?.name ?? ""}
            placeholder="Nome e sobrenome"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user-email">E-mail institucional</Label>
          <Input
            id="user-email"
            name="email"
            type="email"
            defaultValue={user?.email ?? ""}
            placeholder="usuario@instituicao.edu.br"
            required
          />
          <p className="text-xs text-muted-foreground">
            {buildAllowedDomainsHint(allowedEmailDomains)}
          </p>
        </div>
      </div>

      <div className={cn("grid gap-4", mode === "edit" ? "md:grid-cols-2" : "md:grid-cols-1")}>
        <div className="grid gap-2">
          <Label htmlFor="user-role">Perfil de acesso</Label>
          <select
            id="user-role"
            name="role"
            defaultValue={mode === "edit" ? user?.role ?? undefined : assignableRoles[0]}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={assignableRoles.length <= 1}
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        {mode === "edit" ? (
          <div className="grid gap-2">
            <Label htmlFor="user-status">Status</Label>
            <select
              id="user-status"
              name="status"
              defaultValue={user?.status ?? UserStatus.ACTIVE}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.values(UserStatus).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {mode === "create" ? (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary">
          Uma senha provisória será gerada automaticamente e enviada ao e-mail informado. Oriente o usuário a redefini-la no primeiro acesso.
        </div>
      ) : (
        <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-xs text-muted-foreground">
          A redefinição de senha deve ser feita pelo próprio usuário utilizando a opção “Esqueci minha senha” na página de login.
        </div>
      )}

      {formState.status === "error" ? (
        <p className="text-sm text-destructive">{formState.message ?? "Não foi possível salvar os dados."}</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : mode === "create" ? "Cadastrar usuário" : "Salvar alterações"}
      </Button>
    </form>
  );
}

function UserDetails({ user }: { user: SerializableUser }) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/40 p-4 text-sm">
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome</span>
          <span className="font-medium text-foreground">{user.name}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mail</span>
          <span>{user.email}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Perfil</span>
          <span>{ROLE_LABELS[user.role]}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</span>
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${STATUS_BADGE_STYLES[user.status]}`}
          >
            {STATUS_LABELS[user.status]}
          </span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Criado em</span>
          <span>{new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atualizado em</span>
          <span>{new Date(user.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </section>
  );
}

function getAssignableRoles(actorRole: Role, currentRole?: Role): Role[] {
  if (actorRole === Role.ADMIN) {
    const roles = [Role.PROFESSOR, Role.TECHNICIAN, Role.ADMIN];
    return currentRole && !roles.includes(currentRole) ? [...roles, currentRole] : roles;
  }

  if (actorRole === Role.TECHNICIAN) {
    if (currentRole && currentRole !== Role.PROFESSOR) {
      return [currentRole];
    }

    return [Role.PROFESSOR];
  }

  return currentRole ? [currentRole] : [];
}

function buildAllowedDomainsHint(allowedEmailDomains: string[]): string {
  if (allowedEmailDomains.length === 0) {
    return "Nenhum domínio permitido foi configurado nas regras do sistema.";
  }

  if (allowedEmailDomains.length === 1) {
    return `Somente e-mails @${allowedEmailDomains[0]} são aceitos.`;
  }

  const formatted = allowedEmailDomains.map((domain) => `@${domain}`).join(", ");
  return `Domínios permitidos: ${formatted}.`;
}

function canManageRole(actorRole: Role, targetRole: Role) {
  if (actorRole === Role.ADMIN) {
    return true;
  }

  if (actorRole === Role.TECHNICIAN) {
    return targetRole === Role.PROFESSOR;
  }

  return false;
}

/**
 * Determines whether the actor can manage a specific user account. Management is denied when
 * the target user matches the actor to enforce the self-management restriction, even if the
 * actor has a role that would otherwise grant permission (e.g., admin editing admin).
 */
function canManageUser(actorRole: Role, actorUserId: string, user: SerializableUser) {
  if (user.id === actorUserId) {
    return false;
  }

  return canManageRole(actorRole, user.role);
}
