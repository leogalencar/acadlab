import type { ComponentType, SVGProps } from "react";

import { ReservationStatus } from "@prisma/client";
import { Activity, CalendarClock, CheckCircle2, Clock4, LineChart, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SchedulingOverviewData } from "@/features/scheduling/types";
import { cn } from "@/lib/utils";

interface SchedulingOverviewProps {
  data: SchedulingOverviewData;
}

const statusBadgeClasses: Record<ReservationStatus, string> = {
  [ReservationStatus.CONFIRMED]: "bg-success/10 text-success-foreground",
  [ReservationStatus.PENDING]: "bg-warning/20 text-warning-foreground",
  [ReservationStatus.CANCELLED]: "bg-destructive/10 text-destructive",
};

export function SchedulingOverview({ data }: SchedulingOverviewProps) {
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: data.timeZone,
  });

  const weekFormatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: data.timeZone,
  });

  const maxWeeklyUsage = Math.max(1, ...data.weeklyUsage.map((entry) => entry.reservationsCount));

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Reservas em andamento"
          value={data.totals.activeNow}
          description="Confirmadas ou pendentes neste momento"
          icon={Activity}
        />
        <MetricCard
          title="Neste mês"
          value={data.totals.reservationsThisMonth}
          description="Reservas confirmadas desde o primeiro dia útil"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Canceladas"
          value={data.totals.cancelledThisMonth}
          description="Cancelamentos registrados no mês atual"
          icon={Clock4}
        />
        <MetricCard
          title="Pendentes"
          value={data.totals.pendingApproval}
          description="Reservas aguardando confirmação"
          icon={CalendarClock}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Próximas reservas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Os cinco próximos agendamentos confirmados ou pendentes, considerando o horário atual.
            </p>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reserva futura encontrada.</p>
            ) : (
              <ul className="space-y-3">
                {data.upcoming.map((reservation) => {
                  const statusClasses = statusBadgeClasses[reservation.status];
                  return (
                    <li
                      key={reservation.id}
                      className="rounded-lg border border-border/60 bg-background/95 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {reservation.laboratoryName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dateFormatter.format(new Date(reservation.startTime))}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                            statusClasses,
                          )}
                        >
                          {statusLabels[reservation.status]}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>
                          Responsável: <span className="font-medium text-foreground">{reservation.createdByName}</span>
                        </p>
                        {reservation.subject ? (
                          <p>
                            Disciplina: <span className="font-medium text-foreground">{reservation.subject}</span>
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Período letivo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure o período para automatizar agendamentos recorrentes semestrais ou bimestrais.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {data.classPeriod ? (
              <>
                <p className="text-foreground font-medium">{data.classPeriod.label}</p>
                <p>
                  Duração: {data.classPeriod.durationWeeks} semana
                  {data.classPeriod.durationWeeks > 1 ? "s" : ""}.
                </p>
                {data.classPeriod.description ? <p>{data.classPeriod.description}</p> : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                Nenhum período letivo configurado. Ajuste este parâmetro em Regras do Sistema para habilitar agendamentos completos.
              </p>
            )}
            <p className="text-xs text-muted-foreground/80">
              Última atualização: {dateFormatter.format(new Date(data.generatedAt))}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <RankingCard
          title="Laboratórios mais utilizados"
          icon={LineChart}
          emptyLabel="Nenhum uso registrado neste mês."
          entries={data.topLaboratories}
        />
        <RankingCard
          title="Maiores solicitantes"
          icon={Users}
          emptyLabel="Nenhuma solicitação registrada neste mês."
          entries={data.topRequesters}
        />
      </section>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Distribuição semanal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Total de reservas confirmadas ou pendentes para cada dia da semana atual.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.weeklyUsage.map((entry) => {
              const percentage = Math.round((entry.reservationsCount / maxWeeklyUsage) * 100);
              return (
                <div key={entry.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>{weekFormatter.format(new Date(entry.date))}</span>
                    <span>{entry.reservationsCount}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const statusLabels: Record<ReservationStatus, string> = {
  [ReservationStatus.CONFIRMED]: "Confirmada",
  [ReservationStatus.PENDING]: "Pendente",
  [ReservationStatus.CANCELLED]: "Cancelada",
};

interface MetricCardProps {
  title: string;
  value: number;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

function MetricCard({ title, value, description, icon: Icon }: MetricCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-5 text-muted-foreground/80" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground/80">{description}</p>
      </CardContent>
    </Card>
  );
}

interface RankingCardProps {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  entries: SchedulingOverviewData["topLaboratories"];
  emptyLabel: string;
}

function RankingCard({ title, icon: Icon, entries, emptyLabel }: RankingCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="size-5 text-muted-foreground/80" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry, index) => (
              <li key={entry.id} className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">#{index + 1}</span> {entry.name}
                </span>
                <span>{entry.reservationsCount}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
