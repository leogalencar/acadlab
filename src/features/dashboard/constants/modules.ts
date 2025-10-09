import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  HardHat,
  LayoutDashboard,
  Settings,
} from "lucide-react";
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

export const DASHBOARD_MODULES: DashboardModule[] = [
  {
    id: "laboratory-resources",
    title: "Gestão de Laboratórios e Recursos",
    description: "Cadastre laboratórios, defina capacidades e organize responsáveis e equipamentos.",
    href: "/dashboard/laboratories",
    roles: [Role.ADMIN, Role.TECHNICIAN],
    icon: Settings,
    status: "coming-soon",
  },
  {
    id: "laboratory-scheduling",
    title: "Agenda de Laboratórios",
    description: "Solicite, aprove ou acompanhe reservas de laboratórios em tempo real.",
    href: "/dashboard/scheduling",
    roles: ALL_ROLES,
    icon: ClipboardList,
    status: "coming-soon",
  },
  {
    id: "software-maintenance",
    title: "Software e Manutenções",
    description: "Controle instalações de software, acompanhe pedidos e gerencie ordens de serviço.",
    href: "/dashboard/software",
    roles: ALL_ROLES,
    icon: HardHat,
    status: "coming-soon",
  },
];

export const DASHBOARD_NAV_ITEMS = [
  {
    id: "dashboard-overview",
    title: "Visão geral",
    description: "Resumo dos módulos e principais ações.",
    href: "/dashboard",
    roles: ALL_ROLES,
    icon: LayoutDashboard,
    status: "available" as const,
  },
  ...DASHBOARD_MODULES,
];
