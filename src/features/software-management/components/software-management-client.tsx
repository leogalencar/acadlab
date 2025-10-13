"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleActionState, type ActionState } from "@/features/shared/types";
import {
  createSoftwareAction,
  deleteSoftwareAction,
  updateSoftwareAction,
} from "@/features/software-management/server/actions";
import type { SerializableSoftware } from "@/features/software-management/types";

interface SoftwareManagementClientProps {
  software: SerializableSoftware[];
}

export function SoftwareManagementClient({ software }: SoftwareManagementClientProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<SerializableSoftware | null>(null);

  const handleCreate = () => {
    setMode("create");
    setSelected(null);
    setOpen(true);
  };

  const handleRowClick = (item: SerializableSoftware) => {
    setMode("edit");
    setSelected(item);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-6 text-foreground">Softwares cadastrados</h2>
          <p className="text-sm text-muted-foreground">
            Registre novos softwares e mantenha o catálogo atualizado para associação aos laboratórios.
          </p>
        </div>
        <Button onClick={handleCreate}>Novo software</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-medium">Software</th>
              <th className="p-3 text-left font-medium">Versão</th>
              <th className="p-3 text-left font-medium">Fornecedor</th>
              <th className="p-3 text-left font-medium">Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {software.length > 0 ? (
              software.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className="cursor-pointer transition-colors hover:bg-muted/60"
                >
                  <td className="p-4 font-medium text-foreground">{item.name}</td>
                  <td className="p-4 text-muted-foreground">{item.version}</td>
                  <td className="p-4 text-muted-foreground">{item.supplier ?? "—"}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum software cadastrado. Utilize o botão acima para registrar um novo item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SoftwareDialog mode={mode} open={open} onOpenChange={setOpen} software={selected} />
    </div>
  );
}

interface SoftwareDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  software: SerializableSoftware | null;
}

function SoftwareDialog({ mode, open, onOpenChange, software }: SoftwareDialogProps) {
  const [deleteFeedback, setDeleteFeedback] = useState<ActionState | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDeleteFeedback(null);
    }
    onOpenChange(nextOpen);
  };

  const handleDelete = () => {
    if (!software) {
      return;
    }

    if (!window.confirm(`Remover o software ${software.name}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const formData = new FormData();
    formData.set("softwareId", software.id);

    setDeleteFeedback(null);
    startDeleting(async () => {
      const result = await deleteSoftwareAction(formData);
      if (result.status === "error") {
        setDeleteFeedback(result);
        return;
      }
      handleClose(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Cadastrar software" : software?.name ?? "Editar software"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Preencha os dados para adicionar um novo software ao catálogo."
              : "Atualize as informações do software ou remova-o do catálogo."}
          </DialogDescription>
        </DialogHeader>

        <SoftwareForm mode={mode} software={software} onCompleted={() => handleClose(false)} />

        {mode === "edit" && software ? (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-4">
            <p className="text-sm font-medium text-destructive">Remover software</p>
            <p className="text-xs text-muted-foreground">
              A remoção não desfaz associações anteriores, mas impede novas associações.
            </p>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Removendo..." : "Remover software"}
            </Button>
            {deleteFeedback?.status === "error" ? (
              <p className="text-sm text-destructive">{deleteFeedback.message}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SoftwareFormProps {
  mode: "create" | "edit";
  software: SerializableSoftware | null;
  onCompleted: () => void;
}

function SoftwareForm({ mode, software, onCompleted }: SoftwareFormProps) {
  const [formState, formAction, isPending] = useActionState(
    mode === "create" ? createSoftwareAction : updateSoftwareAction,
    idleActionState,
  );

  useEffect(() => {
    if (formState.status === "success") {
      onCompleted();
    }
  }, [formState.status, onCompleted]);

  return (
    <form action={formAction} className="grid gap-4">
      {mode === "edit" && software ? <input type="hidden" name="softwareId" value={software.id} /> : null}
      <div className="grid gap-2">
        <Label htmlFor="software-name">Nome</Label>
        <Input id="software-name" name="name" defaultValue={software?.name ?? ""} placeholder="Office" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="software-version">Versão</Label>
        <Input id="software-version" name="version" defaultValue={software?.version ?? ""} placeholder="2024" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="software-supplier">Fornecedor</Label>
        <Input id="software-supplier" name="supplier" defaultValue={software?.supplier ?? ""} placeholder="Microsoft" />
      </div>
      {formState.status === "error" ? (
        <p className="text-sm text-destructive">{formState.message}</p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : mode === "create" ? "Cadastrar software" : "Salvar alterações"}
      </Button>
    </form>
  );
}
