"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";

import { AccountMenu } from "@/features/dashboard/components/account-menu";
import {
  DASHBOARD_NAV_ITEMS,
  type DashboardNavItem,
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
      DASHBOARD_NAV_ITEMS.reduce<DashboardNavItem[]>((acc, item) => {
        if (!item.roles.includes(role)) {
          return acc;
        }

        const filteredChildren = item.children?.filter((child) => {
          const allowedRoles = child.roles ?? item.roles;
          return allowedRoles.includes(role);
        });

        acc.push({
          ...item,
          children: filteredChildren,
        });

        return acc;
      }, []),
    [role],
  );

  const activeMatch = useMemo(
    () => resolveActiveNavItem(pathname, navItems),
    [pathname, navItems],
  );

  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>(() => {
    if (activeMatch?.parentId) {
      return { [activeMatch.parentId]: true };
    }
    return {};
  });

  useEffect(() => {
    if (activeMatch?.parentId) {
      setExpandedParents((current) => {
        if (current[activeMatch.parentId!]) {
          return current;
        }

        return {
          ...current,
          [activeMatch.parentId!]: true,
        };
      });
    }
  }, [activeMatch]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden border-r border-sidebar-border/70 bg-sidebar/95 px-4 py-6 text-sidebar-foreground shadow-sm backdrop-blur md:flex md:w-72 md:flex-col md:gap-6 md:overflow-y-auto md:sticky md:top-0 md:h-screen">
        <BrandingArea branding={branding} />
        <nav className="flex flex-1 flex-col gap-1 pb-8">
          {navItems.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isParentActive = activeMatch?.parentId === item.id;
            const activeChildId = isParentActive ? activeMatch?.childId ?? null : null;

            if (hasChildren) {
              return (
                <SidebarGroup
                  key={item.id}
                  item={item}
                  expanded={Boolean(expandedParents[item.id])}
                  isActive={isParentActive}
                  activeChildId={activeChildId}
                  onToggle={() =>
                    setExpandedParents((current) => ({
                      ...current,
                      [item.id]: !current[item.id],
                    }))
                  }
                />
              );
            }

            return (
              <SidebarLink
                key={item.id}
                item={item}
                isActive={isParentActive}
              />
            );
          })}
        </nav>
        <footer className="mt-auto rounded-lg border border-sidebar-border/75 bg-sidebar/80 p-4 text-xs text-sidebar-foreground/75 shadow-sm">
          <p className="font-medium text-sidebar-foreground">Precisa de acesso?</p>
          <p>Contate um administrador para habilitar novos módulos no seu perfil.</p>
          <p className="mt-2 text-[11px] text-sidebar-foreground/60">Baseado na plataforma AcadLab.</p>
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
    <div className="flex items-center gap-3 rounded-xl border border-sidebar-border/70 bg-sidebar/80 p-3 shadow-sm">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border/70 bg-background/90 shadow-sm">
          {branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={`${branding.institutionName} logo`}
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
            />
          ) : (
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              {branding.institutionName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-sidebar-foreground">{branding.institutionName}</p>
          <p className="text-xs text-sidebar-foreground/65">Gestão integrada de laboratórios</p>
        </div>
      </Link>
    </div>
  );
}

interface SidebarLinkProps {
  item: DashboardNavItem;
  isActive: boolean;
}

function SidebarLink({ item, isActive }: SidebarLinkProps) {
  const Icon = item.icon;
  const isDisabled = item.status === "coming-soon";

  if (!item.href) {
    return null;
  }

  if (isDisabled) {
    return (
      <span
        className="group grid grid-cols-[2.75rem,1fr] items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/60 opacity-70"
        aria-disabled
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-sidebar-border/70 bg-sidebar/60 text-sidebar-foreground/60">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5 text-left">
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
        "group grid grid-cols-[2.75rem,1fr] items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
          isActive
            ? "border-sidebar-primary-foreground/40 bg-sidebar-primary text-sidebar-primary-foreground"
            : "border-sidebar-border bg-sidebar/70 text-sidebar-foreground/60 group-hover:border-sidebar-foreground/40 group-hover:bg-sidebar/80 group-hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-5 w-5 transition-colors" aria-hidden />
      </span>
      <div className="flex flex-col gap-0.5 text-left leading-tight">
        <span className="text-base">{item.title}</span>
        <span className="text-xs font-normal text-sidebar-foreground/65">
          {item.description}
        </span>
      </div>
    </Link>
  );
}

interface SidebarGroupProps {
  item: DashboardNavItem;
  expanded: boolean;
  isActive: boolean;
  activeChildId: string | null;
  onToggle: () => void;
}

function SidebarGroup({ item, expanded, isActive, activeChildId, onToggle }: SidebarGroupProps) {
  const Icon = item.icon;
  const isDisabled = item.status === "coming-soon";
  const children = item.children ?? [];

  if (isDisabled) {
    return (
      <span
        className="group grid grid-cols-[2.75rem,1fr] items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/60 opacity-70"
        aria-disabled
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-sidebar-border/70 bg-sidebar/60 text-sidebar-foreground/60">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5 text-left">
          <span className="font-medium">{item.title}</span>
          <span className="text-xs">Em breve</span>
        </div>
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group grid w-full grid-cols-[2.75rem,1fr,auto] items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
            isActive
              ? "border-sidebar-primary-foreground/40 bg-sidebar-primary text-sidebar-primary-foreground"
              : "border-sidebar-border bg-sidebar/70 text-sidebar-foreground/60 group-hover:border-sidebar-foreground/40 group-hover:bg-sidebar/80 group-hover:text-sidebar-foreground",
          )}
        >
          <Icon className="h-5 w-5 transition-colors" aria-hidden />
        </span>
        <span className="flex flex-1 flex-col items-start gap-0.5 text-left leading-tight">
          <span className="text-base">{item.title}</span>
          <span className="text-xs font-normal text-sidebar-foreground/65">{item.description}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-sidebar-foreground/60 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div className={cn("space-y-1 border-l border-sidebar-border/70 pl-6", !expanded && "hidden")}>
        {children.map((child) => {
          const childIsActive = child.id === activeChildId;
          return (
            <Link
              key={child.id}
              href={child.href}
              className={cn(
                "flex items-center rounded-md px-3 py-1.5 text-sm transition-colors text-left",
                childIsActive
                  ? "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {child.title}
            </Link>
          );
        })}
      </div>
    </div>
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

interface ActiveNavMatch {
  parentId: string;
  childId?: string;
}

function resolveActiveNavItem(pathname: string, items: DashboardNavItem[]): ActiveNavMatch | null {
  let match: { parentId: string; childId?: string; hrefLength: number } | null = null;

  items.forEach((item) => {
    item.children?.forEach((child) => {
      if (isActive(pathname, child.href)) {
        const hrefLength = child.href.length;
        if (!match || hrefLength > match.hrefLength) {
          match = { parentId: item.id, childId: child.id, hrefLength };
        }
      }
    });

    if (item.href && isActive(pathname, item.href)) {
      const hrefLength = item.href.length;
      if (!match || hrefLength > match.hrefLength) {
        match = { parentId: item.id, hrefLength };
      }
    }
  });

  if (!match) {
    return null;
  }

  const { parentId, childId } = match;
  return childId ? { parentId, childId } : { parentId };
}

function buildBreadcrumbItems(segments: string[]) {
  const labelMap: Record<string, string> = {
    dashboard: "Painel",
    laboratories: "Laboratórios",
    scheduling: "Agendamentos",
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
