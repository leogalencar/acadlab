"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { idleActionState } from "@/features/shared/types";
import {
  DatePickerCalendar,
  type CalendarDayState,
} from "@/features/scheduling/components/date-picker-calendar";
import { AssignClassPeriodDialog } from "@/features/scheduling/components/assign-class-period-dialog";
import { createReservationAction } from "@/features/scheduling/server/actions";
import type {
  AcademicPeriodSummary,
  DailySchedule,
  ReservationSlot,
  SerializableLaboratoryOption,
  SerializableUserOption,
} from "@/features/scheduling/types";
import type { NonTeachingDayRule } from "@/features/system-rules/types";
import { findNonTeachingRuleForDate, formatIsoDateInTimeZone } from "@/features/scheduling/utils";
import { cn } from "@/lib/utils";

interface SchedulingBoardProps {
  laboratories: SerializableLaboratoryOption[];
  selectedLaboratoryId: string;
  selectedDate: string;
  schedule: DailySchedule;
  actorRole: Role;
  timeZone: string;
  nonTeachingRules: NonTeachingDayRule[];
  teacherOptions?: SerializableUserOption[];
  classPeriod?: AcademicPeriodSummary | null;
}

const OCCURRENCE_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export function SchedulingBoard({
  laboratories,
  selectedLaboratoryId,
  selectedDate,
  schedule,
  actorRole,
  timeZone,
  nonTeachingRules,
  teacherOptions = [],
  classPeriod,
}: SchedulingBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [formState, formAction, isSubmitting] = useActionState(
    createReservationAction,
    idleActionState,
  );
  const formRef = useRef<HTMLFormElement | null>(null);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [timeZone],
  );

  const slotMetadata = useMemo(() => {
    const entries = new Map<string, { start: number; end: number }>();
    schedule.periods.forEach((period) => {
      period.slots.forEach((slot) => {
        entries.set(slot.id, {
          start: new Date(slot.startTime).getTime(),
          end: new Date(slot.endTime).getTime(),
        });
      });
    });
    return entries;
  }, [schedule]);

  const allSlotIds = useMemo(
    () => new Set(slotMetadata.keys()),
    [slotMetadata],
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
      setIsConfirmDialogOpen(false);
    }
  }, [formState.status]);

  useEffect(() => {
    setSelectedSlots(new Set());
  }, [selectedLaboratoryId, selectedDate]);

  const selectedSlotIds = useMemo(() => {
    const ids = Array.from(selectedSlots).filter((slotId) => allSlotIds.has(slotId));
    ids.sort((left, right) => {
      const leftMeta = slotMetadata.get(left);
      const rightMeta = slotMetadata.get(right);
      return (leftMeta?.start ?? 0) - (rightMeta?.start ?? 0);
    });
    return ids;
  }, [selectedSlots, allSlotIds, slotMetadata]);

  const getCalendarDayState = useCallback(
    (isoDate: string): CalendarDayState | undefined => {
      const rule = findNonTeachingRuleForDate(isoDate, nonTeachingRules, timeZone);
      if (!rule) {
        return undefined;
      }

      return {
        disabled: true,
        highlight: "nonTeaching",
        hint:
          rule.description?.trim()?.length
            ? `${rule.description} (não letivo)`
            : "Dia não letivo",
      };
    },
    [nonTeachingRules, timeZone],
  );

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
    if (slot.isOccupied || slot.isPast || schedule.isNonTeachingDay) {
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
    return formatIsoDateInTimeZone(selectedDate, timeZone, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [selectedDate, timeZone]);

  const canScheduleRecurrence = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const canManageClassPeriod = actorRole === Role.ADMIN || actorRole === Role.TECHNICIAN;
  const hasTeacherOptions = teacherOptions.length > 0;
  const handleClassPeriodSuccess = useCallback(() => {
    setSelectedSlots(new Set());
  }, []);

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

  const selectedSlotDetails = useMemo(() => {
    return selectedSlotIds
      .map((slotId) => findSlot(schedule, slotId))
      .filter((slot): slot is ReservationSlot => Boolean(slot));
  }, [schedule, selectedSlotIds]);

  const selectedLaboratoryName = useMemo(() => {
    return laboratories.find((lab) => lab.id === selectedLaboratoryId)?.name ?? "";
  }, [laboratories, selectedLaboratoryId]);

  useEffect(() => {
    if (selectedSlotIds.length === 0) {
      setIsConfirmDialogOpen(false);
    }
  }, [selectedSlotIds.length]);

  const openConfirmationDialog = useCallback(() => {
    if (selectedSlotIds.length === 0 || schedule.isNonTeachingDay || selectedSlotDetails.length === 0) {
      return;
    }
    setIsConfirmDialogOpen(true);
  }, [schedule.isNonTeachingDay, selectedSlotDetails.length, selectedSlotIds.length]);

  const handleConfirmSubmission = useCallback(() => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  }, []);

  const handleDialogOpenChange = useCallback(
    (state: boolean) => {
      if (isSubmitting) {
        return;
      }
      setIsConfirmDialogOpen(state);
    },
    [isSubmitting],
  );

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
            <DatePickerCalendar
              selectedDate={selectedDate}
              onSelect={handleDateSelect}
              getDayState={getCalendarDayState}
              timeZone={timeZone}
            />
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
              {schedule.isNonTeachingDay ? (
                <div className="rounded-lg border border-dashed border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
                  <p className="font-semibold">Dia marcado como não letivo</p>
                  <p className="mt-1 text-destructive/90">
                    {schedule.nonTeachingReason
                      ? schedule.nonTeachingReason
                      : "As reservas não podem ser realizadas nesta data."}
                  </p>
                </div>
              ) : null}

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
                        isDayDisabled={schedule.isNonTeachingDay}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <form ref={formRef} action={formAction} className="space-y-4">
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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectionSummary ?? "Nenhum horário selecionado."}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    {canManageClassPeriod && hasTeacherOptions ? (
                      <AssignClassPeriodDialog
                        teacherOptions={teacherOptions}
                        selectedLaboratoryId={selectedLaboratoryId}
                        selectedDate={selectedDate}
                        selectedSlotIds={selectedSlotIds}
                        classPeriod={classPeriod}
                        disabled={
                          selectedSlotIds.length === 0 ||
                          schedule.isNonTeachingDay ||
                          teacherOptions.length === 0
                        }
                        onSuccess={handleClassPeriodSuccess}
                      />
                    ) : null}
                    <Button
                      type="button"
                      onClick={openConfirmationDialog}
                      disabled={
                        selectedSlotIds.length === 0 ||
                        isSubmitting ||
                        schedule.isNonTeachingDay
                      }
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
                </div>

                {formState.status !== "idle" ? (
                  <div
                    role="status"
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      formState.status === "success"
                        ? "border-success/60 bg-success/25 text-success-foreground"
                        : "border-destructive/50 bg-destructive/10 text-destructive",
                    )}
                  >
                    {formState.message}
                  </div>
                ) : null}
              </form>

              <Dialog open={isConfirmDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar reserva selecionada</DialogTitle>
                    <DialogDescription>
                      Revise os horários antes de registrar a reserva para {formattedDate}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{selectedLaboratoryName}</span>
                      <span className="mx-2 text-muted-foreground/60">•</span>
                      <span className="capitalize">{formattedDate}</span>
                    </div>
                    {selectedSlotDetails.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {selectedSlotDetails.map((slot) => {
                          const startLabel = timeFormatter.format(new Date(slot.startTime));
                          const endLabel = timeFormatter.format(new Date(slot.endTime));

                          return (
                            <li
                              key={slot.id}
                              className="flex items-center justify-between rounded-md border border-border/60 bg-background/80 px-3 py-2"
                            >
                              <div className="flex flex-col text-left">
                                <span className="text-foreground">
                                  Aula {slot.classIndex} • {startLabel} - {endLabel}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Período: {resolvePeriodLabel(schedule, slot.periodId)}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        Nenhum horário selecionado.
                      </p>
                    )}
                  </div>
                  <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsConfirmDialogOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </Button>
                    <Button type="button" onClick={handleConfirmSubmission} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Enviando…
                        </span>
                      ) : (
                        "Confirmar reserva"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
  isDayDisabled: boolean;
}

function SlotCard({ slot, isSelected, onToggle, timeFormatter, isDayDisabled }: SlotCardProps) {
  const isDisabled = slot.isOccupied || slot.isPast || isDayDisabled;
  const start = timeFormatter.format(new Date(slot.startTime));
  const end = timeFormatter.format(new Date(slot.endTime));

  const statusLabel = getStatusLabel(slot, isDayDisabled);

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
        {isDayDisabled ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Não letivo
          </span>
        ) : slot.isOccupied ? (
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

function getStatusLabel(slot: ReservationSlot, isDayDisabled: boolean): string {
  if (isDayDisabled) {
    return "As reservas estão suspensas nesta data.";
  }

  if (slot.isOccupied && slot.reservation) {
    const owner = slot.reservation.createdBy.name;
    const statusText =
      slot.reservation.status === ReservationStatus.PENDING ? "aguardando confirmação" : "confirmada";
    const subjectSuffix = slot.reservation.subject ? ` • ${slot.reservation.subject}` : "";
    return `Reservado por ${owner} (${statusText})${subjectSuffix}`;
  }

  if (slot.isPast) {
    return "Horário indisponível.";
  }

  return "Horário livre para reserva.";
}

function resolvePeriodLabel(schedule: DailySchedule, periodId: ReservationSlot["periodId"]): string {
  return schedule.periods.find((period) => period.id === periodId)?.label ?? periodId;
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
