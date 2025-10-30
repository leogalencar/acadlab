"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReservationStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReservationHistoryFilters } from "@/features/scheduling/server/queries";
import type { SchedulableUserOption, SerializableLaboratoryOption } from "@/features/scheduling/types";
import { cn } from "@/lib/utils";

interface HistoryFiltersProps {
  laboratories: SerializableLaboratoryOption[];
  users: SchedulableUserOption[];
  initialFilters: ReservationHistoryFilters;
  canViewAllUsers: boolean;
}

type StatusOption = ReservationStatus | "ALL";
type RecurrenceOption = "single" | "recurring" | "all";

const STATUS_OPTIONS: Array<{ value: StatusOption; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "CONFIRMED", label: "Confirmadas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "CANCELLED", label: "Canceladas" },
];

const RECURRENCE_OPTIONS: Array<{ value: RecurrenceOption; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "single", label: "Únicas" },
  { value: "recurring", label: "Recorrentes" },
];

interface FilterState {
  status: StatusOption;
  laboratoryId: string;
  userId: string;
  from: string;
  to: string;
  recurrence: RecurrenceOption;
}

export function HistoryFilters({
  laboratories,
  users,
  initialFilters,
  canViewAllUsers,
}: HistoryFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FilterState>(() => ({
    status: initialFilters.status ?? "ALL",
    laboratoryId: initialFilters.laboratoryId ?? "all",
    userId: initialFilters.userId ?? "all",
    from: initialFilters.from ?? "",
    to: initialFilters.to ?? "",
    recurrence: initialFilters.recurrence ?? "all",
  }));

  useEffect(() => {
    setState({
      status: initialFilters.status ?? "ALL",
      laboratoryId: initialFilters.laboratoryId ?? "all",
      userId: initialFilters.userId ?? "all",
      from: initialFilters.from ?? "",
      to: initialFilters.to ?? "",
      recurrence: initialFilters.recurrence ?? "all",
    });
  }, [initialFilters.status, initialFilters.laboratoryId, initialFilters.userId, initialFilters.from, initialFilters.to, initialFilters.recurrence]);

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (state.status && state.status !== "ALL") {
      params.set("status", state.status);
    }

    if (state.laboratoryId && state.laboratoryId !== "all") {
      params.set("laboratoryId", state.laboratoryId);
    }

    if (canViewAllUsers && state.userId && state.userId !== "all") {
      params.set("userId", state.userId);
    }

    if (state.from) {
      params.set("from", state.from);
    }

    if (state.to) {
      params.set("to", state.to);
    }

    if (state.recurrence && state.recurrence !== "all") {
      params.set("recurrence", state.recurrence);
    }

    const search = params.toString();
    startTransition(() => {
      router.push(search ? `/dashboard/scheduling/history?${search}` : "/dashboard/scheduling/history");
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      router.push("/dashboard/scheduling/history");
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-background/95 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Filtros</p>
          <p className="text-xs text-muted-foreground">
            Combine filtros para localizar reservas específicas no histórico.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={isPending}>
            Limpar filtros
          </Button>
          <Button type="button" size="sm" onClick={applyFilters} disabled={isPending}>
            {isPending ? "Aplicando..." : "Aplicar filtros"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="history-status" className="text-xs font-medium uppercase text-muted-foreground">
            Status
          </label>
          <select
            id="history-status"
            value={state.status}
            onChange={(event) =>
              setState((prev) => ({ ...prev, status: event.currentTarget.value as StatusOption }))
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="history-laboratory" className="text-xs font-medium uppercase text-muted-foreground">
            Laboratório
          </label>
          <select
            id="history-laboratory"
            value={state.laboratoryId}
            onChange={(event) =>
              setState((prev) => ({ ...prev, laboratoryId: event.currentTarget.value }))
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos</option>
            {laboratories.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="history-recurrence" className="text-xs font-medium uppercase text-muted-foreground">
            Tipo de reserva
          </label>
          <select
            id="history-recurrence"
            value={state.recurrence}
            onChange={(event) =>
              setState((prev) => ({ ...prev, recurrence: event.currentTarget.value as RecurrenceOption }))
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {RECURRENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="history-from" className="text-xs font-medium uppercase text-muted-foreground">
            A partir de
          </label>
          <Input
            id="history-from"
            type="date"
            value={state.from}
            onChange={(event) =>
              setState((prev) => ({ ...prev, from: event.currentTarget.value }))
            }
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="history-to" className="text-xs font-medium uppercase text-muted-foreground">
            Até
          </label>
          <Input
            id="history-to"
            type="date"
            value={state.to}
            onChange={(event) =>
              setState((prev) => ({ ...prev, to: event.currentTarget.value }))
            }
          />
        </div>

        {canViewAllUsers ? (
          <div className="space-y-1">
            <label htmlFor="history-user" className="text-xs font-medium uppercase text-muted-foreground">
              Responsável
            </label>
            <select
              id="history-user"
              value={state.userId}
              onChange={(event) =>
                setState((prev) => ({ ...prev, userId: event.currentTarget.value }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <p className={cn("text-xs text-muted-foreground", isPending && "opacity-70")}>
        {isPending
          ? "Aplicando filtros..."
          : "Filtros são aplicados imediatamente após clicar em \"Aplicar filtros\"."}
      </p>
    </div>
  );
}
