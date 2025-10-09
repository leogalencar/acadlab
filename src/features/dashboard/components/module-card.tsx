import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardModule } from "@/features/dashboard/constants/modules";

interface ModuleCardProps {
  module: DashboardModule;
}

export function ModuleCard({ module }: ModuleCardProps) {
  const { icon: Icon, title, description, href, status } = module;
  const isComingSoon = status === "coming-soon";

  return (
    <Card className="group relative overflow-hidden border-border/70 bg-background/80 backdrop-blur-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-border/60 bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary/15">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {isComingSoon ? (
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            Em breve
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-muted-foreground">
          {renderAllowedRoles(module)}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          variant={isComingSoon ? "outline" : "default"}
          className="w-full sm:w-auto"
          asChild={!isComingSoon}
          aria-disabled={isComingSoon}
          tabIndex={isComingSoon ? -1 : undefined}
        >
          {isComingSoon ? (
            <span>Planejamento em andamento</span>
          ) : (
            <Link href={href}>Acessar módulo</Link>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function renderAllowedRoles(module: DashboardModule) {
  const labels = new Map([
    ["ADMIN", "Administradores"],
    ["TECHNICIAN", "Técnicos"],
    ["PROFESSOR", "Professores"],
  ]);

  const roles = module.roles
    .map((role) => labels.get(role) ?? role)
    .join(" • ");

  return (
    <p aria-label="Perfis com acesso">
      <span className="font-medium text-foreground">Perfis com acesso:</span>{" "}
      {roles}
    </p>
  );
}
