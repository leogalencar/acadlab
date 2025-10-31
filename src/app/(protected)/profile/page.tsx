import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }

  const [user, systemRules] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
    getSystemRules(),
  ]);

  if (!user) {
    redirect("/login");
  }

  const firstName = user.name.trim().split(" ")[0] || user.name.trim();
  const brandName = systemRules.branding.institutionName;

  return (
    <div className="flex flex-col gap-6">
      <header className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-xl border border-border/60 bg-background/90 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary/80">Olá, {firstName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas informações pessoais e credenciais de acesso ao {brandName}.
          </p>
        </div>
        <SignOutButton />
      </header>
      <div className="mx-auto w-full max-w-4xl rounded-xl border border-border/60 bg-background/90 p-6 shadow-sm">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
