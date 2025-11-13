"use client";

import { useEffect, useMemo, useState } from "react";
import { Role, SoftwareRequestStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight, ChevronUp, CircleX, Loader2, NotebookPen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SoftwareRequestStatusBadge } from "@/features/software-requests/components/status-badge";
import {
  SOFTWARE_REQUEST_STATUS_LABELS,
  canManageSoftwareRequests,
  type SerializableSoftwareRequest,
  type SoftwareRequestPaginationState,
  type SoftwareRequestSortField,
  type SoftwareRequestSortingState,
  type SoftwareRequestStatusCounts,
} from "@/features/software-requests/types";
import {
  cancelSoftwareRequestAction,
  updateSoftwareRequestStatusAction,
} from "@/features/software-requests/server/actions";
import { PAGE_SIZE_OPTIONS } from "@/features/shared/table";
import { idleActionState } from "@/features/shared/types";
import { cn, formatDate } from "@/lib/utils";
import { useServerActionToast } from "@/features/notifications/hooks/use-server-action-toast";

const MANAGER_STATUS_OPTIONS: SoftwareRequestStatus[] = [
  SoftwareRequestStatus.PENDING,
  SoftwareRequestStatus.APPROVED,
  SoftwareRequestStatus.REJECTED,
];

interface SoftwareRequestsClientProps {
  actorId: string;
  actorRole: Role;
  requests: SerializableSoftwareRequest[];
  sorting: SoftwareRequestSortingState;
  pagination: SoftwareRequestPaginationState;
  statusCounts: SoftwareRequestStatusCounts;
}

export function SoftwareRequestsClient({
  actorId,
  actorRole,
  requests,
  sorting,
  pagination,
  statusCounts,
}: SoftwareRequestsClientProps) {
  const canManage = canManageSoftwareRequests(actorRole);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogKey, setStatusDialogKey] = useState(0);
  const [detailsRequestId, setDetailsRequestId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) {
      return null;
    }
    return requests.find((request) => request.id === selectedRequestId) ?? null;
  }, [requests, selectedRequestId]);

  useEffect(() => {
    if (!selectedRequestId) {
      return;
    }
    const exists = requests.some((request) => request.id === selectedRequestId);
    if (!exists) {
      setStatusDialogOpen(false);
      setSelectedRequestId(null);
      setStatusDialogKey((key) => key + 1);
    }
  }, [requests, selectedRequestId]);

  const detailsRequest = useMemo(() => {
    if (!detailsRequestId) {
      return null;
    }
    return requests.find((request) => request.id === detailsRequestId) ?? null;
  }, [detailsRequestId, requests]);

  useEffect(() => {
    if (!detailsRequestId) {
      return;
    }
    const exists = requests.some((request) => request.id === detailsRequestId);
    if (!exists) {
      setDetailsDialogOpen(false);
      setDetailsRequestId(null);
    }
  }, [detailsRequestId, requests]);

  useEffect(() => {
    if (!cancelRequestId) {
      return;
    }
    const exists = requests.some((request) => request.id === cancelRequestId);
    if (!exists) {
      setCancelDialogOpen(false);
      setCancelRequestId(null);
    }
  }, [cancelRequestId, requests]);

  const cancelableRequest = useMemo(() => {
    if (!cancelRequestId) {
      return null;
    }
    return requests.find((request) => request.id === cancelRequestId) ?? null;
  }, [cancelRequestId, requests]);

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

  const handleSortChange = (field: SoftwareRequestSortField) => {
    const isSameField = sorting.sortBy === field;
    const nextOrder = isSameField && sorting.sortOrder === "asc" ? "desc" : "asc";
    updateQueryParams({ sortBy: field, sortOrder: nextOrder, page: "1" });
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
  const hasOwnPendingRequests = useMemo(
    () =>
      requests.some(
        (request) => request.requester.id === actorId && request.status === SoftwareRequestStatus.PENDING,
      ),
    [actorId, requests],
  );
  const showActionsColumn = canManage || hasOwnPendingRequests;

  const handleOpenStatusDialog = (requestId: string) => {
    setSelectedRequestId(requestId);
    setStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    setStatusDialogOpen(false);
    setSelectedRequestId(null);
    setStatusDialogKey((key) => key + 1);
  };

  const handleOpenDetailsDialog = (requestId: string) => {
    setDetailsRequestId(requestId);
    setDetailsDialogOpen(true);
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setDetailsRequestId(null);
  };

  const handleOpenCancelDialog = (requestId: string) => {
    setCancelRequestId(requestId);
    setCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    setCancelDialogOpen(false);
    setCancelRequestId(null);
  };

  return (
    <div className="space-y-6">
      <StatusSummary statusCounts={statusCounts} canManage={canManage} />

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Software" field="softwareName" sorting={sorting} onSort={handleSortChange} />
              <th className="p-3 text-left font-medium">Laboratório</th>
              <th className="p-3 text-left font-medium">Solicitante</th>
              <SortableHeader label="Status" field="status" sorting={sorting} onSort={handleSortChange} />
              <SortableHeader label="Atualizado em" field="updatedAt" sorting={sorting} onSort={handleSortChange} />
              {showActionsColumn ? <th className="p-3 text-right font-medium">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {requests.length > 0 ? (
              requests.map((request) => (
                <tr
                  key={request.id}
                  className="border-t border-border/60 transition-colors hover:bg-muted/20"
                  onClick={() => handleOpenDetailsDialog(request.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenDetailsDialog(request.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  >
                    <td className="p-4 align-middle">
                      <p className="font-medium text-foreground">
                        {request.softwareName}
                        {request.softwareVersion ? (
                          <span className="text-muted-foreground"> • {request.softwareVersion}</span>
                        ) : null}
                      </p>
                    </td>
                    <td className="p-4 align-middle">
                      <p className="font-medium text-foreground">{request.laboratory.name}</p>
                    </td>
                    <td className="p-4 align-middle">
                      <p className="font-medium text-foreground">{request.requester.name}</p>
                    </td>
                    <td className="p-4 align-middle">
                      <SoftwareRequestStatusBadge status={request.status} />
                    </td>
                    <td className="p-4 align-middle text-xs text-muted-foreground">{formatDate(request.updatedAt)}</td>
                    {showActionsColumn ? (
                      <td className="p-4 align-middle text-right">
                        <div className="flex flex-col items-end gap-2">
                          {canManage && request.status !== SoftwareRequestStatus.CANCELLED ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenStatusDialog(request.id);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <NotebookPen className="size-4" aria-hidden />
                              Atualizar status
                            </Button>
                          ) : null}
                          {request.requester.id === actorId && request.status === SoftwareRequestStatus.PENDING ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenCancelDialog(request.id);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <CircleX className="size-4" aria-hidden />
                              Cancelar solicitação
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showActionsColumn ? 6 : 5} className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma solicitação encontrada. Ajuste os filtros ou solicite um novo software a partir da tela de
                  laboratórios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 text-sm md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground">
          {hasResults
            ? `Mostrando ${rangeStart}-${rangeEnd} de ${total} solicitação${total === 1 ? "" : "es"}`
            : "Nenhuma solicitação encontrada."}
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

      {detailsRequest ? (
        <SoftwareRequestDetailsDialog
          request={detailsRequest}
          actorRole={actorRole}
          open={detailsDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseDetailsDialog();
            } else {
              setDetailsDialogOpen(true);
            }
          }}
        />
      ) : null}

      {canManage && selectedRequest ? (
        <UpdateRequestStatusDialog
          key={statusDialogKey}
          open={statusDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseStatusDialog();
            } else {
              setStatusDialogOpen(true);
            }
          }}
          request={selectedRequest}
          onUpdated={() => {
            router.refresh();
            handleCloseStatusDialog();
          }}
        />
      ) : null}

      {cancelableRequest ? (
        <CancelSoftwareRequestDialog
          request={cancelableRequest}
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseCancelDialog();
            } else {
              setCancelDialogOpen(true);
            }
          }}
          onCancelled={() => {
            router.refresh();
            handleCloseCancelDialog();
          }}
        />
      ) : null}
    </div>
  );
}

interface StatusSummaryProps {
  statusCounts: SoftwareRequestStatusCounts;
  canManage: boolean;
}

function StatusSummary({ statusCounts, canManage }: StatusSummaryProps) {
  const cards: Array<{
    status: SoftwareRequestStatus;
    description: string;
  }> = [
    {
      status: SoftwareRequestStatus.PENDING,
      description: canManage
        ? "Solicitações aguardando análise da equipe técnica."
        : "Pedidos enviados e ainda não avaliados.",
    },
    {
      status: SoftwareRequestStatus.APPROVED,
      description: canManage
        ? "Itens liberados para instalação."
        : "Solicitações já autorizadas para uso.",
    },
    {
      status: SoftwareRequestStatus.REJECTED,
      description: "Solicitações recusadas ou com orientação alternativa.",
    },
    {
      status: SoftwareRequestStatus.CANCELLED,
      description: canManage
        ? "Pedidos cancelados pelos solicitantes antes da análise."
        : "Solicitações que você optou por retirar.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.status} className="border border-border/60">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              {SOFTWARE_REQUEST_STATUS_LABELS[card.status]}
              <span className="text-2xl font-bold text-foreground">{statusCounts[card.status]}</span>
            </CardTitle>
            <CardDescription>{card.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: SoftwareRequestSortField;
  sorting: SoftwareRequestSortingState;
  onSort: (field: SoftwareRequestSortField) => void;
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

interface UpdateRequestStatusDialogProps {
  request: SerializableSoftwareRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

function UpdateRequestStatusDialog({ request, open, onOpenChange, onUpdated }: UpdateRequestStatusDialogProps) {
  const [formState, formAction, isPending] = useServerActionToast(
    updateSoftwareRequestStatusAction,
    idleActionState,
    {
      messages: {
        pending: "Atualizando status...",
        success: "Status atualizado com sucesso.",
        error: "Não foi possível atualizar o status.",
      },
    },
  );

  useEffect(() => {
    if (formState.status === "success") {
      onUpdated();
    }
  }, [formState.status, onUpdated]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atualizar status da solicitação</DialogTitle>
          <DialogDescription>
            Revise os detalhes abaixo e defina o status apropriado para o pedido enviado pelo docente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Software solicitado</p>
            <p className="text-base font-semibold text-foreground">
              {request.softwareName}
              {request.softwareVersion ? <span className="text-muted-foreground"> • {request.softwareVersion}</span> : null}
            </p>
            {request.justification ? (
              <p className="mt-2 text-sm text-muted-foreground">{request.justification}</p>
            ) : null}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              Laboratório: <span className="font-medium text-foreground">{request.laboratory.name}</span>
            </p>
            <p>
              Solicitante: <span className="font-medium text-foreground">{request.requester.name}</span>
            </p>
            <p>Registrada em {formatDate(request.createdAt)}</p>
          </div>
        </div>

        <form id={`update-request-${request.id}`} action={formAction} className="space-y-4 pt-2">
          <input type="hidden" name="requestId" value={request.id} />
          <div className="grid gap-2">
            <Label htmlFor={`status-${request.id}`}>Status</Label>
            <select
              id={`status-${request.id}`}
              name="status"
              defaultValue={request.status}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isPending}
            >
              {MANAGER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {SOFTWARE_REQUEST_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`notes-${request.id}`}>Observações para o solicitante (opcional)</Label>
            <textarea
              id={`notes-${request.id}`}
              name="responseNotes"
              rows={4}
              maxLength={600}
              defaultValue={request.responseNotes ?? ""}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Compartilhe orientações, prazos ou justificativas para a decisão."
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Máximo de 600 caracteres.</p>
          </div>
          {formState.status === "error" ? <p className="text-sm text-destructive">{formState.message}</p> : null}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={`update-request-${request.id}`}
            disabled={isPending}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Salvando...
              </>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CancelSoftwareRequestDialogProps {
  request: SerializableSoftwareRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

function CancelSoftwareRequestDialog({ request, open, onOpenChange, onCancelled }: CancelSoftwareRequestDialogProps) {
  const [formState, formAction, isPending] = useServerActionToast(
    cancelSoftwareRequestAction,
    idleActionState,
    {
      messages: {
        pending: "Cancelando solicitação...",
        success: "Solicitação cancelada.",
        error: "Não foi possível cancelar a solicitação.",
      },
    },
  );

  useEffect(() => {
    if (formState.status === "success") {
      onCancelled();
    }
  }, [formState.status, onCancelled]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancelar solicitação de software</DialogTitle>
          <DialogDescription>
            Esta ação remove o pedido e notifica a equipe técnica. Use somente para solicitações criadas por engano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Software</p>
            <p className="text-base font-semibold text-foreground">
              {request.softwareName}
              {request.softwareVersion ? (
                <span className="text-muted-foreground"> • {request.softwareVersion}</span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">Laboratório {request.laboratory.name}</p>
          </div>
        </div>

        <form id={`cancel-request-${request.id}`} action={formAction} className="space-y-4">
          <input type="hidden" name="requestId" value={request.id} />
          <div className="grid gap-2">
            <Label htmlFor={`cancel-reason-${request.id}`}>Motivo (opcional)</Label>
            <textarea
              id={`cancel-reason-${request.id}`}
              name="reason"
              rows={3}
              maxLength={400}
              placeholder="Compartilhe um contexto para o cancelamento, se necessário."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Máximo de 400 caracteres.</p>
          </div>
          {formState.status === "error" ? <p className="text-sm text-destructive">{formState.message}</p> : null}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            Voltar
          </Button>
          <Button
            type="submit"
            form={`cancel-request-${request.id}`}
            variant="destructive"
            disabled={isPending}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Cancelando...
              </>
            ) : (
              "Confirmar cancelamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SoftwareRequestDetailsDialogProps {
  request: SerializableSoftwareRequest;
  actorRole: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SoftwareRequestDetailsDialog({ request, actorRole, open, onOpenChange }: SoftwareRequestDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes da solicitação</DialogTitle>
          <DialogDescription>
            Consulte as informações completas do pedido e acompanhe o histórico de análise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm text-muted-foreground">
          <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/40 p-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Software</p>
              <p className="text-base font-semibold text-foreground">
                {request.softwareName}
                {request.softwareVersion ? (
                  <span className="text-muted-foreground"> • {request.softwareVersion}</span>
                ) : null}
              </p>
              {request.justification ? (
                <p className="mt-2 leading-relaxed">{request.justification}</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground/80">Sem justificativa adicional fornecida.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Status</p>
              <div className="mt-1 flex items-center gap-2">
                <SoftwareRequestStatusBadge status={request.status} />
                <span className="text-xs">Atualizado em {formatDate(request.updatedAt)}</span>
              </div>
              {request.reviewer && request.reviewedAt ? (
                <p className="mt-2">
                  Última análise por{" "}
                  <span className="font-medium text-foreground">{request.reviewer.name}</span> em{" "}
                  <span className="font-medium text-foreground">{formatDate(request.reviewedAt)}</span>
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground/80">Aguardando avaliação da equipe técnica.</p>
              )}
              {request.responseNotes ? (
                <p className="mt-2 leading-relaxed text-primary/80">Observações da revisão: {request.responseNotes}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Solicitado em</p>
              <p className="text-sm font-medium text-foreground">{formatDate(request.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Laboratório</p>
              <p className="text-sm font-medium text-foreground">{request.laboratory.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">Solicitante</p>
              <p className="text-sm font-medium text-foreground">{request.requester.name}</p>
              {actorRole === Role.ADMIN ? (
                <p className="text-xs text-muted-foreground">Identificador: {request.requester.id}</p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
