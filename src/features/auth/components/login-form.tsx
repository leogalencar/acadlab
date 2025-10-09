"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthActionState } from "@/features/auth/server/actions";
import { loginAction } from "@/features/auth/server/actions";

const initialState: AuthActionState = { status: "idle" };

interface LoginFormProps {
  callbackUrl?: string;
  successMessage?: string;
}

export function LoginForm({ callbackUrl, successMessage }: LoginFormProps) {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form className="space-y-6" action={formAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

      <div className="grid gap-2">
        <Label htmlFor="email">E-mail institucional</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="professor@fatec.sp.gov.br"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message ?? "Não foi possível entrar. Verifique os dados informados."}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          {successMessage}
        </p>
      ) : null}

      <LoginButton />
    </form>
  );
}

function LoginButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}
