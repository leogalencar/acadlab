"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/server/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleSignOut} disabled={pending}>
      {pending ? "Saindo..." : "Sair"}
    </Button>
  );
}
