import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardBoard } from "@/features/dashboard/components/dashboard-board";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Painel",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const { role, id } = session.user;

  const [user, systemRules] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { name: true },
    }),
    getSystemRules(),
  ]);

  const displayName = user?.name ?? session.user.name ?? "Usuário";

  return <DashboardBoard userName={displayName} role={role} brandName={systemRules.branding.institutionName} />;
}
