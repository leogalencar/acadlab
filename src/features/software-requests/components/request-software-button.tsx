"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSoftwareRequestAction } from "@/features/software-requests/server/actions";
import { useServerActionToast } from "@/features/notifications/hooks/use-server-action-toast";
import { idleActionState } from "@/features/shared/types";

interface RequestSoftwareButtonProps {
  laboratoryId: string;
  laboratoryName: string;
  onSubmitted: () => void;
}

export function RequestSoftwareButton({ laboratoryId, laboratoryName, onSubmitted }: RequestSoftwareButtonProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFormKey((key) => key + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Solicitar instalação de software
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar instalação para {laboratoryName}</DialogTitle>
          <DialogDescription>
            Informe os detalhes do software desejado. A equipe técnica será notificada e acompanhará o pedido pelo módulo de
            solicitações.
          </DialogDescription>
        </DialogHeader>

        <RequestSoftwareForm
          key={formKey}
          laboratoryId={laboratoryId}
          onCompleted={() => {
            setOpen(false);
            setFormKey((key) => key + 1);
            onSubmitted();
          }}
        />

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RequestSoftwareFormProps {
  laboratoryId: string;
  onCompleted: () => void;
}

function RequestSoftwareForm({ laboratoryId, onCompleted }: RequestSoftwareFormProps) {
  const [state, formAction, isPending] = useServerActionToast(
    createSoftwareRequestAction,
    idleActionState,
    {
      messages: {
        pending: "Enviando solicitação...",
        success: "Solicitação enviada com sucesso.",
        error: "Não foi possível registrar a solicitação.",
      },
    },
  );

  useEffect(() => {
    if (state.status === "success") {
      onCompleted();
    }
  }, [state.status, onCompleted]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="laboratoryId" value={laboratoryId} />
      <div className="grid gap-2">
        <Label htmlFor="software-name">Nome do software</Label>
        <Input
          id="software-name"
          name="softwareName"
          placeholder="Ex.: Visual Studio Code"
          required
          maxLength={120}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="software-version">Versão solicitada</Label>
        <Input id="software-version" name="softwareVersion" placeholder="Ex.: 1.92" required maxLength={60} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="software-justification">Justificativa</Label>
        <textarea
          id="software-justification"
          name="justification"
          rows={4}
          maxLength={600}
          required
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Explique a finalidade pedagógica ou técnica da instalação."
        />
        <p className="text-xs text-muted-foreground">Descreva o motivo da solicitação em pelo menos 10 caracteres.</p>
      </div>
      {state.status === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <Button type="submit" disabled={isPending} className="w-full justify-center gap-2">
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Enviando solicitação...
          </>
        ) : (
          "Enviar solicitação"
        )}
      </Button>
    </form>
  );
}
