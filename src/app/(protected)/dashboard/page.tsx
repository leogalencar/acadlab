import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardBoard } from "@/features/dashboard/components/dashboard-board";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Painel",
};

export default async function DashboardPage() {
  const audit = createAuditSpan(
    { module: "page", action: "DashboardPage" },
    undefined,
    "Rendering /dashboard",
    { importance: "low", logStart: false, logSuccess: false },
  );
  const session = await auth();

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    redirect("/login?callbackUrl=/dashboard");
  }

  try {
    const { role, id } = session.user;

    const [user, systemRules] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: { name: true },
      }),
      getSystemRules(),
    ]);

    const displayName = user?.name ?? session.user.name ?? "Usuário";

    audit.success({ userId: session.user.id, role });
    return (
      <DashboardBoard
        userName={displayName}
        role={role}
        brandName={systemRules.branding.institutionName}
      />
    );
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
