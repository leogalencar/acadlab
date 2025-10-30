"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { idleActionState } from "@/features/shared/types";
import { cancelReservationAction } from "@/features/scheduling/server/actions";
import { cn } from "@/lib/utils";

interface CancelReservationButtonProps {
  reservationId: string;
  triggerLabel?: string;
  triggerClassName?: string;
  hasRecurrence?: boolean;
  allowSeriesCancellation?: boolean;
  variant?: "default" | "ghost";
}

export function CancelReservationButton({
  reservationId,
  triggerLabel = "Cancelar",
  triggerClassName,
  hasRecurrence = false,
  allowSeriesCancellation = false,
  variant = "default",
}: CancelReservationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, formAction, isSubmitting] = useActionState(
    cancelReservationAction,
    idleActionState,
  );
  const [cancelSeries, setCancelSeries] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (formState.status === "success") {
      setReason("");
      setCancelSeries(false);
      setIsOpen(false);
    }
  }, [formState.status]);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="sm"
          className={triggerClassName}
          onClick={() => setIsOpen(true)}
        >
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Essa ação marca a reserva como cancelada e libera o horário novamente para outros usuários.
              </p>
              {allowSeriesCancellation && hasRecurrence ? (
                <p>
                  Você pode optar por cancelar apenas esta ocorrência ou todas as futuras associadas à recorrência.
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="reservationId" value={reservationId} />
          {allowSeriesCancellation && hasRecurrence ? (
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="cancelSeries"
                value="true"
                checked={cancelSeries}
                onChange={(event) => setCancelSeries(event.currentTarget.checked)}
                className="size-4 rounded border border-input"
              />
              Cancelar todas as ocorrências futuras desta recorrência
            </label>
          ) : null}
          <div className="space-y-2">
            <label htmlFor={`cancel-reason-${reservationId}`} className="text-sm font-medium text-foreground">
              Justificativa (opcional)
            </label>
            <textarea
              id={`cancel-reason-${reservationId}`}
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              rows={3}
              maxLength={500}
              placeholder="Informe o motivo do cancelamento, se necessário."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-destructive"
            />
            <p className="text-xs text-muted-foreground">
              Essa informação será exibida no histórico do agendamento.
            </p>
          </div>
          {formState.status !== "idle" ? (
            <div
              role="status"
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                formState.status === "success"
                  ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700"
                  : "border-destructive/50 bg-destructive/10 text-destructive",
              )}
            >
              {formState.message}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Voltar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
                className="min-w-[140px]"
              >
                {isSubmitting ? "Cancelando..." : "Confirmar cancelamento"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
