"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "loading";

type ToastDescriptor = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
  createdAt: number;
};

type CreateToastInput = {
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
};

type ToastContextValue = {
  toasts: ToastDescriptor[];
  push: (toast: CreateToastInput) => string;
  dismiss: (id: string) => void;
  update: (id: string, toast: Partial<Omit<ToastDescriptor, "id" | "createdAt" | "duration">>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastDescriptor[]>([]);

  const push = useCallback((toast: CreateToastInput) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const duration =
      typeof toast.duration === "number"
        ? toast.duration
        : toast.type === "loading"
          ? 0
          : 6000;

    setToasts((current) => [
      ...current,
      {
        id,
        type: toast.type,
        title: toast.title,
        description: toast.description,
        duration,
        createdAt: Date.now(),
      },
    ]);

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const update = useCallback(
    (id: string, partial: Partial<Omit<ToastDescriptor, "id" | "createdAt" | "duration">>) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id
            ? {
                ...toast,
                ...partial,
              }
            : toast,
        ),
      );
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ toasts, push, dismiss, update }), [toasts, push, dismiss, update]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast deve ser utilizado dentro de ToastProvider");
  }

  return context;
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  );
}

type ToastItemProps = {
  toast: ToastDescriptor;
  onDismiss: (id: string) => void;
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast.duration <= 0) {
      return undefined;
    }

    dismissTimerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [toast.duration, toast.id, onDismiss]);

  const Icon = resolveToastIcon(toast.type);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border/70 bg-background/95 p-4 text-sm shadow-lg backdrop-blur transition-all",
        toast.type === "error"
          ? "border-destructive/50 text-destructive"
          : toast.type === "success"
            ? "border-emerald-500/60 text-emerald-600 dark:text-emerald-400"
            : toast.type === "info"
              ? "border-sky-500/60 text-sky-600 dark:text-sky-300"
              : "border-border/70 text-muted-foreground",
      )}
    >
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center">
        <Icon className={cn("h-5 w-5", toast.type === "loading" ? "animate-spin" : undefined)} aria-hidden />
      </span>
      <div className="flex-1 space-y-1">
        <p className="font-medium text-foreground">{toast.title}</p>
        {toast.description ? (
          <p className="text-sm text-muted-foreground">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function resolveToastIcon(type: ToastType) {
  switch (type) {
    case "success":
      return CheckCircle2;
    case "error":
      return AlertTriangle;
    case "loading":
      return Loader2;
    default:
      return Info;
  }
}
