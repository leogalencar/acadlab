import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { AdminLogDashboard } from "@/features/audit-log/components/admin-dashboard";
import { getAuditLogMetrics } from "@/features/audit-log/server/metrics";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Saúde do sistema",
};

export default async function SystemHealthPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/system-health");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const audit = createAuditSpan(
    { module: "page", action: "SystemHealthPage", actorId: session.user.id },
    undefined,
    "Rendering /system-health",
    { importance: "low", logStart: false, logSuccess: false },
  );

  try {
    const metrics = await getAuditLogMetrics();
    audit.success({ retrievedModules: metrics.topModules.length });

    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 rounded-lg border border-border/70 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary/80">Monitoramento</p>
            <h1 className="text-3xl font-semibold tracking-tight">Saúde do sistema</h1>
            <p className="text-sm text-muted-foreground">
              Visão consolidada dos eventos capturados pelo registro de auditoria.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm md:flex-row">
            <a
              href="/api/logs/dump"
              className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background px-4 py-2 font-medium hover:bg-muted"
            >
              Exportar SQL
            </a>
            <a
              href="/logs"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ver registros
            </a>
          </div>
        </header>
        <AdminLogDashboard metrics={metrics} />
      </div>
    );
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
