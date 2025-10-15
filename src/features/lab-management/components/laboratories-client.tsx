"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { FormEvent, ReactNode } from "react";
import { LaboratoryStatus, Role } from "@prisma/client";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { LaboratoryPaginationState, LaboratorySortingState, LaboratorySortField, SerializableLaboratory } from "@/features/lab-management/types";
import { idleActionState, type ActionState } from "@/features/shared/types";
import { PAGE_SIZE_OPTIONS } from "@/features/shared/table";
import {
  assignSoftwareToLaboratoryAction,
  createLaboratoryAction,
  deleteLaboratoryAction,
  removeSoftwareFromLaboratoryAction,
  updateLaboratoryAction,
} from "@/features/lab-management/server/actions";
import { canManageLaboratories } from "@/features/lab-management/types";
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

const shouldAutoOpenQuickCreate = (
  mode: "create" | "edit" | "view",
  softwareCount: number,
) => mode === "create" && softwareCount === 0;

interface LaboratoriesClientProps {
  actorRole: Role;
  laboratories: SerializableLaboratory[];
  softwareCatalog: SerializableSoftware[];
  sorting: LaboratorySortingState;
  pagination: LaboratoryPaginationState;
}

export function LaboratoriesClient({
  actorRole,
  laboratories,
  softwareCatalog,
  sorting,
  pagination,
}: LaboratoriesClientProps) {
  const canManage = canManageLaboratories(actorRole);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedLaboratoryId, setSelectedLaboratoryId] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const selectedLaboratory = useMemo(() => {
    if (!selectedLaboratoryId) {
      return null;
    }

    return laboratories.find((laboratory) => laboratory.id === selectedLaboratoryId) ?? null;
  }, [laboratories, selectedLaboratoryId]);

  const handleCreateClick = () => {
    setDialogMode("create");
    setSelectedLaboratoryId(null);
    setDialogOpen(true);
  };

  const handleRowClick = (laboratoryId: string) => {
    setDialogMode(canManage ? "edit" : "view");
    setSelectedLaboratoryId(laboratoryId);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!selectedLaboratoryId) {
      return;
    }

    const exists = laboratories.some((laboratory) => laboratory.id === selectedLaboratoryId);

    if (!exists) {
      setDialogOpen(false);
      setDialogMode("create");
      setSelectedLaboratoryId(null);
    }
  }, [laboratories, selectedLaboratoryId]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setDialogOpen(nextOpen);
    if (!nextOpen) {
      setDialogMode("create");
      setSelectedLaboratoryId(null);
      setDialogKey((key) => key + 1);
    }
  };

  const updateQueryParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const query = params.toString();
    router.push(query ? `?${query}` : "");
  };

  const handleSortChange = (field: LaboratorySortField) => {
    const isSameField = sorting.sortBy === field;
    const nextOrder = isSameField && sorting.sortOrder === "asc" ? "desc" : "asc";

    updateQueryParams({
      sortBy: field,
      sortOrder: nextOrder,
      page: null,
    });
  };

  const handlePageChange = (nextPage: number) => {
    updateQueryParams({ page: String(nextPage) });
  };

  const handlePerPageChange = (nextPerPage: number) => {
    updateQueryParams({ perPage: String(nextPerPage), page: "1" });
  };

  const { page, perPage, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasResults = total > 0;
  const rangeStart = hasResults ? (page - 1) * perPage + 1 : 0;
  const rangeEnd = hasResults ? Math.min(total, page * perPage) : 0;

  const tableRows = laboratories.length > 0 ? (
    laboratories.map((laboratory) => {
      const installedSoftware = laboratory.software.length;
      const availableMessage = laboratory.isAvailableForSelectedRange
        ? "Disponível para o período filtrado"
        : "";

      return (
        <tr
          key={laboratory.id}
          onClick={() => handleRowClick(laboratory.id)}
          className={cn(
            "transition-colors",
            canManage && "cursor-pointer hover:bg-muted/60",
          )}
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
          <td className="p-4 text-xs text-muted-foreground">
            {new Date(laboratory.updatedAt).toLocaleDateString()}
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
        Nenhum laboratório encontrado.
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
              <SortableHeader
                label="Laboratório"
                field="name"
                sorting={sorting}
                onSort={handleSortChange}
              />
              <SortableHeader
                label="Capacidade"
                field="capacity"
                sorting={sorting}
                onSort={handleSortChange}
                alignment="left"
              />
              <SortableHeader
                label="Status"
                field="status"
                sorting={sorting}
                onSort={handleSortChange}
                alignment="left"
              />
              <th className="p-3 text-left font-medium">Softwares instalados</th>
              <th className="p-3 text-left font-medium">Disponibilidade</th>
              <SortableHeader
                label="Atualizado em"
                field="updatedAt"
                sorting={sorting}
                onSort={handleSortChange}
                alignment="left"
              />
            </tr>
          </thead>
          <tbody>{tableRows}</tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 text-sm md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground">
          {hasResults
            ? `Mostrando ${rangeStart}-${rangeEnd} de ${total} laboratório${total === 1 ? "" : "s"}`
            : "Nenhum laboratório encontrado."}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-muted-foreground">
            Linhas por página
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
              value={perPage}
              onChange={(event) => handlePerPageChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              {PAGE_SIZE_OPTIONS.includes(perPage) ? null : (
                <option value={perPage}>{perPage}</option>
              )}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <span className="text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Próxima
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <LaboratoryDialog
        key={dialogKey}
        mode={dialogMode}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        laboratory={selectedLaboratory}
        softwareCatalog={softwareCatalog}
        canManage={canManage}
      />
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: LaboratorySortField;
  sorting: LaboratorySortingState;
  onSort: (field: LaboratorySortField) => void;
  alignment?: "left" | "right";
}

function SortableHeader({ label, field, sorting, onSort, alignment = "left" }: SortableHeaderProps) {
  const isActive = sorting.sortBy === field;
  const iconRotation = isActive && sorting.sortOrder === "desc" ? "rotate-180" : "";

  return (
    <th
      className={cn("p-3", alignment === "right" ? "text-right" : "text-left")}
      scope="col"
      aria-sort={isActive ? (sorting.sortOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "flex items-center gap-1 font-medium uppercase tracking-wide text-xs",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <ChevronUp
          className={cn(
            "h-4 w-4 transition-transform",
            iconRotation,
            isActive ? "text-foreground" : "text-muted-foreground/60",
          )}
        />
      </button>
    </th>
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
  const router = useRouter();
  const quickCreateId = useId();
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
  const [showQuickCreate, setShowQuickCreate] = useState(() =>
    shouldAutoOpenQuickCreate(mode, softwareCatalog.length),
  );

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDeleteFeedback(null);
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (shouldAutoOpenQuickCreate(mode, softwareCatalog.length)) {
      setShowQuickCreate(true);
      return;
    }

    if (mode !== "create") {
      setShowQuickCreate(false);
    }
  }, [mode, softwareCatalog.length]);

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
      router.refresh();
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
            <div className="space-y-4">
              <LaboratoryForm
                mode={mode}
                laboratory={laboratory}
                softwareCatalog={softwareCatalog}
                onCompleted={() => {
                  router.refresh();
                  handleClose(false);
                }}
                quickCreate={
                  mode === "create"
                    ? {
                        id: quickCreateId,
                        open: showQuickCreate,
                        onToggle: () => setShowQuickCreate((prev) => !prev),
                        render: () => (
                          <SoftwareQuickCreate
                            id={quickCreateId}
                            onSuccess={() => {
                              setShowQuickCreate(false);
                              router.refresh();
                            }}
                          />
                        ),
                      }
                    : undefined
                }
              />
            </div>
          ) : laboratory ? (
            <LaboratoryDetails laboratory={laboratory} />
          ) : null}

          {laboratory ? (
            <SoftwareAssociationSection
              laboratory={laboratory}
              availableSoftware={availableSoftware}
              canManage={canManage && mode !== "view"}
              onRefresh={router.refresh}
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
  softwareCatalog: SerializableSoftware[];
  onCompleted: () => void;
  quickCreate?: {
    id: string;
    open: boolean;
    onToggle: () => void;
    render: () => ReactNode;
  };
}

function LaboratoryForm({ mode, laboratory, softwareCatalog, onCompleted, quickCreate }: LaboratoryFormProps) {
  const [formState, formAction, isPending] = useActionState(
    mode === "create" ? createLaboratoryAction : updateLaboratoryAction,
    idleActionState,
  );
  const formId = useId();

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
      <div className="grid gap-4">
        <form id={formId} action={formAction} className="grid gap-4">
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
        </form>
        {mode === "create" ? (
          <SoftwareSelectionField
            formId={formId}
            softwareCatalog={softwareCatalog}
            quickCreate={
              quickCreate
                ? {
                    open: quickCreate.open,
                    onToggle: quickCreate.onToggle,
                    targetId: quickCreate.id,
                    render: quickCreate.render,
                  }
                : undefined
            }
          />
        ) : null}
        {formState.status === "error" ? (
          <p className="text-sm text-destructive">{formState.message}</p>
        ) : null}
        <Button type="submit" form={formId} disabled={isPending}>
          {isPending ? "Salvando..." : mode === "create" ? "Cadastrar laboratório" : "Salvar alterações"}
        </Button>
      </div>
    </section>
  );
}

function SoftwareSelectionField({
  softwareCatalog,
  formId,
  quickCreate,
}: {
  softwareCatalog: SerializableSoftware[];
  formId: string;
  quickCreate?: {
    open: boolean;
    onToggle: () => void;
    targetId: string;
    render: () => ReactNode;
  };
}) {
  const hasSoftwareOptions = softwareCatalog.length > 0;
  const quickCreateVisible = quickCreate?.open ?? false;
  let quickCreateSection: ReactNode = null;

  if (quickCreate) {
    quickCreateSection = quickCreateVisible
      ? quickCreate.render()
      : (
          <div
            id={quickCreate.targetId}
            className="hidden"
            aria-hidden="true"
          />
        );
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Softwares instalados
      </legend>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {hasSoftwareOptions
            ? "Selecione softwares já cadastrados ou cadastre novos itens no catálogo."
            : "Nenhum software disponível ainda. Utilize o atalho para cadastrar softwares antes de concluir o registro."}
        </p>
        {quickCreate ? (
          <Button
            variant="link"
            type="button"
            onClick={quickCreate.onToggle}
            className="h-auto p-0 text-sm"
            aria-expanded={quickCreateVisible}
            aria-controls={quickCreate.targetId}
          >
            {quickCreateVisible ? "Ocultar atalho" : "Cadastrar novo software"}
          </Button>
        ) : null}
      </div>
      {quickCreateSection}
      {hasSoftwareOptions ? (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-sm">
          {softwareCatalog.map((software) => {
            const checkboxId = `software-${software.id}`;

            return (
              <label key={software.id} htmlFor={checkboxId} className="flex items-start gap-3">
                <input
                  id={checkboxId}
                  type="checkbox"
                  name="softwareIds"
                  value={software.id}
                  form={formId}
                  className="mt-1 h-4 w-4 rounded border border-input text-primary"
                />
                <span>
                  <span className="block font-medium text-foreground">
                    {software.name} • {software.version}
                  </span>
                  {software.supplier ? (
                    <span className="block text-xs text-muted-foreground">Fornecedor: {software.supplier}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </fieldset>
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
  onRefresh: () => void;
}

function SoftwareAssociationSection({ laboratory, availableSoftware, canManage, onRefresh }: SoftwareAssociationSectionProps) {
  const [assignState, assignAction, isAssigning] = useActionState(assignSoftwareToLaboratoryAction, idleActionState);
  const [removeFeedback, setRemoveFeedback] = useState<ActionState | null>(null);
  const [isRemoving, startRemoving] = useTransition();
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const assignFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (assignState.status === "success") {
      assignFormRef.current?.reset();
      onRefresh();
    }
  }, [assignState.status, onRefresh]);

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
        return;
      }
      onRefresh();
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
        <SoftwareQuickCreate
          onSuccess={() => {
            setShowQuickCreate(false);
            onRefresh();
          }}
        />
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
  id?: string;
  onSuccess: () => void;
}

function SoftwareQuickCreate({ id, onSuccess }: SoftwareQuickCreateProps) {
  const [formState, formAction, isPending] = useActionState(createSoftwareAction, idleActionState);

  useEffect(() => {
    if (formState.status === "success") {
      onSuccess();
    }
  }, [formState.status, onSuccess]);

  return (
    <div id={id} className="rounded-lg border border-border/70 bg-muted/40 p-4">
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
