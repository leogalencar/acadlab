import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SoftwareManagementClient } from "@/features/software-management/components/software-management-client";
import { getSoftwareCatalog } from "@/features/software-management/server/queries";

export const metadata: Metadata = {
  title: "Catálogo de softwares • AcadLab",
};

export default async function SoftwarePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/software");
  }

  if (![Role.ADMIN, Role.TECHNICIAN].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const software = await getSoftwareCatalog();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Catálogo oficial</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Softwares</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre novas aplicações e mantenha o catálogo disponível para associação aos laboratórios.
          </p>
        </div>
      </header>

      <SoftwareManagementClient software={software} />
    </div>
  );
}
