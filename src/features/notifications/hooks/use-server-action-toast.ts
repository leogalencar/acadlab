"use client";

import { useActionState } from "react";
import { useEffect, useRef } from "react";

import type { ActionState } from "@/features/shared/types";
import { useToast } from "@/features/notifications/components/toast-provider";

type ToastMessages = {
  pending?: string | null;
  success?: string;
  error?: string;
};

type UseServerActionToastOptions = {
  messages?: ToastMessages;
};

type ServerAction<TState extends ActionState, TPayload> = (
  state: TState,
  payload: TPayload,
) => TState | Promise<TState>;

export function useServerActionToast<TState extends ActionState, TPayload>(
  action: ServerAction<TState, TPayload>,
  initialState: TState,
  options?: UseServerActionToastOptions,
) {
  const { push, dismiss } = useToast();
  const pendingToastId = useRef<string | null>(null);
  const lastStatusRef = useRef<TState["status"] | null>(initialState.status ?? null);

  const hookResult = useActionState(
    action as unknown as (
      state: Awaited<TState>,
      payload: TPayload,
    ) => Awaited<TState> | Promise<Awaited<TState>>,
    initialState as Awaited<TState>,
  );
  const [state, , isPending] = hookResult;

  useEffect(() => {
    if (isPending) {
      if (pendingToastId.current === null) {
        const pendingMessage = options?.messages?.pending ?? "Processando solicitação...";

        if (pendingMessage !== null) {
          pendingToastId.current = push({
            type: "loading",
            title: pendingMessage,
          });
        }
      }
      return;
    }

    if (pendingToastId.current) {
      dismiss(pendingToastId.current);
      pendingToastId.current = null;
    }
  }, [isPending, push, dismiss, options?.messages?.pending]);

  useEffect(() => {
    return () => {
      if (pendingToastId.current) {
        dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
    };
  }, [dismiss]);

  useEffect(() => {
    if (state.status === lastStatusRef.current) {
      return;
    }

    if (state.status === "success") {
      const message = state.message ?? options?.messages?.success ?? "Ação concluída com sucesso.";
      push({
        type: "success",
        title: message,
      });
    } else if (state.status === "error") {
      const message = state.message ?? options?.messages?.error ?? "Não foi possível concluir a ação.";
      push({
        type: "error",
        title: message,
      });
    }

    lastStatusRef.current = state.status ?? null;
  }, [state, push, options?.messages?.success, options?.messages?.error]);

  return hookResult;
}
