import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProtectedShell } from "@/features/dashboard/components/protected-shell";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: {
    default: "AcadLab",
    template: "%s • AcadLab",
  },
};

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [user, systemRules] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    }),
    getSystemRules(),
  ]);

  const displayName = user?.name ?? session.user.name ?? "Usuário";

  return (
    <ProtectedShell
      role={session.user.role}
      userName={displayName}
      branding={systemRules.branding}
    >
      {children}
    </ProtectedShell>
  );
}
