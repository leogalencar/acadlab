import { prisma } from "@/lib/prisma";

export type AuditLogMetrics = {
  last24h: {
    total: number;
    error: number;
    warn: number;
    info: number;
  };
  last7dTotal: number;
  topModules: Array<{ module: string; count: number }>;
  trend: Array<{ date: string; count: number }>;
  recentErrors: Awaited<ReturnType<typeof prisma.auditLog.findMany>>;
};

function daysAgo(from: Date, days: number) {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getAuditLogMetrics(): Promise<AuditLogMetrics> {
  const now = new Date();
  const dayAgo = daysAgo(now, 1);
  const weekAgo = daysAgo(now, 7);

  const [error24h, warn24h, info24h, logsLastWeek, recentErrors, topModulesRaw] = await Promise.all([
    prisma.auditLog.count({ where: { level: "error", createdAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { level: "warn", createdAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { level: "info", createdAt: { gte: dayAgo } } }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { level: "error" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.groupBy({
      by: ["module"],
      where: { createdAt: { gte: dayAgo } },
      _count: { module: true },
      orderBy: { _count: { module: "desc" } },
      take: 5,
    }),
  ]);

  const trendMap = new Map<string, number>();
  logsLastWeek.forEach((entry) => {
    const iso = entry.createdAt.toISOString().substring(0, 10);
    trendMap.set(iso, (trendMap.get(iso) ?? 0) + 1);
  });

  const trend: Array<{ date: string; count: number }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = daysAgo(now, offset).toISOString().substring(0, 10);
    trend.push({ date, count: trendMap.get(date) ?? 0 });
  }

  return {
    last24h: {
      error: error24h,
      warn: warn24h,
      info: info24h,
      total: error24h + warn24h + info24h,
    },
    last7dTotal: logsLastWeek.length,
    topModules: topModulesRaw.map((entry) => ({ module: entry.module, count: entry._count.module })),
    trend,
    recentErrors,
  };
}
