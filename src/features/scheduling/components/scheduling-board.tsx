"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Role, ReservationStatus } from "@prisma/client";
import { Loader2, RefreshCw } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { idleActionState } from "@/features/shared/types";
import { CancelReservationButton } from "@/features/scheduling/components/cancel-reservation-button";
import { DatePickerCalendar } from "@/features/scheduling/components/date-picker-calendar";
import { createReservationAction } from "@/features/scheduling/server/actions";
import type {
  DailySchedule,
  LaboratoryAvailabilitySummary,
  ReservationSlot,
  SerializableLaboratoryOption,
  SchedulableUserOption,
} from "@/features/scheduling/types";
import type { AcademicPeriodRuleInput } from "@/features/system-rules/types";
import { cn } from "@/lib/utils";

interface SchedulingBoardProps {
  laboratories: SerializableLaboratoryOption[];
  selectedLaboratoryId: string;
  selectedDate: string;
  schedule: DailySchedule;
  availability: LaboratoryAvailabilitySummary;
  actorRole: Role;
  actorId: string;
  actorName: string;
  users: SchedulableUserOption[];
  academicPeriods: AcademicPeriodRuleInput[];
}

const OCCURRENCE_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export function SchedulingBoard({
  laboratories,
  selectedLaboratoryId,
  selectedDate,
  schedule,
  availability,
  actorRole,
  actorId,
  actorName,
  users,
  academicPeriods,
}: SchedulingBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [formState, formAction, isSubmitting] = useActionState(
    createReservationAction,
    idleActionState,
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: schedule.timeZone,
      }),
    [schedule.timeZone],
  );

  const selectedLaboratory = useMemo(
    () =>
      laboratories.find((laboratory) => laboratory.id === selectedLaboratoryId) ??
      laboratories[0] ??
      null,
    [laboratories, selectedLaboratoryId],
  );

  const canAssignUsers = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;

  const userOptions = useMemo(() => {
    const entries = new Map<string, { id: string; name: string; role: Role }>();
    entries.set(actorId, { id: actorId, name: actorName, role: actorRole });
    users.forEach((user) => {
      entries.set(user.id, user);
    });
    return Array.from(entries.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
  }, [actorId, actorName, actorRole, users]);

  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(actorId);
  const [subject, setSubject] = useState<string>("");
  const [selectedAcademicPeriodId, setSelectedAcademicPeriodId] = useState<string>("");

  const selectedAcademicPeriod = useMemo(
    () => academicPeriods.find((period) => period.id === selectedAcademicPeriodId),
    [academicPeriods, selectedAcademicPeriodId],
  );

  const fullyBookedDates = useMemo(
    () => availability.fullyBookedDates ?? [],
    [availability],
  );

  const fullyBookedSet = useMemo(
    () => new Set(fullyBookedDates),
    [fullyBookedDates],
  );

  const todayIso = useMemo(() => formatDateInTimeZone(new Date(), schedule.timeZone), [schedule.timeZone]);
  const isSelectedPast = selectedDate < todayIso;
  const isSelectedFullyBooked = fullyBookedSet.has(selectedDate);

  const allSlotIds = useMemo(
    () =>
      new Set(
        schedule.periods.flatMap((period) => period.slots.map((slot) => slot.id)),
      ),
    [schedule],
  );

  useEffect(() => {
    setSelectedSlots((current) => {
      const filtered = new Set([...current].filter((slotId) => allSlotIds.has(slotId)));
      return filtered;
    });
  }, [allSlotIds]);

  useEffect(() => {
    if (formState.status === "success") {
      setSelectedSlots(new Set());
      setSubject("");
      setSelectedAcademicPeriodId("");
      setSelectedOwnerId(actorId);
    }
  }, [formState.status, actorId]);

  useEffect(() => {
    setSelectedSlots(new Set());
  }, [selectedLaboratoryId, selectedDate]);

  const selectedSlotIds = useMemo(() => {
    const ids = Array.from(selectedSlots).filter((slotId) => allSlotIds.has(slotId));
    ids.sort();
    return ids;
  }, [selectedSlots, allSlotIds]);

  const handleLaboratoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLaboratoryId = event.target.value;
    const params = new URLSearchParams(searchParams?.toString());
    params.set("laboratoryId", nextLaboratoryId);
    startTransition(() => {
      router.push(`/dashboard/scheduling?${params.toString()}`);
    });
  };

  const handleDateSelect = (nextDate: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("date", nextDate);
    startTransition(() => {
      router.push(`/dashboard/scheduling?${params.toString()}`);
    });
  };

  const toggleSlotSelection = (slot: ReservationSlot) => {
    if (slot.isOccupied || slot.isPast) {
      return;
    }

    setSelectedSlots((current) => {
      const next = new Set(current);
      if (next.has(slot.id)) {
        next.delete(slot.id);
      } else {
        next.add(slot.id);
      }
      return next;
    });
  };

  const formattedDate = useMemo(() => {
    const date = fromZonedTime(`${selectedDate}T00:00:00`, schedule.timeZone);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: schedule.timeZone,
    }).format(date);
  }, [schedule.timeZone, selectedDate]);

  const canScheduleRecurrence = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const canManageAllReservations = canScheduleRecurrence;

  const selectionSummary = useMemo(() => {
    if (selectedSlotIds.length === 0) {
      return null;
    }

    const firstSlot = findSlot(schedule, selectedSlotIds[0]!);
    const lastSlot = findSlot(schedule, selectedSlotIds[selectedSlotIds.length - 1]!);

    if (!firstSlot || !lastSlot) {
      return null;
    }

    const startLabel = timeFormatter.format(new Date(firstSlot.startTime));
    const endLabel = timeFormatter.format(new Date(lastSlot.endTime));

    return `${selectedSlotIds.length} horário${selectedSlotIds.length > 1 ? "s" : ""} selecionado${
      selectedSlotIds.length > 1 ? "s" : ""
    } (${startLabel} - ${endLabel})`;
  }, [selectedSlotIds, schedule, timeFormatter]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Gestão de agendamentos</h2>
        <p className="text-sm text-muted-foreground">
          Selecione um laboratório, escolha a data no calendário e confirme os horários disponíveis.
          Técnicos e administradores podem ativar recorrência semanal em um só passo.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="laboratoryId" className="text-sm font-medium text-foreground">
              Laboratório
            </label>
            <select
              id="laboratoryId"
              name="laboratoryId"
              value={selectedLaboratoryId}
              onChange={handleLaboratoryChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isNavigating || laboratories.length === 0}
            >
              {laboratories.map((laboratory) => (
                <option key={laboratory.id} value={laboratory.id}>
                  {laboratory.name}
                </option>
              ))}
            </select>
          </div>

          {selectedLaboratory ? (
            <LaboratorySummary laboratory={selectedLaboratory} />
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Data selecionada</span>
              {isNavigating ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden /> Atualizando…
                </span>
              ) : (
                <span className="capitalize text-xs text-muted-foreground">{formattedDate}</span>
              )}
            </div>
            <DatePickerCalendar
              selectedDate={selectedDate}
              fullyBookedDates={fullyBookedDates}
              timeZone={schedule.timeZone}
              onSelect={handleDateSelect}
            />
            {isSelectedPast ? (
              <p className="text-xs font-medium text-destructive">
                Este dia já passou. Escolha uma data futura.
              </p>
            ) : isSelectedFullyBooked ? (
              <p className="text-xs font-medium text-destructive">
                Todos os horários estão reservados para esta data.
              </p>
            ) : null}
            {selectedAcademicPeriod ? (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
                <p className="font-medium">{selectedAcademicPeriod.name}</p>
                <p>
                  Vigência de {selectedAcademicPeriod.startDate} até {selectedAcademicPeriod.endDate}. As reservas serão replicadas semanalmente dentro desse intervalo.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <RefreshCw className="size-3" aria-hidden /> Regras de agendamento
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Reservas confirmadas não podem sobrepor horários ocupados.</li>
              <li>Horários passados ficam indisponíveis automaticamente.</li>
              <li>Recorrências semanais estão disponíveis para técnicos e administradores.</li>
            </ul>
          </div>
        </aside>

        <section className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="text-xl">Horários disponíveis</CardTitle>
              <p className="text-sm text-muted-foreground">
                Clique nos horários livres para adicioná-los à reserva. Horários reservados exibem o responsável atual.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {canAssignUsers ? (
                  <div className="space-y-2">
                    <label htmlFor="targetUserId" className="text-sm font-medium text-foreground">
                      Responsável pela reserva
                    </label>
                    <select
                    id="targetUserId"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={selectedOwnerId}
                      onChange={(event) => setSelectedOwnerId(event.currentTarget.value)}
                    >
                      {userOptions.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Escolha o docente responsável pelas reservas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Responsável pela reserva</p>
                    <p className="text-sm text-muted-foreground">{actorName}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium text-foreground">
                    Disciplina ou assunto
                  </label>
                  <input
                    id="subject"
                    value={subject}
                    onChange={(event) => setSubject(event.currentTarget.value)}
                    maxLength={160}
                    placeholder="Ex.: Laboratório de Programação I"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Campo opcional para facilitar a identificação da reserva na agenda.
                  </p>
                </div>
                {canAssignUsers ? (
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="academicPeriodId" className="text-sm font-medium text-foreground">
                      Período letivo
                    </label>
                    <select
                      id="academicPeriodId"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={selectedAcademicPeriodId}
                      onChange={(event) => setSelectedAcademicPeriodId(event.currentTarget.value)}
                    >
                      <option value="">Aplicar somente à data selecionada</option>
                      {academicPeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name} ({period.startDate} • {period.endDate})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Ao escolher um período letivo, a reserva será repetida semanalmente até o término definido nas regras do sistema.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Período letivo</p>
                    <p className="text-xs text-muted-foreground">
                      Solicite a um administrador para agendar períodos extensos em seu nome.
                    </p>
                  </div>
                )}
              </div>

              {schedule.periods.map((period) => (
                <div key={period.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {period.label}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {period.slots.filter((slot) => !slot.isOccupied && !slot.isPast).length} disponíveis
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {period.slots.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        isSelected={selectedSlots.has(slot.id)}
                        onToggle={() => toggleSlotSelection(slot)}
                        timeFormatter={timeFormatter}
                        currentUserId={actorId}
                        canManageAll={canManageAllReservations}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <form action={formAction} className="space-y-4">
                <input type="hidden" name="laboratoryId" value={selectedLaboratoryId} />
                <input type="hidden" name="date" value={selectedDate} />
                <input type="hidden" name="targetUserId" value={selectedOwnerId} />
                <input type="hidden" name="subject" value={subject} />
                <input type="hidden" name="academicPeriodId" value={selectedAcademicPeriodId} />
                {selectedSlotIds.map((slotId) => (
                  <input key={slotId} type="hidden" name="slotIds" value={slotId} />
                ))}

                {canScheduleRecurrence ? (
                  selectedAcademicPeriod ? (
                    <div className="space-y-2">
                      <input type="hidden" name="occurrences" value="1" />
                      <p className="text-sm font-medium text-foreground">
                        Recorrência semanal
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Será calculada automaticamente conforme o período letivo escolhido.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="occurrences" className="text-sm font-medium text-foreground">
                        Recorrência semanal
                      </label>
                      <select
                        id="occurrences"
                        name="occurrences"
                        defaultValue="1"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {OCCURRENCE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option === 1
                              ? "Não repetir"
                              : `${option} semanas (${option} reservas)`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                ) : (
                  <input type="hidden" name="occurrences" value="1" />
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectionSummary ?? "Nenhum horário selecionado."}
                  </div>
                  <Button
                    type="submit"
                    disabled={selectedSlotIds.length === 0 || isSubmitting}
                    className="sm:w-auto"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Registrando reserva…
                      </span>
                    ) : (
                      "Confirmar reserva"
                    )}
                  </Button>
                </div>

                {formState.status !== "idle" ? (
                  <div
                    role="status"
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      formState.status === "success"
                        ? "border-emerald-600/40 bg-emerald-50 text-emerald-700"
                        : "border-destructive/50 bg-destructive/10 text-destructive",
                    )}
                  >
                    {formState.message}
                  </div>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

interface SlotCardProps {
  slot: ReservationSlot;
  isSelected: boolean;
  onToggle: () => void;
  timeFormatter: Intl.DateTimeFormat;
  currentUserId: string;
  canManageAll: boolean;
}

function SlotCard({
  slot,
  isSelected,
  onToggle,
  timeFormatter,
  currentUserId,
  canManageAll,
}: SlotCardProps) {
  const isDisabled = slot.isOccupied || slot.isPast;
  const start = timeFormatter.format(new Date(slot.startTime));
  const end = timeFormatter.format(new Date(slot.endTime));
  const statusLabel = getStatusLabel(slot);
  const canCancel =
    slot.isOccupied &&
    !slot.isPast &&
    slot.reservation &&
    (canManageAll || slot.reservation.createdBy.id === currentUserId);

  const badge = slot.isOccupied ? (
    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
      Ocupado
    </span>
  ) : slot.isPast ? (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Encerrado
    </span>
  ) : isSelected ? (
    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
      Selecionado
    </span>
  ) : (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Disponível
    </span>
  );

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {start} - {end}
        </span>
        {badge}
      </div>
      <p className="text-xs text-muted-foreground">{statusLabel}</p>
      {canCancel && slot.reservation ? (
        <div className="pt-2">
          <CancelReservationButton
            reservationId={slot.reservation.id}
            hasRecurrence={Boolean(slot.reservation.recurrenceId)}
            allowSeriesCancellation={canManageAll}
            triggerLabel="Cancelar reserva"
            triggerClassName="px-0 text-sm text-destructive hover:text-destructive/80"
            variant="ghost"
          />
        </div>
      ) : null}
    </>
  );

  const classes = cn(
    "flex w-full flex-col gap-1 rounded-lg border border-border/60 px-3 py-3 text-left text-sm shadow-sm transition-all",
    isDisabled && "bg-muted/60 text-muted-foreground",
    isSelected && !isDisabled && "border-primary bg-primary/10 text-primary",
    !isSelected && !isDisabled && "hover:border-primary/70 hover:bg-primary/5",
  );

  if (isDisabled) {
    return (
      <div className={classes} aria-disabled>
        {content}
      </div>
    );
  }

  return (
    <button type="button" onClick={onToggle} className={classes}>
      {content}
    </button>
  );
}

function getStatusLabel(slot: ReservationSlot): string {
  if (slot.isOccupied && slot.reservation) {
    const owner = slot.reservation.createdBy.name;
    const statusText =
      slot.reservation.status === ReservationStatus.PENDING ? "aguardando confirmação" : "confirmada";
    return `Reservado por ${owner} (${statusText})`;
  }

  if (slot.isPast) {
    return "Horário indisponível.";
  }

  return "Horário livre para reserva.";
}

function findSlot(schedule: DailySchedule, slotId: string): ReservationSlot | null {
  for (const period of schedule.periods) {
    const match = period.slots.find((slot) => slot.id === slotId);
    if (match) {
      return match;
    }
  }

  return null;
}

interface LaboratorySummaryProps {
  laboratory: SerializableLaboratoryOption;
}

function LaboratorySummary({ laboratory }: LaboratorySummaryProps) {
  const softwareCount = laboratory.installedSoftware.length;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/95 p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Informações do laboratório</h2>
        <p className="text-xs text-muted-foreground">
          Verifique capacidade e softwares antes de confirmar a reserva.
        </p>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Capacidade</dt>
          <dd className="font-medium text-foreground">
            {laboratory.capacity}{" "}
            {laboratory.capacity === 1 ? "estação" : "estações"}
          </dd>
        </div>
        {laboratory.description ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Descrição</dt>
            <dd className="text-xs leading-snug text-muted-foreground/90">
              {laboratory.description}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Softwares instalados
        </h3>
        {softwareCount > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {laboratory.installedSoftware.map((software) => (
              <li
                key={software.id}
                className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {software.name}
                <span className="text-muted-foreground/70"> · {software.version}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhum software registrado para este laboratório.
          </p>
        )}
      </div>
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

  return formatter.format(date);
}
