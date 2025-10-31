"use client";

import { useActionState, useEffect, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cancelReservationAction } from "@/features/scheduling/server/actions";
import { idleActionState } from "@/features/shared/types";

interface CancelReservationButtonProps {
  reservationId: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  label?: string;
  disabled?: boolean;
}

export function CancelReservationButton({
  reservationId,
  triggerVariant = "outline",
  triggerSize = "sm",
  label = "Cancelar reserva",
  disabled = false,
}: CancelReservationButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formState, formAction, isPending] = useActionState(cancelReservationAction, idleActionState);

  useEffect(() => {
    if (formState.status === "success") {
      setOpen(false);
      router.refresh();
    }
  }, [formState.status, router]);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        className="gap-2"
      >
        <XCircle className="size-4" aria-hidden />
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirme o cancelamento da reserva</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Esta ação atualizará o status da reserva para cancelada e liberará o horário selecionado.
              Se preferir, explique o motivo abaixo. O cancelamento não pode ser desfeito.
            </p>
          </AlertDialogHeader>
          <form id={`cancel-reservation-${reservationId}`} action={formAction} className="space-y-3">
            <input type="hidden" name="reservationId" value={reservationId} />
            <label htmlFor={`cancel-reason-${reservationId}`} className="block text-sm font-medium text-foreground">
              Motivo do cancelamento (opcional)
            </label>
            <textarea
              id={`cancel-reason-${reservationId}`}
              name="reason"
              rows={4}
              maxLength={500}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Compartilhe o motivo do cancelamento para futuros registros (máximo de 500 caracteres)."
            />
            {formState.status === "error" ? (
              <p className="text-sm text-destructive">{formState.message}</p>
            ) : null}
            {formState.status === "success" ? (
              <p className="text-sm text-success-foreground">{formState.message}</p>
            ) : null}
          </form>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isPending}>Manter reserva</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              form={`cancel-reservation-${reservationId}`}
              disabled={isPending}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Cancelando…
                </>
              ) : (
                "Cancelar reserva"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
