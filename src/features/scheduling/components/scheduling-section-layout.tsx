"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, History } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard/scheduling",
    label: "Agenda de laboratórios",
    description: "Reservar horários e consultar disponibilidade.",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/scheduling/agenda",
    label: "Minha agenda",
    description: "Próximos compromissos pessoais.",
    icon: CalendarRange,
  },
  {
    href: "/dashboard/scheduling/history",
    label: "Histórico de reservas",
    description: "Todas as reservas passadas e futuras.",
    icon: History,
  },
] as const;

interface SchedulingSectionLayoutProps {
  children: React.ReactNode;
}

export function SchedulingSectionLayout({ children }: SchedulingSectionLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-primary/80">
          Agenda de laboratórios
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Planeje, reserve e acompanhe seus laboratórios
        </h1>
        <p className="text-sm text-muted-foreground">
          Centralize suas reservas, acompanhe a agenda da equipe e revise o histórico em um só lugar.
        </p>
      </header>

      <nav
        aria-label="Seções da agenda de laboratórios"
        className="flex flex-wrap gap-3"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex min-w-[220px] flex-1 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all sm:max-w-xs",
                isActive
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-9 items-center justify-center rounded-md border text-muted-foreground transition-colors",
                  isActive
                    ? "border-primary/50 bg-primary text-primary-foreground"
                    : "border-border/60 bg-background",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-muted-foreground/80">{item.description}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="space-y-6">{children}</section>
    </div>
  );
}
