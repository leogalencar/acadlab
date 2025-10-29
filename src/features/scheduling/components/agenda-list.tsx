import { Role } from "@prisma/client";
import { CalendarDays, Clock, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgendaReservation } from "@/features/scheduling/types";

interface AgendaListProps {
  reservations: AgendaReservation[];
  actorRole: Role;
}

const statusLabels = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  CANCELLED: "Cancelada",
} as const;

export function AgendaList({ reservations, actorRole }: AgendaListProps) {
  const canSeeAllUsers = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Próximas reservas</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Minha agenda</h1>
          <p className="text-sm text-muted-foreground">
            Consulte abaixo os próximos horários confirmados. Atualizações são aplicadas automaticamente após novos agendamentos.
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
        <div className="grid gap-4">
          {reservations.map((reservation) => {
            const start = new Date(reservation.startTime);
            const end = new Date(reservation.endTime);
            const dateLabel = dateFormatter.format(start);
            const timeLabel = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
            const statusLabel = statusLabels[reservation.status];

            return (
              <Card key={reservation.id} className="border-border/70">
                <CardHeader className="flex flex-col gap-1">
                  <CardTitle className="text-xl text-foreground">
                    {reservation.laboratory.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
