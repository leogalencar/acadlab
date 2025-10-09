"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/server/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "Saindo..." : "Sair"}
    </Button>
  );
}
