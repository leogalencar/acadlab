import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Meu perfil • AcadLab",
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!user) {
    redirect("/login");
  }

  const firstName = user.name.trim().split(" ")[0] || user.name;

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-xl border border-border/60 bg-background/90 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary/80">Olá, {firstName}</p>
            <h1 className="text-2xl font-semibold tracking-tight">Meu perfil</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas informações pessoais e credenciais de acesso ao AcadLab.
            </p>
          </div>
          <SignOutButton />
        </header>
        <div className="rounded-xl border border-border/60 bg-background/90 p-6 shadow-sm">
          <ProfileForm user={user} />
        </div>
      </div>
    </div>
  );
}
