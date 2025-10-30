import { Role } from "@prisma/client";
import { CalendarDays } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HistoryFilters } from "@/features/scheduling/components/history-filters";
import type {
  ReservationHistoryEntry,
  SerializableLaboratoryOption,
  SchedulableUserOption,
} from "@/features/scheduling/types";
import type { ReservationHistoryFilters } from "@/features/scheduling/server/queries";
import { cn } from "@/lib/utils";

interface HistoryTableProps {
  reservations: ReservationHistoryEntry[];
  actorRole: Role;
  filters: ReservationHistoryFilters;
  laboratories: SerializableLaboratoryOption[];
  users: SchedulableUserOption[];
  canViewAllUsers: boolean;
}

const statusLabels = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  CANCELLED: "Cancelada",
} as const;

const statusStyles: Record<keyof typeof statusLabels, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function HistoryTable({
  reservations,
  actorRole,
  filters,
  laboratories,
  users,
  canViewAllUsers,
}: HistoryTableProps) {
  const canSeeAllUsers = canViewAllUsers || actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      <HistoryFilters
        laboratories={laboratories}
        users={users}
        initialFilters={filters}
        canViewAllUsers={canViewAllUsers}
      />
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Histórico completo</p>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Reservas registradas</h2>
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
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60 text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Data</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Horário</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Laboratório</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Disciplina</th>
                  {canSeeAllUsers ? (
                    <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Responsável</th>
                  ) : null}
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Recorrência</th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Cancelamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {reservations.map((reservation) => {
                  const start = new Date(reservation.startTime);
                  const end = new Date(reservation.endTime);
                  const dateLabel = dateFormatter.format(start);
                  const timeLabel = `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
                  const statusLabel = statusLabels[reservation.status];
                  const statusStyle = statusStyles[reservation.status];

                  return (
                    <tr key={reservation.id} className="bg-background/95">
                      <td className="px-4 py-3 text-foreground">{dateLabel}</td>
                      <td className="px-4 py-3 text-foreground">{timeLabel}</td>
                      <td className="px-4 py-3 text-foreground">{reservation.laboratory.name}</td>
                      <td className="px-4 py-3 text-foreground">
                        {reservation.subject ? reservation.subject : "—"}
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
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {reservation.status === "CANCELLED"
                          ? reservation.cancelledAt
                            ? `${formatDateLabel(reservation.cancelledAt)}${reservation.cancellationReason ? ` • ${reservation.cancellationReason}` : ""}`
                            : reservation.cancellationReason ?? "Cancelada"
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDateLabel(isoString: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
    return formatter.format(new Date(isoString));
  } catch {
    return isoString;
  }
}
