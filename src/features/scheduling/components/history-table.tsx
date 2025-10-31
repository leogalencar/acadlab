"use client";

import { useEffect, useMemo, useState } from "react";
import { Role, ReservationStatus } from "@prisma/client";
import { ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReservationHistoryEntry } from "@/features/scheduling/types";
import { getEndOfDayInTimeZone, getStartOfDayInTimeZone } from "@/features/scheduling/utils";
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
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "ALL">("ALL");
  const [laboratoryFilter, setLaboratoryFilter] = useState<string>("ALL");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [sortState, setSortState] = useState<SortState>({ key: "startTime", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortState, reservations.length, statusFilter, laboratoryFilter, startDateFilter, endDateFilter]);

  const laboratoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    reservations.forEach((reservation) => {
      map.set(reservation.laboratory.id, reservation.laboratory.name);
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [reservations]);

  const statusOptions: Array<{ value: "ALL" | ReservationStatus; label: string }> = useMemo(
    () => [
      { value: "ALL", label: "Todos" },
      { value: ReservationStatus.CONFIRMED, label: statusLabels.CONFIRMED },
      { value: ReservationStatus.PENDING, label: statusLabels.PENDING },
      { value: ReservationStatus.CANCELLED, label: statusLabels.CANCELLED },
    ],
    [],
  );

  const parsedStartDate = useMemo(() => {
    if (!startDateFilter) {
      return null;
    }

    try {
      return getStartOfDayInTimeZone(startDateFilter, timeZone).getTime();
    } catch {
      return null;
    }
  }, [startDateFilter, timeZone]);

  const parsedEndDate = useMemo(() => {
    if (!endDateFilter) {
      return null;
    }

    try {
      return getEndOfDayInTimeZone(endDateFilter, timeZone).getTime();
    } catch {
      return null;
    }
  }, [endDateFilter, timeZone]);

  const filteredReservations = useMemo(
    () =>
      reservations.filter((reservation) => {
        if (statusFilter !== "ALL" && reservation.status !== statusFilter) {
          return false;
        }

        if (laboratoryFilter !== "ALL" && reservation.laboratory.id !== laboratoryFilter) {
          return false;
        }

        const startTimestamp = new Date(reservation.startTime).getTime();

        if (parsedStartDate !== null && startTimestamp < parsedStartDate) {
          return false;
        }

        if (parsedEndDate !== null && startTimestamp >= parsedEndDate) {
          return false;
        }

        return true;
      }),
    [reservations, statusFilter, laboratoryFilter, parsedStartDate, parsedEndDate],
  );

  const sortedReservations = useMemo(() => {
    const items = [...filteredReservations];
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
  }, [filteredReservations, sortState]);

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

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    laboratoryFilter !== "ALL" ||
    Boolean(startDateFilter) ||
    Boolean(endDateFilter);

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setLaboratoryFilter("ALL");
    setStartDateFilter("");
    setEndDateFilter("");
  };

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
              Ordene por qualquer coluna e combine os filtros para investigar reservas específicas. Use a paginação para navegar entre os registros.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="statusFilter" className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                  Status
                </label>
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value === "ALL"
                        ? "ALL"
                        : (event.target.value as ReservationStatus),
                    )
                  }
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="laboratoryFilter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                >
                  Laboratório
                </label>
                <select
                  id="laboratoryFilter"
                  value={laboratoryFilter}
                  onChange={(event) => setLaboratoryFilter(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">Todos</option>
                  {laboratoryOptions.map((laboratory) => (
                    <option key={laboratory.id} value={laboratory.id}>
                      {laboratory.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="startDateFilter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                >
                  A partir de
                </label>
                <input
                  id="startDateFilter"
                  type="date"
                  value={startDateFilter}
                  max={endDateFilter || undefined}
                  onChange={(event) => setStartDateFilter(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="endDateFilter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                >
                  Até
                </label>
                <input
                  id="endDateFilter"
                  type="date"
                  value={endDateFilter}
                  min={startDateFilter || undefined}
                  onChange={(event) => setEndDateFilter(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-end md:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleResetFilters} disabled={!hasActiveFilters}>
                  Limpar filtros
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
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
                {pageItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canSeeAllUsers ? 8 : 7}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma reserva encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((reservation) => {
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
                      <td className="px-4 py-3 text-foreground">
                        <div className="flex flex-col">
                          <span>{reservation.laboratory.name}</span>
                          {reservation.subject ? (
                            <span className="text-xs text-muted-foreground/80">
                              Disciplina: {reservation.subject}
                            </span>
                          ) : null}
                        </div>
                      </td>
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
                        <td className="px-4 py-3 text-muted-foreground">
                          {dateTimeFormatter.format(createdAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {cancelledAt ? (
                            <div className="flex flex-col gap-1">
                              <span>{dateTimeFormatter.format(cancelledAt)}</span>
                              {reservation.cancellationReason ? (
                                <span className="text-xs text-muted-foreground/80">
                                  {reservation.cancellationReason}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/70">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
