"use client";

import { useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { CalendarDays, Clock, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelReservationButton } from "@/features/scheduling/components/cancel-reservation-button";
import { DatePickerCalendar } from "@/features/scheduling/components/date-picker-calendar";
import type { AgendaReservation } from "@/features/scheduling/types";
import { cn } from "@/lib/utils";

interface AgendaListProps {
  reservations: AgendaReservation[];
  actorRole: Role;
  currentUserId: string;
}

const statusLabels = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  CANCELLED: "Cancelada",
} as const;

export function AgendaList({ reservations, actorRole, currentUserId }: AgendaListProps) {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const canSeeAllUsers = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const canManageAll = canSeeAllUsers;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC", []);

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, AgendaReservation[]>();
    reservations.forEach((reservation) => {
      const key = new Date(reservation.startTime).toISOString().slice(0, 10);
      const existing = map.get(key);
      if (existing) {
        existing.push(reservation);
      } else {
        map.set(key, [reservation]);
      }
    });
    return map;
  }, [reservations]);

  const highlightedDates = useMemo(() => Array.from(reservationsByDate.keys()), [reservationsByDate]);
  const [selectedDate, setSelectedDate] = useState<string>(
    highlightedDates[0] ?? new Date().toISOString().slice(0, 10),
  );

  const reservationsForSelectedDate = reservationsByDate.get(selectedDate) ?? [];

  useEffect(() => {
    if (!reservationsByDate.has(selectedDate) && highlightedDates.length > 0) {
      setSelectedDate(highlightedDates[0]!);
    }
  }, [highlightedDates, reservationsByDate, selectedDate]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Próximas reservas</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Minha agenda</h2>
            <p className="text-sm text-muted-foreground">
              Consulte os próximos horários confirmados no formato que preferir.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background p-1">
            <ToggleButton
              isActive={viewMode === "list"}
              onClick={() => setViewMode("list")}
              label="Lista"
            />
            <ToggleButton
              isActive={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              label="Calendário"
            />
          </div>
        </div>
      </header>

      {reservations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-10 text-center">
          <CalendarDays className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Nenhuma reserva futura</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Assim que novas reservas forem registradas, elas aparecerão aqui.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="grid gap-4">
          {reservations.map((reservation) => {
            const start = new Date(reservation.startTime);
            const end = new Date(reservation.endTime);
            const dateLabel = dateFormatter.format(start);
            const timeLabel = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
            const statusLabel = statusLabels[reservation.status];
            const isPast = end.getTime() < Date.now();
            const canCancel = !isPast && (canManageAll || reservation.createdBy.id === currentUserId);

            return (
              <Card key={reservation.id} className="border-border/70">
                <CardHeader className="flex flex-col gap-1">
                  <CardTitle className="text-xl text-foreground">
                    {reservation.laboratory.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" aria-hidden />
                    <span>{timeLabel}</span>
                  </div>
                  {reservation.subject ? (
                    <p className="text-sm text-muted-foreground">
                      Assunto: <span className="text-foreground">{reservation.subject}</span>
                    </p>
                  ) : null}
                  {canSeeAllUsers ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="size-4" aria-hidden />
                      <span>
                        Responsável: <strong className="text-foreground">{reservation.createdBy.name}</strong>
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {statusLabel}
                    </span>
                    {reservation.recurrenceId ? (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        Reserva recorrente
                      </span>
                    ) : null}
                  </div>
                  {canCancel ? (
                    <div className="pt-1">
                      <CancelReservationButton
                        reservationId={reservation.id}
                        hasRecurrence={Boolean(reservation.recurrenceId)}
                        allowSeriesCancellation={canManageAll}
                        triggerLabel="Cancelar reserva"
                        triggerClassName="px-0 text-sm text-destructive hover:text-destructive/80"
                        variant="ghost"
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <DatePickerCalendar
            selectedDate={selectedDate}
            fullyBookedDates={[]}
            timeZone={timeZone}
            highlightedDates={highlightedDates}
            onSelect={(next) => setSelectedDate(next)}
          />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(
                new Date(`${selectedDate}T00:00:00`),
              )}
            </h3>
            {reservationsForSelectedDate.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
                Nenhuma reserva para esta data.
              </div>
            ) : (
              <div className="space-y-3">
                {reservationsForSelectedDate.map((reservation) => {
                  const start = new Date(reservation.startTime);
                  const end = new Date(reservation.endTime);
                  const timeLabel = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
                  const statusLabel = statusLabels[reservation.status];
                  const isPast = end.getTime() < Date.now();
                  const canCancel = !isPast && (canManageAll || reservation.createdBy.id === currentUserId);

                  return (
                    <div key={reservation.id} className="space-y-2 rounded-md border border-border/60 bg-background/95 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {reservation.laboratory.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeLabel}</span>
                      </div>
                      {reservation.subject ? (
                        <p className="text-xs text-muted-foreground/90">Assunto: {reservation.subject}</p>
                      ) : null}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {statusLabel}
                        </span>
                        {reservation.recurrenceId ? (
                          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                            Reserva recorrente
                          </span>
                        ) : null}
                      </div>
                      {canCancel ? (
                        <CancelReservationButton
                          reservationId={reservation.id}
                          hasRecurrence={Boolean(reservation.recurrenceId)}
                          allowSeriesCancellation={canManageAll}
                          triggerLabel="Cancelar"
                          triggerClassName="px-0 text-xs text-destructive hover:text-destructive/80"
                          variant="ghost"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
}

function ToggleButton({ isActive, onClick, label }: ToggleButtonProps) {
  return (
    <Button
      type="button"
      variant={isActive ? "default" : "ghost"}
      size="sm"
      className={cn(
        "rounded-full px-4",
        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
