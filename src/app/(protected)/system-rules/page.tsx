import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SystemRulesForm } from "@/features/system-rules/components/system-rules-form";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Regras do sistema",
};

export default async function SystemRulesPage() {
  const audit = createAuditSpan(
    { module: "page", action: "SystemRulesPage" },
    undefined,
    "Rendering /system-rules",
    { importance: "low", logStart: false, logSuccess: false },
  );
  const session = await auth();

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    redirect("/login?callbackUrl=/system-rules");
  }

  if (session.user.role !== Role.ADMIN) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    redirect("/dashboard");
  }

  try {
    const rules = await getSystemRules();
    const brandName = rules.branding.institutionName;
    const formKey =
      rules.updatedAt ?? `${rules.primaryColor}-${rules.secondaryColor}-${rules.accentColor}`;

    audit.success({ brandName });

    return (
      <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Configurações globais</p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Regras do sistema</h1>
          <p className="text-muted-foreground">
            Ajuste a identidade visual e os horários institucionais para alinhar o {brandName} às diretrizes da sua instituição.
          </p>
          <p className="text-xs text-muted-foreground">Baseado na plataforma AcadLab.</p>
        </div>
      </header>
        <SystemRulesForm key={formKey} rules={rules} />
      </div>
    );
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
