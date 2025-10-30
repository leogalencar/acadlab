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

export interface DashboardNavItem {
  id: string;
  title: string;
  description: string;
  href?: string;
  roles: Role[];
  icon: LucideIcon;
  status?: "available" | "coming-soon";
  children?: Array<{
    id: string;
    title: string;
    href: string;
    roles: Role[];
  }>;
}

export const ALL_ROLES: Role[] = [Role.ADMIN, Role.TECHNICIAN, Role.PROFESSOR];

export const DASHBOARD_MODULES: DashboardModule[] = [
  {
    id: "user-management",
    title: "Gestão de Usuários",
    description: "Cadastre professores, técnicos e administradores e mantenha os perfis de acesso atualizados.",
    href: "/users",
    roles: [Role.ADMIN, Role.TECHNICIAN],
    icon: Users,
    status: "available",
  },
  {
    id: "laboratory-resources",
    title: "Gestão de Laboratórios e Recursos",
    description: "Cadastre laboratórios, defina capacidades e organize responsáveis e equipamentos.",
    href: "/laboratories",
    roles: ALL_ROLES,
    icon: Settings,
    status: "available",
  },
  {
    id: "laboratory-scheduling",
    title: "Agenda de Laboratórios",
    description: "Solicite, aprove ou acompanhe reservas de laboratórios em tempo real.",
    href: "/dashboard/scheduling",
    roles: ALL_ROLES,
    icon: ClipboardList,
    status: "available",
  },
  {
    id: "software-maintenance",
    title: "Catálogo de Software",
    description: "Cadastre softwares disponíveis e acompanhe versões instaladas nos laboratórios.",
    href: "/software",
    roles: [Role.ADMIN, Role.TECHNICIAN],
    icon: HardHat,
    status: "available",
  },
  {
    id: "system-rules",
    title: "Regras do Sistema",
    description: "Configure cores institucionais e horários padrão das aulas.",
    href: "/system-rules",
    roles: [Role.ADMIN],
    icon: SlidersHorizontal,
    status: "available",
  },
];

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: "dashboard-overview",
    title: "Visão geral",
    description: "Resumo dos módulos e principais ações.",
    href: "/dashboard",
    roles: ALL_ROLES,
    icon: LayoutDashboard,
    status: "available" as const,
  },
  {
    id: "laboratory-scheduling-group",
    title: "Agenda de Laboratórios",
    description: "Solicite, aprove ou acompanhe reservas de laboratórios em tempo real.",
    roles: ALL_ROLES,
    icon: ClipboardList,
    status: "available" as const,
    children: [
      {
        id: "scheduling-board",
        title: "Agendar laboratório",
        href: "/dashboard/scheduling",
        roles: ALL_ROLES,
      },
      {
        id: "scheduling-agenda",
        title: "Minha agenda",
        href: "/dashboard/scheduling/agenda",
        roles: ALL_ROLES,
      },
      {
        id: "scheduling-history",
        title: "Histórico de reservas",
        href: "/dashboard/scheduling/history",
        roles: ALL_ROLES,
      },
      {
        id: "scheduling-overview",
        title: "Painel administrativo",
        href: "/dashboard/scheduling/overview",
        roles: [Role.ADMIN, Role.TECHNICIAN],
      },
    ],
  },
  ...DASHBOARD_MODULES.filter((module) => module.id !== "laboratory-scheduling"),
];
