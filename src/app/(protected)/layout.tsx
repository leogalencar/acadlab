import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProtectedShell } from "@/features/dashboard/components/protected-shell";
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  const displayName = user?.name ?? session.user.name ?? "Usuário";

  return (
    <ProtectedShell role={session.user.role} userName={displayName}>
      {children}
    </ProtectedShell>
  );
}
