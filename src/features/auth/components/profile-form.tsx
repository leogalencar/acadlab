"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthActionState } from "@/features/auth/server/actions";
import { updateProfileAction } from "@/features/auth/server/actions";

const initialState: AuthActionState = { status: "idle" };

interface ProfileFormProps {
  user: {
    name: string;
    email: string;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  return (
    <form className="space-y-8" action={formAction}>
      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold">Informações pessoais</h2>
          <p className="text-sm text-muted-foreground">Atualize seu nome e e-mail institucional.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" name="name" defaultValue={user.name} required autoComplete="name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail institucional</Label>
            <Input id="email" name="email" type="email" defaultValue={user.email} required autoComplete="email" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold">Alterar senha</h2>
          <p className="text-sm text-muted-foreground">
            Informe a senha atual e uma nova senha com pelo menos 8 caracteres para atualizar o acesso.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
          </div>
        </div>
      </section>

      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message ?? "Não foi possível atualizar o perfil."}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          {state.message}
        </p>
      ) : null}

      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Salvando..." : "Salvar alterações"}
    </Button>
  );
}
