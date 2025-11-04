import type { LucideIcon } from "lucide-react";
import { ClipboardList, HardHat, LayoutDashboard, Settings, SlidersHorizontal, Users } from "lucide-react";
import { Role } from "@prisma/client";

export interface DashboardModule {
  id: string;
  title: string;
  description: string;
  href: string;
  roles: Role[];
  icon: LucideIcon;
  status?: "available" | "coming-soon";
}

export const ALL_ROLES: Role[] = [Role.ADMIN, Role.TECHNICIAN, Role.PROFESSOR];

const MODULE_USER_MANAGEMENT: DashboardModule = {
  id: "user-management",
  title: "Gestão de Usuários",
  description:
    "Cadastre professores, técnicos e administradores e mantenha os perfis de acesso atualizados.",
  href: "/users",
  roles: [Role.ADMIN, Role.TECHNICIAN],
  icon: Users,
  status: "available",
};

const MODULE_LAB_RESOURCES: DashboardModule = {
  id: "laboratory-resources",
  title: "Gestão de Laboratórios e Recursos",
  description: "Cadastre laboratórios, defina capacidades e organize responsáveis e equipamentos.",
  href: "/laboratories",
  roles: ALL_ROLES,
  icon: Settings,
  status: "available",
};

const MODULE_LAB_SCHEDULING: DashboardModule = {
  id: "laboratory-scheduling",
  title: "Agenda de Laboratórios",
  description: "Solicite, aprove ou acompanhe reservas de laboratórios em tempo real.",
  href: "/dashboard/scheduling",
  roles: ALL_ROLES,
  icon: ClipboardList,
  status: "available",
};

const MODULE_SOFTWARE: DashboardModule = {
  id: "software-maintenance",
  title: "Catálogo de Software",
  description: "Cadastre softwares disponíveis e acompanhe versões instaladas nos laboratórios.",
  href: "/software",
  roles: [Role.ADMIN, Role.TECHNICIAN],
  icon: HardHat,
  status: "available",
};

const MODULE_SYSTEM_RULES: DashboardModule = {
  id: "system-rules",
  title: "Regras do Sistema",
  description: "Configure cores institucionais e horários padrão das aulas.",
  href: "/system-rules",
  roles: [Role.ADMIN],
  icon: SlidersHorizontal,
  status: "available",
};

export const DASHBOARD_MODULES: DashboardModule[] = [
  MODULE_USER_MANAGEMENT,
  MODULE_LAB_RESOURCES,
  MODULE_LAB_SCHEDULING,
  MODULE_SOFTWARE,
  MODULE_SYSTEM_RULES,
];

export interface DashboardNavChild {
  id: string;
  title: string;
  href: string;
  description?: string;
  roles?: Role[];
}

export interface DashboardNavItem {
  id: string;
  title: string;
  description: string;
  href?: string;
  roles: Role[];
  icon: LucideIcon;
  status?: "available" | "coming-soon";
  children?: DashboardNavChild[];
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: "dashboard-overview",
    title: "Visão geral",
    description: "Resumo dos módulos e principais ações.",
    href: "/dashboard",
    roles: ALL_ROLES,
    icon: LayoutDashboard,
    status: "available",
  },
  {
    ...MODULE_USER_MANAGEMENT,
  },
  {
    ...MODULE_LAB_RESOURCES,
  },
  {
    ...MODULE_LAB_SCHEDULING,
    href: undefined,
    children: [
      {
        id: "lab-scheduling-overview",
        title: "Visão geral",
        href: "/dashboard/scheduling/overview",
        roles: [Role.ADMIN, Role.TECHNICIAN],
      },
      {
        id: "lab-scheduling-board",
        title: "Agenda de laboratórios",
        href: "/dashboard/scheduling",
      },
      {
        id: "lab-scheduling-my-agenda",
        title: "Minha agenda",
        href: "/dashboard/scheduling/agenda",
      },
      {
        id: "lab-scheduling-history",
        title: "Histórico de reservas",
        href: "/dashboard/scheduling/history",
      },
    ],
  },
  {
    ...MODULE_SOFTWARE,
  },
  {
    ...MODULE_SYSTEM_RULES,
  },
];
