import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { LogsPagination } from "@/features/audit-log/components/logs-pagination";
import { LogsTable } from "@/features/audit-log/components/logs-table";
import { getAuditLogs, getDistinctLogModules } from "@/features/audit-log/server/queries";
import { createAuditSpan } from "@/lib/logging/audit";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/features/shared/table";

export const metadata: Metadata = {
  title: "Registros de auditoria",
};

type LogsSearchParams = Record<string, string | string[] | undefined>;

export default async function LogsPage({
  searchParams,
}: {
  searchParams?: Promise<LogsSearchParams> | LogsSearchParams;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/logs");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = (await searchParams) ?? {};

  const audit = createAuditSpan(
    { module: "page", action: "LogsPage" },
    { searchParams: Object.keys(resolvedSearchParams).length },
    "Rendering /logs",
    { importance: "low", logStart: false, logSuccess: false },
  );

  const level = typeof resolvedSearchParams.level === "string" ? resolvedSearchParams.level : undefined;
  const moduleFilter =
    typeof resolvedSearchParams.module === "string" ? resolvedSearchParams.module : undefined;
  const actionFilter =
    typeof resolvedSearchParams.action === "string" ? resolvedSearchParams.action : undefined;
  const search = typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : undefined;
  const from = typeof resolvedSearchParams.from === "string" ? resolvedSearchParams.from : undefined;
  const to = typeof resolvedSearchParams.to === "string" ? resolvedSearchParams.to : undefined;
  const fromTime =
    typeof resolvedSearchParams.fromTime === "string" ? resolvedSearchParams.fromTime : undefined;
  const toTime =
    typeof resolvedSearchParams.toTime === "string" ? resolvedSearchParams.toTime : undefined;
  const pageParam =
    typeof resolvedSearchParams.page === "string" ? Number.parseInt(resolvedSearchParams.page, 10) : undefined;
  const perPageParam =
    typeof resolvedSearchParams.perPage === "string"
      ? Number.parseInt(resolvedSearchParams.perPage, 10)
      : undefined;

  const page = Number.isFinite(pageParam) && (pageParam ?? 0) > 0 ? pageParam! : 1;
  const allowedPageSizes = new Set(PAGE_SIZE_OPTIONS);
  const perPage =
    Number.isFinite(perPageParam) && perPageParam && allowedPageSizes.has(perPageParam)
      ? perPageParam
      : DEFAULT_PAGE_SIZE;

  const [{ logs, pagination }, modules] = await Promise.all([
    getAuditLogs({
      level,
      module: moduleFilter,
      action: actionFilter,
      search,
      from,
      to,
      fromTime,
      toTime,
      page,
      perPage,
    }),
    getDistinctLogModules(),
  ]);

  audit.success({ returned: logs.length, page: pagination.page });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary/80">Monitoramento</p>
            <h1 className="text-3xl font-semibold tracking-tight">Registros de auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe eventos críticos da plataforma para responder rapidamente a atividades suspeitas.
            </p>
          </div>
          <a
            href="/api/logs/dump"
            className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Exportar SQL
          </a>
        </div>
      </header>

      <form className="grid gap-4 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-6" method="get">
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="perPage" value={String(pagination.perPage)} />
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Nível</span>
          <select name="level" defaultValue={level ?? ""} className="rounded-md border border-border/60 bg-background px-2 py-1">
            <option value="">Todos</option>
            <option value="error">Erro</option>
            <option value="warn">Aviso</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Módulo</span>
          <select name="module" defaultValue={moduleFilter ?? ""} className="rounded-md border border-border/60 bg-background px-2 py-1">
            <option value="">Todos</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Ação</span>
          <input
            type="text"
            name="action"
            defaultValue={actionFilter ?? ""}
            className="rounded-md border border-border/60 bg-background px-2 py-1"
            placeholder="Filtrar por ação"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Busca</span>
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            className="rounded-md border border-border/60 bg-background px-2 py-1"
            placeholder="Termo na mensagem"
          />
        </label>
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Data inicial</span>
            <input
              type="date"
              name="from"
              defaultValue={from ?? ""}
              className="rounded-md border border-border/60 bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Hora inicial</span>
            <input
              type="time"
              name="fromTime"
              defaultValue={fromTime ?? ""}
              className="rounded-md border border-border/60 bg-background px-2 py-1"
            />
          </label>
        </div>
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Data final</span>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ""}
              className="rounded-md border border-border/60 bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Hora final</span>
            <input
              type="time"
              name="toTime"
              defaultValue={toTime ?? ""}
              className="rounded-md border border-border/60 bg-background px-2 py-1"
            />
          </label>
        </div>
        <div className="md:col-span-6 flex flex-wrap justify-end gap-2">
          <a
            href="/logs"
            className="rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Limpar filtros
          </a>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Aplicar filtros
          </button>
        </div>
      </form>

      <LogsTable logs={logs} />
      <LogsPagination pagination={pagination} />
    </div>
  );
}
