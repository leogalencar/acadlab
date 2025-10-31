import { Role } from "@prisma/client";

import { DASHBOARD_MODULES } from "@/features/dashboard/constants/modules";
import { ModuleCard } from "@/features/dashboard/components/module-card";

interface DashboardBoardProps {
  userName: string;
  role: Role;
  brandName: string;
}

export function DashboardBoard({ userName, role, brandName }: DashboardBoardProps) {
  const firstName = userName.trim().split(" ")[0] || userName;
  const availableModules = DASHBOARD_MODULES.filter((module) =>
    module.roles.includes(role),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">
          Bem-vindo(a), {firstName}
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Painel de módulos</h1>
          <p className="text-muted-foreground">
            Selecione um módulo abaixo para gerenciar as rotinas do {brandName} de acordo com seu perfil de acesso.
            Para ajustar informações da sua conta, utilize o ícone de configurações no canto superior direito.
          </p>
          <p className="text-xs text-muted-foreground/80">Baseado na plataforma AcadLab.</p>
        </div>
      </header>

      {availableModules.length > 0 ? (
        <section
          aria-label="Módulos disponíveis"
          className="grid gap-4 md:grid-cols-2"
        >
          {availableModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </section>
      ) : (
        <section
          aria-label="Nenhum módulo disponível"
          className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground"
        >
          <p>
            Nenhum módulo está disponível para o seu perfil de acesso no momento. Solicite permissões adicionais ao administrador.
          </p>
        </section>
      )}
    </div>
  );
}
