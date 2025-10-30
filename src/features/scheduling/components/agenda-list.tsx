"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { CalendarDays, Clock, Info, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerCalendar, type CalendarDayState } from "@/features/scheduling/components/date-picker-calendar";
import { findNonTeachingRuleForDate } from "@/features/scheduling/utils";
import type { AgendaReservation } from "@/features/scheduling/types";
import type { NonTeachingDayRule } from "@/features/system-rules/types";

interface AgendaListProps {
  reservations: AgendaReservation[];
  actorRole: Role;
  timeZone: string;
  nonTeachingRules: NonTeachingDayRule[];
}

const statusLabels = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  CANCELLED: "Cancelada",
} as const;

export function AgendaList({ reservations, actorRole, timeZone, nonTeachingRules }: AgendaListProps) {
  const canSeeAllUsers = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, AgendaReservation[]>();
    reservations.forEach((reservation) => {
      const isoDate = formatDateInTimeZone(new Date(reservation.startTime), timeZone);
      const group = map.get(isoDate) ?? [];
      group.push(reservation);
      map.set(isoDate, group);
    });

    map.forEach((group) =>
      group.sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime()),
    );

    return map;
  }, [reservations, timeZone]);

  const todayIso = useMemo(() => formatDateInTimeZone(new Date(), timeZone), [timeZone]);

  const initialDate = useMemo(() => {
    if (reservationsByDate.size === 0) {
      return todayIso;
    }

    if (reservationsByDate.has(todayIso)) {
      return todayIso;
    }

    const sortedDates = Array.from(reservationsByDate.keys()).sort();
    return sortedDates[0]!;
  }, [reservationsByDate, todayIso]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  useEffect(() => {
    setSelectedDate((current) => (reservationsByDate.has(current) ? current : initialDate));
  }, [initialDate, reservationsByDate]);

  const selectedReservations = reservationsByDate.get(selectedDate) ?? [];
  const selectedNonTeachingRule = useMemo(
    () => findNonTeachingRuleForDate(selectedDate, nonTeachingRules),
    [selectedDate, nonTeachingRules],
  );
  const selectedDateLabel = useMemo(() => {
    const parsed = parseIsoDate(selectedDate);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone,
    }).format(parsed);
  }, [selectedDate, timeZone]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [timeZone],
  );

  const getDayState = useCallback(
    (isoDate: string): CalendarDayState | undefined => {
      const hasReservations = reservationsByDate.has(isoDate);
      const rule = findNonTeachingRuleForDate(isoDate, nonTeachingRules);

      if (!hasReservations && !rule) {
        return undefined;
      }

      if (hasReservations) {
        return {
          highlight: "reserved",
          hint: `${reservationsByDate.get(isoDate)!.length} reserva${
            reservationsByDate.get(isoDate)!.length > 1 ? "s" : ""
          } agendada${reservationsByDate.get(isoDate)!.length > 1 ? "s" : ""}`,
        } satisfies CalendarDayState;
      }

      return {
        highlight: "nonTeaching",
        hint: rule?.description?.trim()?.length ? `${rule.description} (não letivo)` : "Dia não letivo",
      } satisfies CalendarDayState;
    },
    [reservationsByDate, nonTeachingRules],
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Próximas reservas</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Minha agenda</h1>
          <p className="text-sm text-muted-foreground">
            Visualize suas reservas confirmadas por dia. Use o calendário para navegar por outros períodos.
          </p>
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
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="space-y-4 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Dia selecionado</span>
              <span className="text-xs capitalize text-muted-foreground">{selectedDateLabel}</span>
            </div>
            <DatePickerCalendar selectedDate={selectedDate} onSelect={setSelectedDate} getDayState={getDayState} />
          </aside>

          <section className="space-y-4">
            {selectedReservations.length === 0 ? (
              <Card className="border-dashed border-border/60 bg-muted/30">
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                  <Info className="size-8 text-muted-foreground/80" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      Nenhuma reserva cadastrada para {selectedDateLabel}
                    </p>
                    {selectedNonTeachingRule ? (
                      <p>
                        Dia marcado como não letivo
                        {selectedNonTeachingRule.description
                          ? ` (${selectedNonTeachingRule.description})`
                          : ""}
                        .
                      </p>
                    ) : (
                      <p>Selecione outro dia com marcador verde para visualizar suas reservas confirmadas.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              selectedReservations.map((reservation) => {
                const start = new Date(reservation.startTime);
                const end = new Date(reservation.endTime);
                const timeLabel = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
                const statusLabel = statusLabels[reservation.status];

                return (
                  <Card key={reservation.id} className="border-border/70">
                    <CardHeader className="flex flex-col gap-1">
                      <CardTitle className="text-xl text-foreground">{reservation.laboratory.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "long",
                          timeZone,
                        }).format(start)}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-4" aria-hidden />
                        <span>{timeLabel}</span>
                      </div>
                      {canSeeAllUsers ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="size-4" aria-hidden />
                          <span>
                            Responsável: <strong className="text-foreground">{reservation.createdBy.name}</strong>
                          </span>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success-foreground">
                          {statusLabel}
                        </span>
                        {reservation.recurrenceId ? (
                          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                            Reserva recorrente
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  return new Date();
}
