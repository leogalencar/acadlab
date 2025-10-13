"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { LaboratoryStatus, Role } from "@prisma/client";
import { useFormState } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignSoftwareToLaboratoryAction,
  createLaboratoryAction,
  createSoftwareAction,
  deleteLaboratoryAction,
  deleteSoftwareAction,
  removeSoftwareFromLaboratoryAction,
  updateLaboratoryAction,
  updateSoftwareAction,
} from "@/features/lab-management/server/actions";
import {
  canManageLaboratories,
  type ActionState,
  type LaboratoryFiltersState,
  type SerializableLaboratory,
  type SerializableSoftware,
} from "@/features/lab-management/types";

const LAB_STATUS_LABELS: Record<LaboratoryStatus, string> = {
  [LaboratoryStatus.ACTIVE]: "Ativo",
  [LaboratoryStatus.INACTIVE]: "Inativo",
};

const LAB_STATUS_STYLES: Record<LaboratoryStatus, string> = {
  [LaboratoryStatus.ACTIVE]: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30",
  [LaboratoryStatus.INACTIVE]: "bg-muted text-muted-foreground border-muted-foreground/30",
};

const initialActionState: ActionState = { status: "idle" };

interface LaboratoryManagementViewProps {
  actorRole: Role;
  laboratories: SerializableLaboratory[];
  softwareCatalog: SerializableSoftware[];
  filters: LaboratoryFiltersState;
}

export function LaboratoryManagementView({
  actorRole,
  laboratories,
  softwareCatalog,
  filters,
}: LaboratoryManagementViewProps) {
  const canManage = canManageLaboratories(actorRole);
  const hasFilters = Boolean(filters.availableFrom && filters.availableTo) || filters.softwareIds.length > 0;

  const filterDescription = buildFilterDescription(filters);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Laboratórios cadastrados</h1>
          <p className="text-sm text-muted-foreground">
            Consulte a capacidade, o status operacional e os softwares disponíveis em cada laboratório.
            {hasFilters ? ` ${filterDescription}` : ""}
          </p>
        </div>
        {laboratories.length > 0 ? (
          <div className="space-y-4">
            {laboratories.map((laboratory) => (
              <LaboratoryCard
                key={laboratory.id}
                laboratory={laboratory}
                softwareCatalog={softwareCatalog}
                canManage={canManage}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            <p>
              {hasFilters
                ? "Nenhum laboratório atende aos filtros selecionados. Ajuste os critérios para visualizar outras opções."
                : canManage
                  ? "Nenhum laboratório cadastrado até o momento. Utilize o formulário abaixo para registrar o primeiro laboratório."
                  : "Nenhum laboratório está disponível no momento. Solicite ao time técnico o cadastro dos ambientes."}
            </p>
          </div>
        )}
      </section>

      {canManage ? (
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Gestão de laboratórios e softwares</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre novos laboratórios, atualize informações existentes e mantenha o catálogo de softwares disponível.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CreateLaboratoryCard />
            <CreateSoftwareCard />
          </div>

          <SoftwareCatalogList softwareCatalog={softwareCatalog} />
        </section>
      ) : null}
    </div>
  );
}

interface LaboratoryCardProps {
  laboratory: SerializableLaboratory;
  softwareCatalog: SerializableSoftware[];
  canManage: boolean;
}

function LaboratoryCard({ laboratory, softwareCatalog, canManage }: LaboratoryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<ActionState | null>(null);
  const [removalFeedback, setRemovalFeedback] = useState<ActionState | null>(null);
  const [pendingRemovalSoftware, setPendingRemovalSoftware] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [isRemoving, startRemoving] = useTransition();

  const [updateState, updateAction] = useFormState(updateLaboratoryAction, initialActionState);

  useEffect(() => {
    if (updateState.status === "success") {
      setIsEditing(false);
    }
  }, [updateState.status]);

  const [assignState, assignAction] = useFormState(assignSoftwareToLaboratoryAction, initialActionState);
  const assignFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (assignState.status === "success") {
      assignFormRef.current?.reset();
    }
  }, [assignState.status]);

  const availableSoftware = useMemo(
    () =>
      softwareCatalog.filter(
        (software) =>
          !laboratory.software.some((installed) => installed.softwareId === software.id),
      ),
    [softwareCatalog, laboratory.software],
  );

  const handleDelete = async (formData: FormData) => {
    if (!window.confirm(`Remover o laboratório ${laboratory.name}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setDeleteFeedback(null);
    startDeleting(async () => {
      const result = await deleteLaboratoryAction(formData);
      if (result.status === "error") {
        setDeleteFeedback(result);
      }
    });
  };

  const handleRemoveSoftware = async (formData: FormData) => {
    setRemovalFeedback(null);
    const softwareId = formData.get("softwareId") as string | null;
    setPendingRemovalSoftware(softwareId);

    startRemoving(async () => {
      const result = await removeSoftwareFromLaboratoryAction(formData);
      if (result.status === "error") {
        setRemovalFeedback(result);
      }
      setPendingRemovalSoftware(null);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{laboratory.name}</CardTitle>
          <CardDescription>
            Capacidade para {laboratory.capacity} {laboratory.capacity === 1 ? "estação" : "estações"}.
            {laboratory.isAvailableForSelectedRange
              ? " Disponível para o período selecionado."
              : null}
          </CardDescription>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${LAB_STATUS_STYLES[laboratory.status]}`}
        >
          {LAB_STATUS_LABELS[laboratory.status]}
        </span>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 text-sm">
          {laboratory.description ? (
            <p className="text-muted-foreground">{laboratory.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">Capacidade:</span> {laboratory.capacity} estações
            </span>
            <span>
              <span className="font-medium text-foreground">Status:</span> {LAB_STATUS_LABELS[laboratory.status]}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Softwares instalados</h3>
          {laboratory.software.length > 0 ? (
            <ul className="space-y-2">
              {laboratory.software.map((software) => (
                <li
                  key={software.softwareId}
                  className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">
                      {software.name} • {software.version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {software.supplier ? `Fornecedor: ${software.supplier} • ` : ""}
                      Instalado em {formatDateTime(software.installedAt)}
                      {software.installedByName ? ` por ${software.installedByName}` : ""}
                    </p>
                  </div>
                  {canManage ? (
                    <form action={handleRemoveSoftware} className="flex items-center gap-2">
                      <input type="hidden" name="laboratoryId" value={laboratory.id} />
                      <input type="hidden" name="softwareId" value={software.softwareId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        className="text-sm text-destructive hover:text-destructive"
                        disabled={isRemoving && pendingRemovalSoftware === software.softwareId}
                      >
                        Remover
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum software registrado neste laboratório.</p>
          )}

          {canManage ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <form ref={assignFormRef} action={assignAction} className="space-y-3">
                <input type="hidden" name="laboratoryId" value={laboratory.id} />
                <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
                  <div className="space-y-1">
                    <Label htmlFor={`assign-${laboratory.id}`}>Adicionar software</Label>
                    <select
                      id={`assign-${laboratory.id}`}
                      name="softwareId"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      defaultValue=""
                      disabled={availableSoftware.length === 0}
                      required
                    >
                      <option value="" disabled hidden>
                        Selecione um software
                      </option>
                      {availableSoftware.map((software) => (
                        <option key={software.id} value={software.id}>
                          {software.name} • {software.version}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={availableSoftware.length === 0}>
                      Associar
                    </Button>
                  </div>
                </div>
                {availableSoftware.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todos os softwares cadastrados já estão associados a este laboratório.
                  </p>
                ) : null}
                {assignState.status === "error" ? (
                  <p className="text-xs text-destructive">{assignState.message}</p>
                ) : null}
                {assignState.status === "success" ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Software associado com sucesso.</p>
                ) : null}
              </form>
            </div>
          ) : null}

          {removalFeedback?.status === "error" ? (
            <p className="text-xs text-destructive">{removalFeedback.message}</p>
          ) : null}
        </div>

        {canManage ? (
          <div className="space-y-3">
            {isEditing ? (
              <form ref={updateFormRef} action={updateAction} className="space-y-4">
                <input type="hidden" name="laboratoryId" value={laboratory.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`name-${laboratory.id}`}>Nome do laboratório</Label>
                    <Input
                      id={`name-${laboratory.id}`}
                      name="name"
                      defaultValue={laboratory.name}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`capacity-${laboratory.id}`}>Capacidade (estações)</Label>
                    <Input
                      id={`capacity-${laboratory.id}`}
                      name="capacity"
                      type="number"
                      min={1}
                      defaultValue={laboratory.capacity}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`status-${laboratory.id}`}>Status</Label>
                    <select
                      id={`status-${laboratory.id}`}
                      name="status"
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      defaultValue={laboratory.status}
                    >
                      <option value={LaboratoryStatus.ACTIVE}>{LAB_STATUS_LABELS[LaboratoryStatus.ACTIVE]}</option>
                      <option value={LaboratoryStatus.INACTIVE}>{LAB_STATUS_LABELS[LaboratoryStatus.INACTIVE]}</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`description-${laboratory.id}`}>Descrição (opcional)</Label>
                    <textarea
                      id={`description-${laboratory.id}`}
                      name="description"
                      defaultValue={laboratory.description ?? ""}
                      className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
                {updateState.status === "error" ? (
                  <p className="text-sm text-destructive">{updateState.message}</p>
                ) : null}
                {updateState.status === "success" ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Laboratório atualizado com sucesso.</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Salvar alterações</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Editar laboratório
                </Button>
                <form action={handleDelete}>
                  <input type="hidden" name="laboratoryId" value={laboratory.id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isDeleting}
                  >
                    Remover
                  </Button>
                </form>
              </div>
            )}
            {deleteFeedback?.status === "error" ? (
              <p className="text-sm text-destructive">{deleteFeedback.message}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreateLaboratoryCard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createLaboratoryAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastrar laboratório</CardTitle>
        <CardDescription>
          Informe os dados básicos para disponibilizar um novo laboratório no sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lab-name">Nome do laboratório</Label>
              <Input id="lab-name" name="name" placeholder="Laboratório de Redes" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lab-capacity">Capacidade (estações)</Label>
              <Input id="lab-capacity" name="capacity" type="number" min={1} placeholder="20" required />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lab-status">Status</Label>
              <select
                id="lab-status"
                name="status"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                defaultValue={LaboratoryStatus.ACTIVE}
              >
                <option value={LaboratoryStatus.ACTIVE}>{LAB_STATUS_LABELS[LaboratoryStatus.ACTIVE]}</option>
                <option value={LaboratoryStatus.INACTIVE}>{LAB_STATUS_LABELS[LaboratoryStatus.INACTIVE]}</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lab-description">Descrição (opcional)</Label>
              <textarea
                id="lab-description"
                name="description"
                placeholder="Infraestrutura com 20 computadores e projetor multimídia."
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          {state.status === "error" ? (
            <p className="text-sm text-destructive" role="alert">
              {state.message ?? "Não foi possível cadastrar o laboratório."}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Laboratório cadastrado com sucesso.
            </p>
          ) : null}
          <Button type="submit">Cadastrar laboratório</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateSoftwareCard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createSoftwareAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastrar software</CardTitle>
        <CardDescription>
          Registre softwares disponíveis para instalação nos laboratórios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="software-name">Nome do software</Label>
              <Input id="software-name" name="name" placeholder="Pacote Office" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="software-version">Versão</Label>
              <Input id="software-version" name="version" placeholder="2024" required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="software-supplier">Fornecedor (opcional)</Label>
            <Input id="software-supplier" name="supplier" placeholder="Microsoft" />
          </div>
          {state.status === "error" ? (
            <p className="text-sm text-destructive" role="alert">
              {state.message ?? "Não foi possível cadastrar o software."}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Software cadastrado com sucesso.
            </p>
          ) : null}
          <Button type="submit">Cadastrar software</Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface SoftwareCatalogListProps {
  softwareCatalog: SerializableSoftware[];
}

function SoftwareCatalogList({ softwareCatalog }: SoftwareCatalogListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Softwares cadastrados</CardTitle>
        <CardDescription>
          Atualize informações de softwares existentes ou remova itens que não estão mais em uso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {softwareCatalog.length > 0 ? (
          <div className="space-y-4">
            {softwareCatalog.map((software) => (
              <SoftwareRow key={software.id} software={software} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum software cadastrado até o momento.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface SoftwareRowProps {
  software: SerializableSoftware;
}

function SoftwareRow({ software }: SoftwareRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<ActionState | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const [state, formAction] = useFormState(updateSoftwareAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      setIsEditing(false);
    }
  }, [state.status]);

  const handleDelete = async (formData: FormData) => {
    if (!window.confirm(`Remover o software ${software.name}?`)) {
      return;
    }

    setDeleteFeedback(null);
    startDeleting(async () => {
      const result = await deleteSoftwareAction(formData);
      if (result.status === "error") {
        setDeleteFeedback(result);
      }
    });
  };

  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
      {isEditing ? (
        <form action={formAction} className="space-y-3 text-sm">
          <input type="hidden" name="softwareId" value={software.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`software-name-${software.id}`}>Nome</Label>
              <Input
                id={`software-name-${software.id}`}
                name="name"
                defaultValue={software.name}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`software-version-${software.id}`}>Versão</Label>
              <Input
                id={`software-version-${software.id}`}
                name="version"
                defaultValue={software.version}
                required
              />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`software-supplier-${software.id}`}>Fornecedor (opcional)</Label>
              <Input
                id={`software-supplier-${software.id}`}
                name="supplier"
                defaultValue={software.supplier ?? ""}
              />
            </div>
          </div>
          {state.status === "error" ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}
          {state.status === "success" ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Software atualizado com sucesso.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {software.name} • {software.version}
            </p>
            {software.supplier ? (
              <p className="text-xs text-muted-foreground">Fornecedor: {software.supplier}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Editar
            </Button>
            <form action={handleDelete}>
              <input type="hidden" name="softwareId" value={software.id} />
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                Remover
              </Button>
            </form>
          </div>
        </div>
      )}
      {deleteFeedback?.status === "error" ? (
        <p className="mt-2 text-sm text-destructive">{deleteFeedback.message}</p>
      ) : null}
    </div>
  );
}

function buildFilterDescription(filters: LaboratoryFiltersState): string {
  const availabilityActive = Boolean(filters.availableFrom && filters.availableTo);
  const softwareActive = filters.softwareIds.length > 0;

  if (!availabilityActive && !softwareActive) {
    return "";
  }

  const parts: string[] = [];

  if (availabilityActive && filters.availableFrom && filters.availableTo) {
    const start = formatDateTime(filters.availableFrom);
    const end = formatDateTime(filters.availableTo);

    if (start && end) {
      parts.push(` Filtros de disponibilidade entre ${start} e ${end}.`);
    }
  }

  if (softwareActive) {
    parts.push(
      ` Filtros por software aplicados (${filters.softwareIds.length} selecionado${
        filters.softwareIds.length > 1 ? "s" : ""
      }).`,
    );
  }

  return parts.join(" ");
}

function formatDateTime(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
