import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { UserManagementView } from "@/features/user-management/components/user-management-view";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Gestão de usuários • AcadLab",
};

export default async function UsersManagementPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/users");
  }

  const actorRole = session.user.role;
  const canManage = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;

  if (!canManage) {
    redirect("/dashboard");
  }

  const where =
    actorRole === Role.ADMIN
      ? {}
      : {
          role: Role.PROFESSOR,
        };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedUsers = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">
          Cadastro e controle de acessos
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Gestão de usuários
          </h1>
          <p className="text-muted-foreground">
            Crie contas para novos membros da equipe e mantenha os perfis atualizados de acordo com as funções desempenhadas.
          </p>
        </div>
      </header>
      <UserManagementView users={serializedUsers} actorRole={actorRole} />
    </div>
  );
}
