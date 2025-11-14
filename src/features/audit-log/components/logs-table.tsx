"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AuditLog } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";

type LogsTableProps = {
  logs: AuditLog[];
};

const LEVEL_STYLES: Record<string, string> = {
  error: "bg-destructive/10 text-destructive border-destructive/40",
  warn: "bg-amber-500/10 text-amber-700 border-amber-500/40",
  info: "bg-primary/10 text-primary border-primary/40",
};

export function LogsTable({ logs }: LogsTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);

  const handleRowClick = (log: AuditLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setDialogOpen(nextOpen);
    if (!nextOpen) {
      setSelectedLog(null);
    }
  };

  const metadataPreview = useMemo(() => {
    if (!selectedLog?.metadata) {
      return null;
    }
    try {
      return JSON.stringify(selectedLog.metadata, null, 2);
    } catch {
      return String(selectedLog.metadata);
    }
  }, [selectedLog]);

  const dialogTimestamp = selectedLog
    ? formatDate(selectedLog.createdAt, {
        options: {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      })
    : "";

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
        Nenhum registro encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Data / Hora</th>
              <th className="px-4 py-3 text-left font-medium">Nível</th>
              <th className="px-4 py-3 text-left font-medium">Módulo</th>
              <th className="px-4 py-3 text-left font-medium">Ação</th>
              <th className="px-4 py-3 text-left font-medium">Usuário</th>
              <th className="px-4 py-3 text-left font-medium">Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const levelStyle = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
              const timestamp = formatDate(log.createdAt, {
                options: {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                },
              });

              return (
                <tr
                  key={log.id}
                  onClick={() => handleRowClick(log)}
                  className="cursor-pointer border-t border-border/40 transition hover:bg-muted/40"
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground">{timestamp}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase", levelStyle)}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{log.module}</td>
                  <td className="px-4 py-3 text-muted-foreground">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.actorId ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <span className="block max-w-[320px] truncate">{log.message}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="w-full max-h-[90vh] max-w-[90vw] sm:max-w-[75vw] lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do log</DialogTitle>
            {selectedLog ? (
              <DialogDescription>
                Registrado em {dialogTimestamp} • {selectedLog.module} / {selectedLog.action}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {selectedLog ? (
            <div className="max-h-[calc(90vh_-_12rem)] space-y-4 overflow-y-auto pr-2 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <DetailField label="Log ID" value={<code className="rounded bg-muted/40 px-2 py-1">{selectedLog.id}</code>} />
                <DetailField label="Nível" value={selectedLog.level} />
                <DetailField label="Módulo" value={selectedLog.module} />
                <DetailField label="Ação" value={selectedLog.action} />
                <DetailField label="Usuário" value={selectedLog.actorId ?? "—"} />
                <DetailField label="Registrado em" value={dialogTimestamp} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Mensagem</p>
                <p className="mt-2 rounded-md border border-border/60 bg-muted/10 p-3 text-sm text-foreground">
                  {selectedLog.message}
                </p>
              </div>
              {metadataPreview ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Metadados</p>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    {metadataPreview}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/40 bg-muted/20 p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
