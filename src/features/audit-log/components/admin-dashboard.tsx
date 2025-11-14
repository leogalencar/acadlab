import Link from "next/link";
import type { AuditLog } from "@prisma/client";

import { AuditLogMetrics } from "@/features/audit-log/server/metrics";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string | number;
  tone?: "info" | "warn" | "error";
  subtitle?: string;
};

function MetricCard({ label, value, tone, subtitle }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-background/80 p-4 shadow-sm",
        tone === "error" && "border-destructive/60 shadow-destructive/5",
        tone === "warn" && "border-amber-500/60 shadow-amber-500/5",
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function AdminLogDashboard({ metrics }: { metrics: AuditLogMetrics }) {
  const maxTrend = Math.max(1, ...metrics.trend.map((entry) => entry.count));
  const maxModuleCount = Math.max(1, ...metrics.topModules.map((entry) => entry.count));
  const levelTotal = Math.max(1, metrics.last24h.total);
  const levelBreakdown = [
    { label: "Erros", value: metrics.last24h.error, tone: "error" as const },
    { label: "Avisos", value: metrics.last24h.warn, tone: "warn" as const },
    { label: "Info", value: metrics.last24h.info, tone: "info" as const },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Logs nas últimas 24h" value={metrics.last24h.total} subtitle="Eventos coletados" />
        <MetricCard label="Erros 24h" value={metrics.last24h.error} tone="error" subtitle="Ações requerem atenção" />
        <MetricCard label="Avisos 24h" value={metrics.last24h.warn} tone="warn" subtitle="Verifique nos módulos" />
        <MetricCard label="Logs na última semana" value={metrics.last7dTotal} subtitle="Total capturado" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-background/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tendência semanal</h2>
            <span className="text-xs text-muted-foreground">Últimos 7 dias</span>
          </div>
          <div className="mt-6 flex h-40 items-end gap-2">
            {metrics.trend.map((entry) => {
              const height = `${(entry.count / maxTrend) * 100}%`;
              return (
                <div key={entry.date} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex h-full w-full items-end justify-center rounded-md bg-muted">
                    <span
                      className="w-3/4 rounded-md bg-primary/80 transition-all"
                      style={{ height: height === "0%" ? "4px" : height }}
                      aria-label={`${entry.count} eventos em ${entry.date}`}
                    />
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {new Date(`${entry.date}T00:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Distribuição por nível (24h)</h2>
          <div className="mt-6 space-y-4">
            {levelBreakdown.map((level) => {
              const percentage = Math.round((level.value / levelTotal) * 100);
              return (
                <div key={level.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{level.label}</span>
                    <span className="text-muted-foreground">{level.value} • {percentage}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        level.tone === "error" && "bg-destructive",
                        level.tone === "warn" && "bg-amber-500",
                        level.tone === "info" && "bg-primary/70",
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Módulos mais ativos (24h)</h2>
            <span className="text-xs text-muted-foreground">Top 5</span>
          </div>
          <ul className="mt-6 space-y-4 text-sm">
            {metrics.topModules.length === 0 ? (
              <li className="text-muted-foreground">Sem registros recentes.</li>
            ) : (
              metrics.topModules.map((entry) => (
                <li key={entry.module}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{entry.module || "(indefinido)"}</span>
                    <span className="text-muted-foreground">{entry.count} logs</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${(entry.count / maxModuleCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-background/60 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Últimos erros registrados</h2>
            <p className="text-sm text-muted-foreground">Clique em um erro para abrir o log detalhado.</p>
          </div>
          <Link
            href="/logs?level=error"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Ver todos
          </Link>
        </div>
        {metrics.recentErrors.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Sem erros recentes.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60 text-sm">
            {metrics.recentErrors.map((log: AuditLog) => (
              <li key={log.id}>
                <Link
                  href={`/logs?search=${encodeURIComponent(log.id)}`}
                  className="flex flex-col gap-1 py-3 transition hover:bg-muted/40"
                >
                  <p className="font-medium">{log.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("pt-BR")} • {log.module} / {log.action}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
