import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SystemRulesForm } from "@/features/system-rules/components/system-rules-form";
import { getSystemRules } from "@/features/system-rules/server/queries";

export const metadata: Metadata = {
  title: "Regras do sistema • AcadLab",
};

export default async function SystemRulesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/system-rules");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const rules = await getSystemRules();
  const formKey =
    rules.updatedAt ?? `${rules.primaryColor}-${rules.secondaryColor}-${rules.accentColor}`;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Configurações globais</p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Regras do sistema</h1>
          <p className="text-muted-foreground">
            Ajuste a identidade visual e os horários institucionais para alinhar o AcadLab às regras da instituição.
          </p>
        </div>
      </header>
      <SystemRulesForm key={formKey} rules={rules} />
    </div>
  );
}
