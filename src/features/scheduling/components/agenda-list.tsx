"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { CalendarDays, CalendarRange, Clock, Info, NotebookPen, Rows3, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelReservationButton } from "@/features/scheduling/components/cancel-reservation-button";
import { DatePickerCalendar, type CalendarDayState } from "@/features/scheduling/components/date-picker-calendar";
import {
  findNonTeachingRuleForDate,
  formatIsoDateInTimeZone,
  getIsoDateInTimeZone,
  getStartOfDayInTimeZone,
  getWeekDayInTimeZone,
} from "@/features/scheduling/utils";
import type { AgendaReservation } from "@/features/scheduling/types";
import type { NonTeachingDayRule } from "@/features/system-rules/types";
import { cn } from "@/lib/utils";

interface AgendaListProps {
  reservations: AgendaReservation[];
  actorRole: Role;
  actorId: string;
  timeZone: string;
  nonTeachingRules: NonTeachingDayRule[];
}

const statusLabels = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  CANCELLED: "Cancelada",
} as const;

type ViewMode = "list" | "calendar";

export function AgendaList({
  reservations,
  actorRole,
  actorId,
  timeZone,
  nonTeachingRules,
}: AgendaListProps) {
  const canSeeAllUsers = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, AgendaReservation[]>();
    reservations.forEach((reservation) => {
      const isoDate = getIsoDateInTimeZone(new Date(reservation.startTime), timeZone);
      const group = map.get(isoDate) ?? [];
      group.push(reservation);
      map.set(isoDate, group);
    });

    map.forEach((group) =>
      group.sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime()),
    );

    return map;
  }, [reservations, timeZone]);

  const todayIso = useMemo(() => getIsoDateInTimeZone(new Date(), timeZone), [timeZone]);

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
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    setSelectedDate((current) => (reservationsByDate.has(current) ? current : initialDate));
  }, [initialDate, reservationsByDate]);

  const weekDays = useMemo(() => {
    const startOfSelected = getStartOfDayInTimeZone(selectedDate, timeZone);
    const weekDayIndex = getWeekDayInTimeZone(selectedDate, timeZone);
    const mondayOffset = (weekDayIndex + 6) % 7;
    const mondayStart = new Date(startOfSelected.getTime() - mondayOffset * 24 * 60 * 60_000);

    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(mondayStart.getTime() + index * 24 * 60 * 60_000);
      return getIsoDateInTimeZone(current, timeZone);
    });
  }, [selectedDate, timeZone]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) {
      return "";
    }

    const firstDay = formatIsoDateInTimeZone(weekDays[0]!, timeZone, {
      day: "2-digit",
      month: "short",
    });
    const lastDay = formatIsoDateInTimeZone(weekDays[weekDays.length - 1]!, timeZone, {
      day: "2-digit",
      month: "short",
    });

    return `${firstDay} – ${lastDay}`;
  }, [weekDays, timeZone]);

  const selectedReservations = reservationsByDate.get(selectedDate) ?? [];
  const selectedNonTeachingRule = useMemo(
    () => findNonTeachingRuleForDate(selectedDate, nonTeachingRules, timeZone),
    [selectedDate, nonTeachingRules, timeZone],
  );
  const selectedDateLabel = useMemo(() => {
    return formatIsoDateInTimeZone(selectedDate, timeZone, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
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
      const rule = findNonTeachingRuleForDate(isoDate, nonTeachingRules, timeZone);

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
    [reservationsByDate, nonTeachingRules, timeZone],
  );

  const hasReservations = reservations.length > 0;

  const listView = (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-4 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Dia selecionado</span>
          <span className="text-xs capitalize text-muted-foreground">{selectedDateLabel}</span>
        </div>
        <DatePickerCalendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          getDayState={getDayState}
          timeZone={timeZone}
        />
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
                    {selectedNonTeachingRule.description ? ` (${selectedNonTeachingRule.description})` : ""}
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
            const canCancel =
              actorRole === Role.ADMIN ||
              actorRole === Role.TECHNICIAN ||
              reservation.createdBy.id === actorId;

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
                  {reservation.subject ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <NotebookPen className="size-4" aria-hidden />
                      <span>
                        Disciplina: <strong className="text-foreground">{reservation.subject}</strong>
                      </span>
                    </div>
                  ) : null}
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
                    {canCancel ? (
                      <CancelReservationButton
                        reservationId={reservation.id}
                        triggerVariant="secondary"
                        triggerSize="sm"
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );

  const calendarView = (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
        <aside className="space-y-4 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Semana em destaque</span>
            <span className="text-xs text-muted-foreground">{weekRangeLabel}</span>
          </div>
          <DatePickerCalendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            getDayState={getDayState}
            timeZone={timeZone}
          />
          <p className="text-xs text-muted-foreground">
            Use o calendário para navegar entre as semanas. Os dias com reservas confirmadas aparecem destacados em verde.
          </p>
        </aside>
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Reservas por dia na semana</h2>
            <p className="text-sm text-muted-foreground">
              Clique em qualquer cabeçalho para focar o dia selecionado e, se necessário, cancelar reservas diretamente pela visão semanal.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
            <div className="divide-y divide-border/60 md:grid md:grid-cols-7 md:divide-y-0 md:divide-x">
              {weekDays.map((dayIso) => {
                const dayReservations = reservationsByDate.get(dayIso) ?? [];
                const dayLabel = formatIsoDateInTimeZone(dayIso, timeZone, {
                  weekday: "short",
                  day: "numeric",
                });
                const fullLabel = formatIsoDateInTimeZone(dayIso, timeZone, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                });
                const nonTeachingRule = findNonTeachingRuleForDate(dayIso, nonTeachingRules, timeZone);
                const isSelectedDay = dayIso === selectedDate;

                return (
                  <div key={dayIso} className="flex min-h-[18rem] flex-col">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(dayIso)}
                      title={fullLabel}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                        isSelectedDay
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
                      )}
                    >
                      <span className="capitalize">{dayLabel}</span>
                      <span className="inline-flex items-center justify-center rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {dayReservations.length}
                      </span>
                    </button>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      {nonTeachingRule ? (
                        <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
                          Dia não letivo
                          {nonTeachingRule.description
                            ? ` (${nonTeachingRule.description})`
                            : ""}
                        </div>
                      ) : null}
                      {dayReservations.length === 0 ? (
                        <p className="text-xs text-muted-foreground/70">
                          {nonTeachingRule ? "Reservas desabilitadas" : "Sem reservas registradas."}
                        </p>
                      ) : (
                        dayReservations.map((reservation) => {
                          const start = new Date(reservation.startTime);
                          const end = new Date(reservation.endTime);
                          const statusLabel = statusLabels[reservation.status];
                          const canCancel =
                            actorRole === Role.ADMIN ||
                            actorRole === Role.TECHNICIAN ||
                            reservation.createdBy.id === actorId;
                          const timeLabel = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;

                          return (
                            <div
                              key={reservation.id}
                              className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/90 p-3 text-xs text-muted-foreground"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">
                                    {reservation.laboratory.name}
                                  </p>
                                  <p>{timeLabel}</p>
                                  {reservation.subject ? (
                                    <p>
                                      Disciplina:{" "}
                                      <span className="font-medium text-foreground">
                                        {reservation.subject}
                                      </span>
                                    </p>
                                  ) : null}
                                  {canSeeAllUsers ? (
                                    <p>
                                      Responsável:{" "}
                                      <span className="font-medium text-foreground">
                                        {reservation.createdBy.name}
                                      </span>
                                    </p>
                                  ) : null}
                                </div>
                                {canCancel ? (
                                  <CancelReservationButton
                                    reservationId={reservation.id}
                                    triggerVariant="ghost"
                                    triggerSize="sm"
                                    label="Cancelar"
                                  />
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success-foreground">
                                  {statusLabel}
                                </span>
                                {reservation.recurrenceId ? (
                                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                                    Recorrente
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary/80">Próximas reservas</p>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Minha agenda</h1>
            <p className="text-sm text-muted-foreground">
              Visualize suas reservas confirmadas por dia ou semana. Alterne entre os modos de exibição para encontrar rapidamente
              os agendamentos que precisa revisar.
            </p>
          </div>
        </div>
        {hasReservations ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background p-1 shadow-sm">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="flex items-center gap-2"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              <Rows3 className="size-4" aria-hidden />
              Lista diária
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "calendar" ? "default" : "ghost"}
              className="flex items-center gap-2"
              onClick={() => setViewMode("calendar")}
              aria-pressed={viewMode === "calendar"}
            >
              <CalendarRange className="size-4" aria-hidden />
              Calendário semanal
            </Button>
          </div>
        ) : null}
      </header>

      {!hasReservations ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-10 text-center">
          <CalendarDays className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Nenhuma reserva futura</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Assim que novas reservas forem registradas, elas aparecerão aqui. Você poderá alternar entre a visão diária e semanal.
          </p>
        </div>
      ) : viewMode === "calendar" ? (
        calendarView
      ) : (
        listView
      )}
    </div>
  );
}
