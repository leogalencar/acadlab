import { Role } from "@prisma/client";
import { CalendarDays, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SchedulingOverviewData } from "@/features/scheduling/server/queries";

interface SchedulingOverviewProps {
  data: SchedulingOverviewData;
  actorRole: Role;
}

export function SchedulingOverview({ data, actorRole }: SchedulingOverviewProps) {
  const canSeeAllUsers = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const upcomingFormatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary/80">Análise de utilização</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Painel de agendamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Confira os indicadores mais recentes sobre reservas, ocupação dos laboratórios e usuários mais ativos.
          </p>
        </div>
      </header>

      <section>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reservas futuras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{data.totals.upcoming}</p>
              <p className="text-xs text-muted-foreground">
                Inclui reservas confirmadas e pendentes a partir de hoje.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes de aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{data.totals.pending}</p>
              <p className="text-xs text-muted-foreground">
                Solicitações aguardando confirmação.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cancelamentos (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">
                {data.totals.cancelledLast30}
              </p>
              <p className="text-xs text-muted-foreground">
                Total de cancelamentos registrados no último mês.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Laboratórios mais utilizados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topLaboratories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma reserva encontrada no período analisado.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.topLaboratories.map((entry, index) => (
                  <li key={entry.laboratory.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/95 px-3 py-2">
                    <span className="flex items-center gap-3 text-sm text-foreground">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      {entry.laboratory.name}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {entry.reservations} reserva{entry.reservations !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Usuários mais ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canSeeAllUsers ? (
              data.topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma reserva encontrada no período analisado.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.topUsers.map((entry, index) => (
                    <li key={entry.user.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/95 px-3 py-2">
                      <span className="flex items-center gap-3 text-sm text-foreground">
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        {entry.user.name}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">
                        {entry.reservations} reserva{entry.reservations !== 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                <User className="size-8 text-muted-foreground" aria-hidden />
                <p>Somente administradores e técnicos visualizam o ranking de usuários.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Próximas reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingReservations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
                <CalendarDays className="size-8 text-muted-foreground" aria-hidden />
                <p>Nenhuma reserva futura encontrada.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.upcomingReservations.slice(0, 6).map((reservation) => (
                  <li key={reservation.id} className="rounded-md border border-border/60 bg-background/95 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{reservation.laboratory.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {upcomingFormatter.format(new Date(reservation.startTime))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Responsável: {reservation.createdBy.name}
                    </p>
                    {reservation.subject ? (
                      <p className="text-xs text-muted-foreground/90">Assunto: {reservation.subject}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
