"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";
import { ConfirmationDialog } from "@/features/shared/components/confirmation-dialog";
import { idleActionState, type ActionState } from "@/features/shared/types";
import { PAGE_SIZE_OPTIONS } from "@/features/shared/table";
import {
  createSoftwareAction,
  deleteSoftwareAction,
  updateSoftwareAction,
} from "@/features/software-management/server/actions";
import type {
  SerializableSoftware,
  SoftwarePaginationState,
  SoftwareSortField,
  SoftwareSortingState,
} from "@/features/software-management/types";
import { useServerActionToast } from "@/features/notifications/hooks/use-server-action-toast";

interface SoftwareManagementClientProps {
  software: SerializableSoftware[];
  sorting: SoftwareSortingState;
  pagination: SoftwarePaginationState;
}

export function SoftwareManagementClient({ software, sorting, pagination }: SoftwareManagementClientProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  const selected = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    return software.find((item) => item.id === selectedId) ?? null;
  }, [selectedId, software]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const exists = software.some((item) => item.id === selectedId);
    if (!exists) {
      setOpen(false);
      setMode("create");
      setSelectedId(null);
    }
  }, [selectedId, software]);

  const handleCreate = () => {
    setMode("create");
    setSelectedId(null);
    setOpen(true);
  };

  const handleRowClick = (softwareId: string) => {
    setMode("edit");
    setSelectedId(softwareId);
    setOpen(true);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMode("create");
      setSelectedId(null);
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

  const handleSortChange = (field: SoftwareSortField) => {
    const isSameField = sorting.sortBy === field;
    const nextOrder = isSameField && sorting.sortOrder === "asc" ? "desc" : "asc";

    updateQueryParams({ sortBy: field, sortOrder: nextOrder, page: null });
  };

  const handlePageChange = (page: number) => {
    updateQueryParams({ page: String(page) });
  };

  const handlePerPageChange = (nextPerPage: number) => {
    updateQueryParams({ perPage: String(nextPerPage), page: "1" });
  };

  const { page, perPage, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasResults = total > 0;
  const rangeStart = hasResults ? (page - 1) * perPage + 1 : 0;
  const rangeEnd = hasResults ? Math.min(total, page * perPage) : 0;

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
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Software" field="name" sorting={sorting} onSort={handleSortChange} />
              <SortableHeader label="Versão" field="version" sorting={sorting} onSort={handleSortChange} />
              <th className="p-3 text-left font-medium">Fornecedor</th>
              <SortableHeader label="Atualizado em" field="updatedAt" sorting={sorting} onSort={handleSortChange} />
            </tr>
          </thead>
          <tbody>
            {software.length > 0 ? (
              software.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item.id)}
                  className="cursor-pointer transition-colors hover:bg-muted/60"
                >
                  <td className="p-4 font-medium text-foreground">{item.name}</td>
                  <td className="p-4 text-muted-foreground">{item.version}</td>
                  <td className="p-4 text-muted-foreground">{item.supplier ?? "—"}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum software encontrado. Utilize o botão acima para registrar um novo item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 text-sm md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground">
          {hasResults
            ? `Mostrando ${rangeStart}-${rangeEnd} de ${total} software${total === 1 ? "" : "s"}`
            : "Nenhum software encontrado."}
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

      <SoftwareDialog key={dialogKey} mode={mode} open={open} onOpenChange={handleDialogOpenChange} software={selected} />
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: SoftwareSortField;
  sorting: SoftwareSortingState;
  onSort: (field: SoftwareSortField) => void;
}

function SortableHeader({ label, field, sorting, onSort }: SortableHeaderProps) {
  const isActive = sorting.sortBy === field;
  const iconRotation = isActive && sorting.sortOrder === "desc" ? "rotate-180" : "";

  return (
    <th
      className="p-3 text-left"
      scope="col"
      aria-sort={isActive ? (sorting.sortOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "flex items-center gap-1 text-xs font-medium uppercase tracking-wide",
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

interface SoftwareDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  software: SerializableSoftware | null;
}

function SoftwareDialog({ mode, open, onOpenChange, software }: SoftwareDialogProps) {
  const router = useRouter();
  const [deleteFeedback, setDeleteFeedback] = useState<ActionState | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDeleteFeedback(null);
      setIsDeleteDialogOpen(false);
    }
    onOpenChange(nextOpen);
  };

  const requestDelete = () => {
    if (!software) {
      return;
    }
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!software) {
      return;
    }

    setIsDeleteDialogOpen(false);

    const formData = new FormData();
    formData.set("softwareId", software.id);

    setDeleteFeedback(null);
    startDeleting(async () => {
      const result = await deleteSoftwareAction(formData);
      if (result.status === "error") {
        setDeleteFeedback(result);
        return;
      }
      router.refresh();
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

        <SoftwareForm
          mode={mode}
          software={software}
          onCompleted={() => {
            router.refresh();
            handleClose(false);
          }}
        />

        {mode === "edit" && software ? (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-4">
            <p className="text-sm font-medium text-destructive">Remover software</p>
            <p className="text-xs text-muted-foreground">
              A remoção não desfaz associações anteriores, mas impede novas associações.
            </p>
            <Button variant="destructive" onClick={requestDelete} disabled={isDeleting}>
              {isDeleting ? "Removendo..." : "Remover software"}
            </Button>
            {deleteFeedback?.status === "error" ? (
              <p className="text-sm text-destructive">{deleteFeedback.message}</p>
            ) : null}
            <ConfirmationDialog
              open={isDeleteDialogOpen}
              onOpenChange={setIsDeleteDialogOpen}
              title="Remover software"
              description={`Remover o software ${software.name}? Esta ação não pode ser desfeita.`}
              confirmLabel="Remover"
              confirmingLabel="Removendo..."
              onConfirm={handleDelete}
              isConfirming={isDeleting}
            />
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
  const [formState, formAction, isPending] = useServerActionToast(
    mode === "create" ? createSoftwareAction : updateSoftwareAction,
    idleActionState,
    {
      messages: {
        pending: mode === "create" ? "Cadastrando software..." : "Salvando alterações...",
        success: mode === "create" ? "Software cadastrado com sucesso." : "Software atualizado com sucesso.",
        error: mode === "create" ? "Não foi possível cadastrar o software." : "Não foi possível atualizar o software.",
      },
    },
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
