"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Lock } from "lucide-react";

import { AccountMenu } from "@/features/dashboard/components/account-menu";
import {
  DASHBOARD_NAV_ITEMS,
  type DashboardModule,
} from "@/features/dashboard/constants/modules";
import type { BrandingSettings } from "@/features/system-rules/types";
import { cn } from "@/lib/utils";

interface ProtectedShellProps {
  userName: string;
  role: Role;
  branding: BrandingSettings;
  children: React.ReactNode;
}

export function ProtectedShell({ userName, role, branding, children }: ProtectedShellProps) {
  const pathname = usePathname();

  const navItems = useMemo(
    () =>
      DASHBOARD_NAV_ITEMS.filter((item) => item.roles.includes(role)),
    [role],
  );

  const activeItemId = useMemo(() => {
    let match: string | null = null;
    let matchLength = 0;

    navItems.forEach((item) => {
      if (isActive(pathname, item.href)) {
        if (item.href.length > matchLength) {
          match = item.id;
          matchLength = item.href.length;
        }
      }
    });

    return match;
  }, [navItems, pathname]);

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-72 border-r border-border/60 bg-sidebar px-4 py-6 text-sidebar-foreground shadow-sm backdrop-blur md:flex md:flex-col">
        <BrandingArea branding={branding} />
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <SidebarLink
              key={item.id}
              item={item}
              isActive={item.id === activeItemId}
            />
          ))}
        </nav>
        <footer className="mt-8 rounded-lg border border-sidebar-border bg-sidebar/60 p-4 text-xs text-muted-foreground/80">
          <p className="font-medium text-sidebar-foreground">Precisa de acesso?</p>
          <p>Contate um administrador para habilitar novos módulos no seu perfil.</p>
        </footer>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-8">
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

function BrandingArea({ branding }: { branding: BrandingSettings }) {
  return (
    <div className="mb-8 flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar/50 p-3 shadow-sm">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border bg-background shadow-sm">
          {branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={`${branding.institutionName} logo`}
              width={44}
              height={44}
              className="size-11 object-contain"
            />
          ) : (
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              {branding.institutionName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground">{branding.institutionName}</p>
          <p className="text-xs text-muted-foreground/80">Gestão integrada de laboratórios</p>
        </div>
      </Link>
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
        <span className="flex size-9 items-center justify-center rounded-md border border-dashed border-sidebar-border bg-muted/40 text-muted-foreground/80">
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
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-md border transition-colors",
          isActive
            ? "border-sidebar-primary-foreground/20 bg-sidebar-primary-foreground/10 text-sidebar-primary-foreground"
            : "border-sidebar-border bg-muted/20 text-muted-foreground group-hover:text-[var(--sidebar-icon-hover)]",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex flex-col">
        <span>{item.title}</span>
        <span className="text-xs font-normal text-muted-foreground/80">{item.description}</span>
      </div>
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
    agenda: "Minha agenda",
    history: "Histórico de reservas",
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
