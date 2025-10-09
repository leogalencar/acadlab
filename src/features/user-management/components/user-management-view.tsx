"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Role, UserStatus } from "@prisma/client";
import { useFormState } from "react-dom";

import {
  createUserAction,
  deleteUserAction,
  type UserManagementActionState,
  updateUserAction,
} from "@/features/user-management/server/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export interface SerializableUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

interface UserManagementViewProps {
  users: SerializableUser[];
  actorRole: Role;
}

export function UserManagementView({ users, actorRole }: UserManagementViewProps) {
  const canAssignTechnician = actorRole === Role.ADMIN;
  const creatableRoles = useMemo(() => getAssignableRoles(actorRole), [actorRole]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar novo usuário</CardTitle>
          <CardDescription>
            Defina as credenciais iniciais e o perfil de acesso. Compartilhe a senha provisória com o usuário com segurança.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserCreationForm availableRoles={creatableRoles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
          <CardDescription>
            Gerencie contas existentes de acordo com o seu perfil. {canAssignTechnician ? "Administradores podem gerenciar todos os perfis, incluindo técnicos e outros administradores." : "Técnicos podem gerenciar apenas contas de professores."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersList users={users} actorRole={actorRole} />
        </CardContent>
      </Card>
    </div>
  );
}

interface UserCreationFormProps {
  availableRoles: Role[];
}

function UserCreationForm({ availableRoles }: UserCreationFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createUserAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  if (availableRoles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Seu perfil de acesso não permite cadastrar novos usuários.
      </p>
    );
  }

  return (
    <form ref={formRef} className="space-y-6" action={formAction}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" placeholder="Nome e sobrenome" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail institucional</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="usuario@instituicao.edu.br"
            required
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="role">Perfil de acesso</Label>
          <select
            id="role"
            name="role"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            defaultValue={availableRoles[0]}
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Senha provisória</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Repita a senha"
            required
            minLength={8}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message ?? "Não foi possível cadastrar o usuário."}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full md:w-auto">
        Cadastrar usuário
      </Button>
    </form>
  );
}

interface UsersListProps {
  users: SerializableUser[];
  actorRole: Role;
}

function UsersList({ users, actorRole }: UsersListProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  if (users.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
        Nenhum usuário encontrado para o escopo do seu perfil. Ao cadastrar novos usuários eles aparecerão aqui.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {users.map((user) => (
        <li key={user.id}>
          <article className="rounded-lg border border-border/60 bg-muted/20 p-4 shadow-sm">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {ROLE_LABELS[user.role]}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_STYLES[user.status]}`}
                >
                  {STATUS_LABELS[user.status]}
                </span>
                <p className="text-xs text-muted-foreground">
                  Atualizado em {formatDate(user.updatedAt)}
                </p>
              </div>
            </header>

            <footer className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setExpandedUserId((current) => (current === user.id ? null : user.id))
                }
              >
                {expandedUserId === user.id ? "Cancelar edição" : "Editar"}
              </Button>
              <DeleteUserButton
                userId={user.id}
                disabled={!canManageRole(actorRole, user.role)}
              />
            </footer>

            {expandedUserId === user.id ? (
              <div className="mt-6 border-t border-border/50 pt-6">
                <UserEditForm
                  user={user}
                  actorRole={actorRole}
                  onSuccess={() => setExpandedUserId(null)}
                />
              </div>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

interface UserEditFormProps {
  user: SerializableUser;
  actorRole: Role;
  onSuccess: () => void;
}

function UserEditForm({ user, actorRole, onSuccess }: UserEditFormProps) {
  const availableRoles = useMemo(
    () => getAssignableRoles(actorRole, user.role),
    [actorRole, user.role],
  );

  const [state, formAction] = useFormState(updateUserAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      onSuccess();
    }
  }, [state.status, onSuccess]);

  return (
    <form ref={formRef} className="space-y-5" action={formAction}>
      <input type="hidden" name="userId" value={user.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`name-${user.id}`}>Nome completo</Label>
          <Input
            id={`name-${user.id}`}
            name="name"
            defaultValue={user.name}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`email-${user.id}`}>E-mail institucional</Label>
          <Input
            id={`email-${user.id}`}
            name="email"
            type="email"
            defaultValue={user.email}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={`role-${user.id}`}>Perfil de acesso</Label>
          <select
            id={`role-${user.id}`}
            name="role"
            defaultValue={user.role}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={availableRoles.length <= 1 && availableRoles[0] === user.role}
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`status-${user.id}`}>Status</Label>
          <select
            id={`status-${user.id}`}
            name="status"
            defaultValue={user.status}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {Object.values(UserStatus).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`password-${user.id}`}>Redefinir senha</Label>
          <Input
            id={`password-${user.id}`}
            name="password"
            type="password"
            placeholder="Opcional"
            minLength={8}
          />
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <div className="md:col-start-3">
          <Label htmlFor={`confirmPassword-${user.id}`}>Confirmar nova senha</Label>
          <Input
            id={`confirmPassword-${user.id}`}
            name="confirmPassword"
            type="password"
            placeholder="Repita a senha"
            minLength={8}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message ?? "Não foi possível atualizar o usuário."}
        </p>
      ) : null}

      <Button type="submit">Salvar alterações</Button>
    </form>
  );
}

interface DeleteUserButtonProps {
  userId: string;
  disabled: boolean;
}

function DeleteUserButton({ userId, disabled }: DeleteUserButtonProps) {
  const [feedback, setFeedback] = useState<UserManagementActionState>(initialActionState);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (disabled || isPending) {
      return;
    }

    setFeedback(initialActionState);
    const formData = new FormData();
    formData.append("userId", userId);

    startTransition(async () => {
      const result = await deleteUserAction(formData);
      setFeedback(result);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="destructive"
        disabled={disabled || isPending}
        onClick={handleDelete}
      >
        {isPending ? "Removendo..." : "Remover"}
      </Button>
      {feedback.status === "error" ? (
        <span className="text-xs text-destructive" role="alert">
          {feedback.message}
        </span>
      ) : null}
    </div>
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

function canManageRole(actorRole: Role, targetRole: Role) {
  if (actorRole === Role.ADMIN) {
    return true;
  }

  if (actorRole === Role.TECHNICIAN) {
    return targetRole === Role.PROFESSOR;
  }

  return false;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
