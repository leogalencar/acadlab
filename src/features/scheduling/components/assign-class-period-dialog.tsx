"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignClassPeriodReservationAction } from "@/features/scheduling/server/actions";
import type { AcademicPeriodSummary, SerializableUserOption } from "@/features/scheduling/types";
import { useServerActionToast } from "@/features/notifications/hooks/use-server-action-toast";
import { idleActionState } from "@/features/shared/types";
import { cn } from "@/lib/utils";

interface AssignClassPeriodDialogProps {
  teacherOptions: SerializableUserOption[];
  selectedLaboratoryId: string;
  selectedDate: string;
  selectedSlotIds: string[];
  classPeriod?: AcademicPeriodSummary | null;
  disabled?: boolean;
  onSuccess: () => void;
}

export function AssignClassPeriodDialog({
  teacherOptions,
  selectedLaboratoryId,
  selectedDate,
  selectedSlotIds,
  classPeriod,
  disabled = false,
  onSuccess,
}: AssignClassPeriodDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formState, formAction, isSubmitting] = useServerActionToast(
    assignClassPeriodReservationAction,
    idleActionState,
    {
      messages: {
        pending: "Agendando período letivo...",
        success: "Período letivo agendado com sucesso.",
        error: "Não foi possível criar o período letivo.",
      },
    },
  );

  const canSubmit = !disabled && teacherOptions.length > 0 && classPeriod && selectedSlotIds.length > 0;

  useEffect(() => {
    if (formState.status === "success") {
      setOpen(false);
      onSuccess();
      router.refresh();
    }
  }, [formState.status, onSuccess, router]);

  const selectionSummary = useMemo(() => {
    if (selectedSlotIds.length === 0) {
      return "Selecione pelo menos um horário para habilitar o agendamento.";
    }

    const plural = selectedSlotIds.length > 1 ? "horários" : "horário";
    return `${selectedSlotIds.length} ${plural} selecionado${selectedSlotIds.length > 1 ? "s" : ""} na agenda`;
  }, [selectedSlotIds.length]);

  const shouldDisableTrigger = disabled || teacherOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={(state) => !isSubmitting && setOpen(state)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={shouldDisableTrigger}
          className="flex items-center gap-2"
        >
          <NotebookPen className="size-4" aria-hidden />
          Período letivo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader className="space-y-2">
          <DialogTitle>Agendar período letivo</DialogTitle>
          <DialogDescription>
            Gere reservas semanais para toda a duração do período letivo configurado. O professor selecionado será o responsável pelas reservas.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="laboratoryId" value={selectedLaboratoryId} />
          <input type="hidden" name="date" value={selectedDate} />
          {selectedSlotIds.map((slotId) => (
            <input key={slotId} type="hidden" name="slotIds" value={slotId} />
          ))}

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="teacherId">Professor responsável</Label>
              <select
                id="teacherId"
                name="teacherId"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                defaultValue={teacherOptions[0]?.id ?? ""}
              >
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Disciplina ou turma</Label>
              <Input
                id="subject"
                name="subject"
                placeholder="Ex.: Programação para Computação"
                required
                maxLength={120}
              />
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Resumo</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>{selectionSummary}.</li>
              {classPeriod ? (
                <>
                  <li>
                    Serão criadas reservas semanais por {classPeriod.durationWeeks} semana
                    {classPeriod.durationWeeks > 1 ? "s" : ""} ({classPeriod.label}).
                  </li>
                  {classPeriod.description ? <li>{classPeriod.description}</li> : null}
                </>
              ) : (
                <li>Configure o período letivo nas regras do sistema para habilitar esta funcionalidade.</li>
              )}
            </ul>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="flex items-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Agendando…
                </>
              ) : (
                "Confirmar período"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
