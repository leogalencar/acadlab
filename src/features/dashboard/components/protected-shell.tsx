"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DASHBOARD_NAV_ITEMS,
  type DashboardModule,
} from "@/features/dashboard/constants/modules";
import { AccountMenu } from "@/features/dashboard/components/account-menu";

interface ProtectedShellProps {
  userName: string;
  role: Role;
  children: React.ReactNode;
}

export function ProtectedShell({ userName, role, children }: ProtectedShellProps) {
  const pathname = usePathname();

  const navItems = useMemo(
    () =>
      DASHBOARD_NAV_ITEMS.filter((item) =>
        item.roles.includes(role),
      ),
    [role],
  );

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-72 border-r border-border/60 bg-background/95 px-4 py-6 backdrop-blur md:flex md:flex-col">
        <div className="mb-8 space-y-1">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            AcadLab
          </Link>
          <p className="text-sm text-muted-foreground">
            Gestão integrada de laboratórios
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <SidebarLink
              key={item.id}
              item={item}
              isActive={isActive(pathname, item.href)}
            />
          ))}
        </nav>
        <footer className="mt-8 rounded-lg border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Precisa de acesso?</p>
          <p>Contate um administrador para habilitar novos módulos no seu perfil.</p>
        </footer>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-4 backdrop-blur md:px-8">
          <Breadcrumbs pathname={pathname} />
          <AccountMenu userName={userName} />
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

interface SidebarLinkProps {
  item: DashboardModule & { href: string; icon: LucideIcon };
  isActive: boolean;
}

function SidebarLink({ item, isActive }: SidebarLinkProps) {
  const Icon = item.icon;
  const isDisabled = item.status === "coming-soon";

  if (isDisabled) {
    return (
      <span
        className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/70 transition-opacity"
        aria-disabled
      >
        <span className="flex size-9 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/50 text-muted-foreground/80">
          <Lock className="size-4" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="font-medium">{item.title}</span>
          <span className="text-xs">Em breve</span>
        </div>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-md border",
          isActive
            ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
            : "border-border/70 bg-muted/40 text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span>{item.title}</span>
    </Link>
  );
}

interface BreadcrumbsProps {
  pathname: string;
}

function Breadcrumbs({ pathname }: BreadcrumbsProps) {
  const segments = pathname.split("/").filter(Boolean);
  const items = buildBreadcrumbItems(segments);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        if (isLast) {
          return (
            <span
              key={item.href}
              aria-current="page"
              className="font-medium text-foreground"
            >
              {item.label}
            </span>
          );
        }

        return (
          <span key={item.href} className="flex items-center gap-2">
            <Link
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
            <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
          </span>
        );
      })}
    </nav>
  );
}

function buildBreadcrumbItems(segments: string[]) {
  const labelMap: Record<string, string> = {
    dashboard: "Painel",
    laboratories: "Laboratórios",
    scheduling: "Agenda",
    software: "Softwares",
    profile: "Meu perfil",
    users: "Usuários",
    "system-rules": "Regras do sistema",
  };

  const items: Array<{ href: string; label: string }> = [];
  items.push({ href: "/dashboard", label: "Painel" });

  segments.forEach((segment, index) => {
    if (index === 0 && segment === "dashboard") {
      return;
    }

    const href = `/${segments.slice(0, index + 1).join("/")}`;
    items.push({
      href,
      label: labelMap[segment] ?? segment.replace(/-/g, " "),
    });
  });

  return items;
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname.startsWith(href);
}
