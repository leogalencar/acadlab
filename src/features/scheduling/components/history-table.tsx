"use client";

import { useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReservationHistoryEntry } from "@/features/scheduling/types";
import { cn } from "@/lib/utils";

interface HistoryTableProps {
  reservations: ReservationHistoryEntry[];
  actorRole: Role;
  timeZone: string;
}

const statusLabels = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  CANCELLED: "Cancelada",
} as const;

const statusStyles: Record<keyof typeof statusLabels, string> = {
  CONFIRMED: "bg-success/10 text-success-foreground",
  PENDING: "bg-warning/20 text-warning-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

type SortKey =
  | "startTime"
  | "laboratory"
  | "createdBy"
  | "status"
  | "recurrence"
  | "createdAt"
  | "cancelledAt";

interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

const PAGE_SIZE = 12;

export function HistoryTable({ reservations, actorRole, timeZone }: HistoryTableProps) {
  const canSeeAllUsers = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const [sortState, setSortState] = useState<SortState>({ key: "startTime", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortState, reservations.length]);

  const sortedReservations = useMemo(() => {
    const items = [...reservations];
    const directionFactor = sortState.direction === "asc" ? 1 : -1;

    items.sort((left, right) => {
      const leftValue = extractSortableValue(left, sortState.key);
      const rightValue = extractSortableValue(right, sortState.key);

      if (leftValue < rightValue) {
        return -1 * directionFactor;
      }
      if (leftValue > rightValue) {
        return 1 * directionFactor;
      }
      return 0;
    });

    return items;
  }, [reservations, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedReservations.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * PAGE_SIZE;
  const pageItems = sortedReservations.slice(startIndex, startIndex + PAGE_SIZE);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone,
      }),
    [timeZone],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [timeZone],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone,
      }),
    [timeZone],
  );

  const handleSort = (key: SortKey) => {
    setSortState((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        } satisfies SortState;
      }

      return { key, direction: key === "startTime" ? "desc" : "asc" } satisfies SortState;
    });
  };

  const handlePrevious = () => {
    setCurrentPage((pageValue) => Math.max(1, pageValue - 1));
  };

  const handleNext = () => {
    setCurrentPage((pageValue) => Math.min(totalPages, pageValue + 1));
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Histórico completo</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Reservas registradas</h1>
          <p className="text-sm text-muted-foreground">
            Visualize todas as reservas realizadas. Técnicos e administradores conseguem revisar as reservas de qualquer usuário.
          </p>
        </div>
      </header>

      {reservations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-10 text-center">
          <CalendarDays className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Nenhuma reserva encontrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            As reservas concluídas ou futuras aparecerão aqui assim que forem cadastradas.
          </p>
        </div>
      ) : (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Histórico de agendamentos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ordene por qualquer coluna para investigar reservas específicas. Use a paginação para navegar entre os registros.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60 text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <SortableHeader label="Data" onClick={() => handleSort("startTime")} active={sortState.key === "startTime"} direction={sortState.direction} />
                  <SortableHeader label="Horário" onClick={() => handleSort("startTime")} active={sortState.key === "startTime"} direction={sortState.direction} className="hidden sm:table-cell" />
                  <SortableHeader label="Laboratório" onClick={() => handleSort("laboratory")} active={sortState.key === "laboratory"} direction={sortState.direction} />
                  {canSeeAllUsers ? (
                    <SortableHeader
                      label="Responsável"
                      onClick={() => handleSort("createdBy")}
                      active={sortState.key === "createdBy"}
                      direction={sortState.direction}
                    />
                  ) : null}
                  <SortableHeader label="Status" onClick={() => handleSort("status")} active={sortState.key === "status"} direction={sortState.direction} />
                  <SortableHeader
                    label="Recorrência"
                    onClick={() => handleSort("recurrence")}
                    active={sortState.key === "recurrence"}
                    direction={sortState.direction}
                  />
                  <SortableHeader
                    label="Criada em"
                    onClick={() => handleSort("createdAt")}
                    active={sortState.key === "createdAt"}
                    direction={sortState.direction}
                  />
                  <SortableHeader
                    label="Cancelamento"
                    onClick={() => handleSort("cancelledAt")}
                    active={sortState.key === "cancelledAt"}
                    direction={sortState.direction}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageItems.map((reservation) => {
                  const start = new Date(reservation.startTime);
                  const end = new Date(reservation.endTime);
                  const createdAt = new Date(reservation.createdAt);
                  const cancelledAt = reservation.cancelledAt ? new Date(reservation.cancelledAt) : null;
                  const dateLabel = dateFormatter.format(start);
                  const timeLabel = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
                  const statusLabel = statusLabels[reservation.status];
                  const statusStyle = statusStyles[reservation.status];

                  return (
                    <tr key={reservation.id} className="bg-background/95">
                      <td className="px-4 py-3 text-foreground">{dateLabel}</td>
                      <td className="hidden px-4 py-3 text-foreground sm:table-cell">{timeLabel}</td>
                      <td className="px-4 py-3 text-foreground">{reservation.laboratory.name}</td>
                      {canSeeAllUsers ? (
                        <td className="px-4 py-3 text-foreground">{reservation.createdBy.name}</td>
                      ) : null}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                            statusStyle,
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {reservation.recurrenceId ? "Recorrente" : "Única"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{dateTimeFormatter.format(createdAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {cancelledAt ? (
                          <div className="flex flex-col gap-1">
                            <span>{dateTimeFormatter.format(cancelledAt)}</span>
                            {reservation.cancellationReason ? (
                              <span className="text-xs text-muted-foreground/80">{reservation.cancellationReason}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div>
              Exibindo {Math.min(sortedReservations.length, startIndex + 1)}-{Math.min(sortedReservations.length, startIndex + pageItems.length)} de {sortedReservations.length} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={page <= 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={page >= totalPages}
                className="flex items-center gap-1"
              >
                Próxima
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function extractSortableValue(reservation: ReservationHistoryEntry, key: SortKey): number | string {
  switch (key) {
    case "laboratory":
      return reservation.laboratory.name.toLowerCase();
    case "createdBy":
      return reservation.createdBy.name.toLowerCase();
    case "status":
      return reservation.status;
    case "recurrence":
      return reservation.recurrenceId ? 1 : 0;
    case "createdAt":
      return new Date(reservation.createdAt).getTime();
    case "cancelledAt":
      return reservation.cancelledAt ? new Date(reservation.cancelledAt).getTime() : 0;
    case "startTime":
    default:
      return new Date(reservation.startTime).getTime();
  }
}

interface SortableHeaderProps {
  label: string;
  onClick: () => void;
  active: boolean;
  direction: "asc" | "desc";
  className?: string;
}

function SortableHeader({ label, onClick, active, direction, className }: SortableHeaderProps) {
  return (
    <th scope="col" className={cn("px-4 py-3 font-medium text-muted-foreground", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 text-sm font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "size-3.5 transition-transform",
            active && direction === "asc" && "-scale-y-100",
          )}
          aria-hidden
        />
      </button>
    </th>
  );
}
