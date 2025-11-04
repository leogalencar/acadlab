"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  CircleCheck,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/features/notifications/components/toast-provider";
import {
  clearNotificationsAction,
  deleteNotificationAction,
  loadNotificationsAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/features/notifications/server/actions";
import type { NotificationItem } from "@/features/notifications/types";
import { formatRelativeTime } from "@/features/notifications/utils";
import { cn } from "@/lib/utils";

type PendingNotificationAction = {
  id: string;
  type: "mark" | "delete";
};

interface NotificationsMenuProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}

const POLLING_INTERVAL_MS = 20_000;

export function NotificationsMenu({ initialNotifications, initialUnreadCount }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [pendingNotification, setPendingNotification] = useState<PendingNotificationAction | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const fetchInFlightRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();

  const applyOverview = useCallback(({
    notifications: nextNotifications,
    unreadCount: nextUnread,
  }: {
    notifications: NotificationItem[];
    unreadCount: number;
  }) => {
    setNotifications(nextNotifications);
    setUnreadCount(nextUnread);
  }, []);

  const fetchOverview = useCallback(
    async ({ showErrorToast = false }: { showErrorToast?: boolean } = {}) => {
      if (fetchInFlightRef.current) {
        return;
      }

      fetchInFlightRef.current = true;
      try {
        const result = await loadNotificationsAction();
        applyOverview(result);
      } catch (error) {
        console.error("[notifications] Falha ao carregar notificações", error);
        if (showErrorToast) {
          push({
            type: "error",
            title: "Não foi possível carregar as notificações.",
          });
        }
      } finally {
        fetchInFlightRef.current = false;
        setIsRefreshing(false);
      }
    },
    [applyOverview, push],
  );

  const activeNotification = useMemo(
    () => notifications.find((item) => item.id === activeNotificationId) ?? null,
    [activeNotificationId, notifications],
  );

  useEffect(() => {
    if (!activeNotificationId) {
      return;
    }

    const exists = notifications.some((notification) => notification.id === activeNotificationId);
    if (!exists) {
      setActiveNotificationId(null);
    }
  }, [activeNotificationId, notifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    fetchOverview({ showErrorToast: true });
  }, [open, fetchOverview]);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveNotificationId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setActiveNotificationId(null);
      }
    };

    if (open) {
      document.addEventListener("mousedown", listener);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      fetchOverview();
    }, POLLING_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchOverview]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchOverview({ showErrorToast: true });
  }, [fetchOverview]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadCount === 0) {
      return;
    }

    setIsMarkingAll(true);
    try {
      const result = await markAllNotificationsAsReadAction();
      applyOverview(result);
    } catch (error) {
      console.error("[notifications] Falha ao marcar notificações", error);
      push({ type: "error", title: "Não foi possível marcar as notificações como lidas." });
    } finally {
      setIsMarkingAll(false);
    }
  }, [applyOverview, push, unreadCount]);

  const handleMarkNotificationAsRead = useCallback(
    async (notification: NotificationItem) => {
      if (notification.readAt) {
        return;
      }

      setPendingNotification({ id: notification.id, type: "mark" });
      try {
        const result = await markNotificationAsReadAction(notification.id);
        applyOverview(result);
      } catch (error) {
        console.error("[notifications] Falha ao marcar notificação", error);
        push({ type: "error", title: "Não foi possível marcar a notificação como lida." });
      } finally {
        setPendingNotification(null);
      }
    },
    [applyOverview, push],
  );

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      setPendingNotification({ id, type: "delete" });
      try {
        const result = await deleteNotificationAction(id);
        applyOverview(result);
        if (activeNotificationId === id) {
          setActiveNotificationId(null);
        }
        push({ type: "success", title: "Notificação removida." });
      } catch (error) {
        console.error("[notifications] Falha ao excluir notificação", error);
        push({ type: "error", title: "Não foi possível excluir a notificação." });
      } finally {
        setPendingNotification(null);
      }
    },
    [activeNotificationId, applyOverview, push],
  );

  const handleClearNotifications = useCallback(async () => {
    if (notifications.length === 0) {
      return;
    }

    setIsClearing(true);
    try {
      const result = await clearNotificationsAction();
      applyOverview(result);
      setActiveNotificationId(null);
      push({ type: "success", title: "Notificações limpas." });
    } catch (error) {
      console.error("[notifications] Falha ao limpar notificações", error);
      push({ type: "error", title: "Não foi possível limpar as notificações." });
    } finally {
      setIsClearing(false);
    }
  }, [applyOverview, notifications.length, push]);

  const toggleOpen = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (!next) {
        setActiveNotificationId(null);
      }
      return next;
    });
  }, []);

  const view = activeNotification ? "detail" : "list";
  const hasNotifications = notifications.length > 0;
  const pendingType = pendingNotification?.type ?? null;
  const pendingId = pendingNotification?.id ?? null;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggleOpen}
        className="relative rounded-full border border-border/60 bg-background/70 hover:bg-accent"
      >
        <Bell className="h-5 w-5" aria-hidden />
        <span className="sr-only">Abrir notificações</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[0.7rem] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-80 overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={isRefreshing || fetchInFlightRef.current}
              >
                {isRefreshing || fetchInFlightRef.current ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                <span className="sr-only">Atualizar notificações</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAll || unreadCount === 0}
              >
                {isMarkingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCheck className="h-4 w-4" aria-hidden />
                )}
                <span className="sr-only">Marcar todas como lidas</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClearNotifications}
                disabled={isClearing || notifications.length === 0}
              >
                {isClearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                <span className="sr-only">Limpar notificações</span>
              </Button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {view === "list" ? (
              <div className="p-2">
                {!hasNotifications ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                    <Bell className="h-5 w-5" aria-hidden />
                    <p>Nenhuma notificação por enquanto.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {notifications.map((notification) => (
                      <NotificationListItem
                        key={notification.id}
                        notification={notification}
                        onShowDetails={setActiveNotificationId}
                        onMarkAsRead={handleMarkNotificationAsRead}
                        onDelete={handleDeleteNotification}
                        pendingActionType={pendingType}
                        pendingActionId={pendingId}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : activeNotification ? (
              <NotificationDetailView
                notification={activeNotification}
                onBack={() => setActiveNotificationId(null)}
                onMarkAsRead={handleMarkNotificationAsRead}
                onDelete={handleDeleteNotification}
                pendingActionType={pendingType}
                pendingActionId={pendingId}
                onNavigate={() => {
                  setOpen(false);
                  setActiveNotificationId(null);
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface NotificationListItemProps {
  notification: NotificationItem;
  onShowDetails: (id: string) => void;
  onMarkAsRead: (notification: NotificationItem) => void;
  onDelete: (id: string) => void;
  pendingActionType: PendingNotificationAction["type"] | null;
  pendingActionId: string | null;
}

function NotificationListItem({
  notification,
  onShowDetails,
  onMarkAsRead,
  onDelete,
  pendingActionType,
  pendingActionId,
}: NotificationListItemProps) {
  const isUnread = !notification.readAt;
  const relativeTime = useMemo(() => formatRelativeTime(notification.createdAt), [notification.createdAt]);
  const isPending = pendingActionId === notification.id;
  const isMarking = isPending && pendingActionType === "mark";
  const isDeleting = isPending && pendingActionType === "delete";

  return (
    <li
      className={cn(
        "group rounded-md border border-border/50 bg-muted/40 p-3 text-sm text-muted-foreground transition hover:bg-muted/60",
        isUnread ? "border-primary/40" : undefined,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{notification.title}</p>
          {notification.body ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notification.body}</p>
          ) : null}
        </div>
        <span className="text-[0.7rem] text-muted-foreground/70">{relativeTime}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 px-2"
          onClick={() => onShowDetails(notification.id)}
        >
          Ver detalhes
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 gap-1 px-2"
          onClick={() => onMarkAsRead(notification)}
          disabled={!isUnread || isMarking || isDeleting}
        >
          {isMarking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CircleCheck className="h-3.5 w-3.5" aria-hidden />}
          Marcar como lida
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 gap-1 px-2 text-destructive hover:text-destructive"
          onClick={() => onDelete(notification.id)}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
          Excluir
        </Button>
      </div>
      {isUnread ? <span className="mt-2 block h-1 w-12 rounded-full bg-primary/80" /> : null}
    </li>
  );
}

interface NotificationDetailViewProps {
  notification: NotificationItem;
  onBack: () => void;
  onMarkAsRead: (notification: NotificationItem) => void;
  onDelete: (id: string) => void;
  pendingActionType: PendingNotificationAction["type"] | null;
  pendingActionId: string | null;
  onNavigate: () => void;
}

function NotificationDetailView({
  notification,
  onBack,
  onMarkAsRead,
  onDelete,
  pendingActionType,
  pendingActionId,
  onNavigate,
}: NotificationDetailViewProps) {
  const isUnread = !notification.readAt;
  const relativeTime = useMemo(() => formatRelativeTime(notification.createdAt), [notification.createdAt]);
  const isPending = pendingActionId === notification.id;
  const isMarking = isPending && pendingActionType === "mark";
  const isDeleting = isPending && pendingActionType === "delete";
  const isExternalLink = Boolean(notification.href && notification.href.startsWith("http"));

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Button>
        <span className="text-xs text-muted-foreground">{relativeTime}</span>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{notification.title}</p>
        {notification.body ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{notification.body}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem detalhes adicionais.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => onMarkAsRead(notification)}
          disabled={!isUnread || isMarking || isDeleting}
        >
          {isMarking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CircleCheck className="h-4 w-4" aria-hidden />}
          Marcar como lida
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="gap-1"
          onClick={() => onDelete(notification.id)}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          Excluir
        </Button>
        {notification.href ? (
          <Link
            href={notification.href}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-border/70 bg-muted px-3 text-xs font-medium text-foreground transition hover:bg-muted/80"
            target={isExternalLink ? "_blank" : undefined}
            rel={isExternalLink ? "noreferrer" : undefined}
            onClick={onNavigate}
            prefetch={false}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Abrir página
          </Link>
        ) : null}
      </div>

      {isUnread ? <span className="block h-1 w-16 rounded-full bg-primary/80" /> : null}
    </div>
  );
}
