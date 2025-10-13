"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { FormEvent } from "react";
import { LaboratoryStatus, Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleActionState, type ActionState } from "@/features/shared/types";
import {
  assignSoftwareToLaboratoryAction,
  createLaboratoryAction,
  deleteLaboratoryAction,
  removeSoftwareFromLaboratoryAction,
  updateLaboratoryAction,
} from "@/features/lab-management/server/actions";
import { canManageLaboratories, type SerializableLaboratory } from "@/features/lab-management/types";
import { createSoftwareAction } from "@/features/software-management/server/actions";
import type { SerializableSoftware } from "@/features/software-management/types";

const LAB_STATUS_LABELS: Record<LaboratoryStatus, string> = {
  [LaboratoryStatus.ACTIVE]: "Ativo",
  [LaboratoryStatus.INACTIVE]: "Inativo",
};

const LAB_STATUS_STYLES: Record<LaboratoryStatus, string> = {
  [LaboratoryStatus.ACTIVE]: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30",
  [LaboratoryStatus.INACTIVE]: "bg-muted text-muted-foreground border-muted-foreground/30",
};

interface LaboratoriesClientProps {
  actorRole: Role;
  laboratories: SerializableLaboratory[];
  softwareCatalog: SerializableSoftware[];
}

export function LaboratoriesClient({
  actorRole,
  laboratories,
  softwareCatalog,
}: LaboratoriesClientProps) {
  const canManage = canManageLaboratories(actorRole);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedLaboratory, setSelectedLaboratory] = useState<SerializableLaboratory | null>(null);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedLaboratory(null);
    setDialogOpen(true);
  };

  const handleRowClick = (laboratory: SerializableLaboratory) => {
    setDialogMode(canManage ? "edit" : "view");
    setSelectedLaboratory(laboratory);
    setDialogOpen(true);
  };

  const tableRows = laboratories.length > 0 ? (
    laboratories.map((laboratory) => {
      const installedSoftware = laboratory.software.length;
      const availableMessage = laboratory.isAvailableForSelectedRange
        ? "Disponível para o período filtrado"
        : "";

      return (
        <tr
          key={laboratory.id}
          onClick={() => handleRowClick(laboratory)}
          className={
            canManage
              ? "cursor-pointer transition-colors hover:bg-muted/60"
              : ""
          }
        >
          <td className="p-4 font-medium text-foreground">{laboratory.name}</td>
          <td className="p-4 text-muted-foreground">{laboratory.capacity}</td>
          <td className="p-4">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${LAB_STATUS_STYLES[laboratory.status]}`}>
              {LAB_STATUS_LABELS[laboratory.status]}
            </span>
          </td>
          <td className="p-4 text-muted-foreground">
            {installedSoftware > 0
              ? `${installedSoftware} ${installedSoftware === 1 ? "software" : "softwares"}`
              : "Nenhum software associado"}
          </td>
          <td className="p-4 text-xs text-muted-foreground">{availableMessage}</td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
        Nenhum laboratório cadastrado até o momento.
        {canManage
          ? " Utilize o botão acima para registrar um novo ambiente."
          : " Entre em contato com a equipe técnica para solicitar o cadastro."}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-6 text-foreground">Laboratórios cadastrados</h2>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Clique em um laboratório para visualizar detalhes e editar informações."
              : "Visualização somente leitura dos laboratórios cadastrados."}
          </p>
        </div>
        {canManage ? (
          <Button onClick={handleCreateClick}>Novo laboratório</Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-medium">Laboratório</th>
              <th className="p-3 text-left font-medium">Capacidade</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="p-3 text-left font-medium">Softwares instalados</th>
              <th className="p-3 text-left font-medium">Disponibilidade</th>
            </tr>
          </thead>
          <tbody>{tableRows}</tbody>
        </table>
      </div>

      <LaboratoryDialog
        mode={dialogMode}
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        laboratory={selectedLaboratory}
        softwareCatalog={softwareCatalog}
        canManage={canManage}
      />
    </div>
  );
}

interface LaboratoryDialogProps {
  mode: "create" | "edit" | "view";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratory: SerializableLaboratory | null;
  softwareCatalog: SerializableSoftware[];
  canManage: boolean;
}

function LaboratoryDialog({ mode, open, onOpenChange, laboratory, softwareCatalog, canManage }: LaboratoryDialogProps) {
  const canEdit = mode === "edit" && canManage && Boolean(laboratory);
  const titleMap: Record<"create" | "edit" | "view", string> = {
    create: "Cadastrar laboratório",
    edit: laboratory?.name ?? "Editar laboratório",
    view: laboratory?.name ?? "Laboratório",
  };
  const title = titleMap[mode];
  const descriptionMap: Record<"create" | "edit" | "view", string> = {
    create: "Informe os dados do laboratório para disponibilizá-lo para reservas.",
    edit: "Atualize informações, gerencie softwares instalados ou remova o laboratório se necessário.",
    view: "Consulte a capacidade, o status e os softwares instalados neste laboratório.",
  };
  const description = descriptionMap[mode];

  const [deleteFeedback, setDeleteFeedback] = useState<ActionState | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDeleteFeedback(null);
    }
    onOpenChange(nextOpen);
  };

  const handleDelete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratory) {
      return;
    }
    if (!window.confirm(`Remover o laboratório ${laboratory.name}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const formData = new FormData();
    formData.set("laboratoryId", laboratory.id);

    setDeleteFeedback(null);
    startDeleting(async () => {
      const result = await deleteLaboratoryAction(formData);
      if (result.status === "error") {
        setDeleteFeedback(result);
        return;
      }
      handleClose(false);
    });
  };

  const availableSoftware = useMemo(() => {
    if (!laboratory) {
      return softwareCatalog;
    }
    const installedIds = new Set(laboratory.software.map((item) => item.softwareId));
    return softwareCatalog.filter((software) => !installedIds.has(software.id));
  }, [laboratory, softwareCatalog]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {mode !== "view" ? (
            <LaboratoryForm mode={mode} laboratory={laboratory} onCompleted={() => handleClose(false)} />
          ) : laboratory ? (
            <LaboratoryDetails laboratory={laboratory} />
          ) : null}

          {laboratory ? (
            <SoftwareAssociationSection
              laboratory={laboratory}
              availableSoftware={availableSoftware}
              canManage={canManage && mode !== "view"}
            />
          ) : null}

          {canEdit && laboratory ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-destructive">Remover laboratório</h3>
              <p className="text-sm text-muted-foreground">
                Esta ação remove o laboratório e todas as associações de software. Reservas existentes não são alteradas.
              </p>
              <form onSubmit={handleDelete} className="flex flex-col gap-2">
                <Button type="submit" variant="destructive" disabled={isDeleting}>
                  {isDeleting ? "Removendo..." : "Remover laboratório"}
                </Button>
                {deleteFeedback?.status === "error" ? (
                  <p className="text-sm text-destructive">{deleteFeedback.message}</p>
                ) : null}
              </form>
            </section>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LaboratoryFormProps {
  mode: "create" | "edit";
  laboratory: SerializableLaboratory | null;
  onCompleted: () => void;
}

function LaboratoryForm({ mode, laboratory, onCompleted }: LaboratoryFormProps) {
  const [formState, formAction, isPending] = useActionState(
    mode === "create" ? createLaboratoryAction : updateLaboratoryAction,
    idleActionState,
  );

  useEffect(() => {
    if (formState.status === "success") {
      onCompleted();
    }
  }, [formState.status, onCompleted]);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informações gerais</h3>
      </div>
      <form action={formAction} className="grid gap-4">
        {mode === "edit" && laboratory ? (
          <input type="hidden" name="laboratoryId" value={laboratory.id} />
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="name">Nome do laboratório</Label>
          <Input
            id="name"
            name="name"
            defaultValue={laboratory?.name ?? ""}
            placeholder="Laboratório de Redes"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="capacity">Capacidade</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            step={1}
            defaultValue={laboratory?.capacity ?? 20}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status operacional</Label>
          <select
            id="status"
            name="status"
            defaultValue={laboratory?.status ?? LaboratoryStatus.ACTIVE}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={LaboratoryStatus.ACTIVE}>{LAB_STATUS_LABELS[LaboratoryStatus.ACTIVE]}</option>
            <option value={LaboratoryStatus.INACTIVE}>{LAB_STATUS_LABELS[LaboratoryStatus.INACTIVE]}</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={laboratory?.description ?? ""}
            rows={3}
            className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Detalhes sobre infraestrutura, observações ou orientações."
          />
        </div>
        {formState.status === "error" ? (
          <p className="text-sm text-destructive">{formState.message}</p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : mode === "create" ? "Cadastrar laboratório" : "Salvar alterações"}
        </Button>
      </form>
    </section>
  );
}

function LaboratoryDetails({ laboratory }: { laboratory: SerializableLaboratory }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informações</h3>
      </div>
      <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/40 p-4 text-sm">
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome</span>
          <span className="font-medium text-foreground">{laboratory.name}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Capacidade</span>
          <span>{laboratory.capacity} estações</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</span>
          <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${LAB_STATUS_STYLES[laboratory.status]}`}>
            {LAB_STATUS_LABELS[laboratory.status]}
          </span>
        </div>
        {laboratory.description ? (
          <div className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição</span>
            <span>{laboratory.description}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface SoftwareAssociationSectionProps {
  laboratory: SerializableLaboratory;
  availableSoftware: SerializableSoftware[];
  canManage: boolean;
}

function SoftwareAssociationSection({ laboratory, availableSoftware, canManage }: SoftwareAssociationSectionProps) {
  const [assignState, assignAction, isAssigning] = useActionState(assignSoftwareToLaboratoryAction, idleActionState);
  const [removeFeedback, setRemoveFeedback] = useState<ActionState | null>(null);
  const [isRemoving, startRemoving] = useTransition();
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const assignFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (assignState.status === "success") {
      assignFormRef.current?.reset();
    }
  }, [assignState.status]);

  if (!canManage) {
    return (
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Softwares instalados</h3>
        </div>
        <div className="space-y-3">
          {laboratory.software.length > 0 ? (
            laboratory.software.map((item) => (
              <div key={item.softwareId} className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm">
                <p className="font-medium text-foreground">
                  {item.name} • {item.version}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.installedByName ? `Instalado por ${item.installedByName}` : "Instalação registrada"}
                  {" • "}
                  {new Date(item.installedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum software associado a este laboratório.</p>
          )}
        </div>
      </section>
    );
  }

  const handleRemove = (softwareId: string) => {
    const formData = new FormData();
    formData.set("laboratoryId", laboratory.id);
    formData.set("softwareId", softwareId);

    setRemoveFeedback(null);
    startRemoving(async () => {
      const result = await removeSoftwareFromLaboratoryAction(formData);
      if (result.status === "error") {
        setRemoveFeedback(result);
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Softwares instalados</h3>
          <p className="text-sm text-muted-foreground">
            Associe softwares cadastrados ao laboratório ou remova itens que não estão mais disponíveis.
          </p>
        </div>
        <Button variant="link" type="button" onClick={() => setShowQuickCreate((prev) => !prev)} className="h-auto p-0 text-sm">
          {showQuickCreate ? "Ocultar atalho" : "Cadastrar novo software"}
        </Button>
      </div>

      {showQuickCreate ? (
        <SoftwareQuickCreate onSuccess={() => setShowQuickCreate(false)} />
      ) : null}

      <form
        ref={assignFormRef}
        action={assignAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border/70 p-4"
      >
        <input type="hidden" name="laboratoryId" value={laboratory.id} />
        <div className="grid min-w-[220px] flex-1 gap-2">
          <Label htmlFor="software-select">Selecionar software</Label>
          <select
            id="software-select"
            name="softwareId"
            defaultValue=""
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
            <option value="" disabled>
              {availableSoftware.length > 0 ? "Escolha um software" : "Cadastre softwares para associar"}
            </option>
            {availableSoftware.map((software) => (
              <option key={software.id} value={software.id}>
                {software.name} • {software.version}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isAssigning || availableSoftware.length === 0}>
          {isAssigning ? "Associando..." : "Adicionar software"}
        </Button>
        {assignState.status === "error" ? (
          <p className="basis-full text-sm text-destructive">{assignState.message}</p>
        ) : null}
      </form>

      <div className="space-y-3">
        {laboratory.software.length > 0 ? (
          laboratory.software.map((item) => (
            <div
              key={item.softwareId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 p-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {item.name} • {item.version}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.installedByName
                    ? `Instalado por ${item.installedByName}`
                    : "Instalação registrada"}
                  {" • "}
                  {new Date(item.installedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-8"
                disabled={isRemoving}
                onClick={() => handleRemove(item.softwareId)}
              >
                Remover
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum software associado a este laboratório.</p>
        )}
      </div>

      {removeFeedback?.status === "error" ? (
        <p className="text-sm text-destructive">{removeFeedback.message}</p>
      ) : null}
    </section>
  );
}

interface SoftwareQuickCreateProps {
  onSuccess: () => void;
}

function SoftwareQuickCreate({ onSuccess }: SoftwareQuickCreateProps) {
  const [formState, formAction, isPending] = useActionState(createSoftwareAction, idleActionState);

  useEffect(() => {
    if (formState.status === "success") {
      onSuccess();
    }
  }, [formState.status, onSuccess]);

  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
      <p className="text-sm font-medium text-foreground">Cadastrar novo software</p>
      <p className="text-xs text-muted-foreground">
        O software será adicionado ao catálogo geral e poderá ser associado a qualquer laboratório.
      </p>
      <form action={formAction} className="mt-4 grid gap-3 text-sm">
        <div className="grid gap-2">
          <Label htmlFor="software-name">Nome</Label>
          <Input id="software-name" name="name" placeholder="Office" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="software-version">Versão</Label>
          <Input id="software-version" name="version" placeholder="2024" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="software-supplier">Fornecedor</Label>
          <Input id="software-supplier" name="supplier" placeholder="Microsoft" />
        </div>
        {formState.status === "error" ? (
          <p className="text-sm text-destructive">{formState.message}</p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar software"}
        </Button>
      </form>
    </div>
  );
}
