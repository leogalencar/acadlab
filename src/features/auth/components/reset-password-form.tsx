"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthActionState } from "@/features/auth/server/actions";
import { resetPasswordAction } from "@/features/auth/server/actions";
import { useServerActionToast } from "@/features/notifications/hooks/use-server-action-toast";

const initialState: AuthActionState = { status: "idle" };

interface ResetPasswordFormProps {
  token: string;
  email?: string;
}

export function ResetPasswordForm({ token, email }: ResetPasswordFormProps) {
  const [state, formAction] = useServerActionToast(
    resetPasswordAction,
    initialState,
    {
      messages: {
        pending: "Atualizando senha...",
        success: "Senha atualizada com sucesso.",
        error: "Não foi possível redefinir a senha.",
      },
    },
  );

  return (
    <form className="space-y-6" action={formAction}>
      <input type="hidden" name="token" value={token} />

      {email ? (
        <p className="rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
          Alterando a senha para <span className="font-medium text-foreground">{email}</span>.
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message ?? "Não foi possível redefinir a senha."}
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
      {pending ? "Atualizando senha..." : "Atualizar senha"}
    </Button>
  );
}
