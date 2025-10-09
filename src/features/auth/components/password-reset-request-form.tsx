"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthActionState } from "@/features/auth/server/actions";
import { requestPasswordResetAction } from "@/features/auth/server/actions";

const initialState: AuthActionState = { status: "idle" };

export function PasswordResetRequestForm() {
  const [state, formAction] = useFormState(requestPasswordResetAction, initialState);

  return (
    <form className="space-y-6" action={formAction}>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail cadastrado</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nome.sobrenome@fatec.sp.gov.br"
        />
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message ?? "Não foi possível solicitar a recuperação de senha."}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Enviando instruções..." : "Enviar instruções"}
    </Button>
  );
}
