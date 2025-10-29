"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Role, ReservationStatus } from "@prisma/client";
import { CalendarDays, History, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { idleActionState } from "@/features/shared/types";
import { DatePickerCalendar } from "@/features/scheduling/components/date-picker-calendar";
import { createReservationAction } from "@/features/scheduling/server/actions";
import type {
  DailySchedule,
  ReservationSlot,
  SerializableLaboratoryOption,
} from "@/features/scheduling/types";
import { cn } from "@/lib/utils";

interface SchedulingBoardProps {
  laboratories: SerializableLaboratoryOption[];
  selectedLaboratoryId: string;
  selectedDate: string;
  schedule: DailySchedule;
  actorRole: Role;
}

const OCCURRENCE_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export function SchedulingBoard({
  laboratories,
  selectedLaboratoryId,
  selectedDate,
  schedule,
  actorRole,
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
      }),
    [],
  );

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
    }
  }, [formState.status]);

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
    const date = new Date(`${selectedDate}T00:00:00.000Z`);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date);
  }, [selectedDate]);

  const canScheduleRecurrence = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;

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
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary/80">Gestão de agendamentos</p>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Agenda de laboratórios</h1>
            <p className="text-sm text-muted-foreground">
              Selecione um laboratório, escolha a data no calendário e reserve horários disponíveis.
              Técnicos e administradores podem ativar recorrência semanal em um só passo.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/scheduling/agenda"
            className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-primary/10"
          >
            <CalendarDays className="size-4" aria-hidden />
            Minha agenda
          </Link>
          <Link
            href="/dashboard/scheduling/history"
            className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-primary/10"
          >
            <History className="size-4" aria-hidden />
            Histórico de reservas
          </Link>
        </div>
      </header>

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
            <DatePickerCalendar selectedDate={selectedDate} onSelect={handleDateSelect} />
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
                      />
                    ))}
                  </div>
                </div>
              ))}

              <form action={formAction} className="space-y-4">
                <input type="hidden" name="laboratoryId" value={selectedLaboratoryId} />
                <input type="hidden" name="date" value={selectedDate} />
                {selectedSlotIds.map((slotId) => (
                  <input key={slotId} type="hidden" name="slotIds" value={slotId} />
                ))}

                {canScheduleRecurrence ? (
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
}

function SlotCard({ slot, isSelected, onToggle, timeFormatter }: SlotCardProps) {
  const isDisabled = slot.isOccupied || slot.isPast;
  const start = timeFormatter.format(new Date(slot.startTime));
  const end = timeFormatter.format(new Date(slot.endTime));

  const statusLabel = getStatusLabel(slot);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg border border-border/60 px-3 py-3 text-left text-sm shadow-sm transition-all",
        isDisabled && "bg-muted/60 text-muted-foreground",
        isSelected && !isDisabled && "border-primary bg-primary/10 text-primary",
        !isSelected && !isDisabled && "hover:border-primary/70 hover:bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{start} - {end}</span>
        {slot.isOccupied ? (
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
        )}
      </div>
      <p className="text-xs text-muted-foreground">{statusLabel}</p>
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
