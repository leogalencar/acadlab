"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/features/notifications/types";
import { formatRelativeTime } from "@/features/notifications/utils";
import {
  loadNotificationsAction,
  markAllNotificationsAsReadAction,
} from "@/features/notifications/server/actions";
import { useToast } from "@/features/notifications/components/toast-provider";

interface NotificationsMenuProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}

export function NotificationsMenu({ initialNotifications, initialUnreadCount }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isMarking, startMarkTransition] = useTransition();
  const { push } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshNotifications = useCallback(() => {
    startRefreshTransition(async () => {
      try {
        const result = await loadNotificationsAction();
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      } catch (error) {
        console.error("[notifications] Falha ao carregar notificações", error);
        push({
          type: "error",
          title: "Não foi possível carregar as notificações.",
        });
      }
    });
  }, [push, startRefreshTransition]);

  const markAllAsRead = useCallback(() => {
    startMarkTransition(async () => {
      try {
        const result = await markAllNotificationsAsReadAction();
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      } catch (error) {
        console.error("[notifications] Falha ao marcar notificações", error);
        push({
          type: "error",
          title: "Não foi possível marcar as notificações como lidas.",
        });
      }
    });
  }, [push, startMarkTransition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    refreshNotifications();
  }, [open, refreshNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const hasNotifications = notifications.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
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
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={refreshNotifications}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                <span className="sr-only">Atualizar notificações</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={markAllAsRead}
                disabled={isMarking || unreadCount === 0}
              >
                {isMarking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCheck className="h-4 w-4" aria-hidden />}
                <span className="sr-only">Marcar todas como lidas</span>
              </Button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {isRefreshing && !hasNotifications ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Carregando notificações...
              </div>
            ) : null}

            {!isRefreshing && !hasNotifications ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <Bell className="h-5 w-5" aria-hidden />
                <p>Nenhuma notificação por enquanto.</p>
              </div>
            ) : null}

            {hasNotifications ? (
              <ul className="space-y-2">
                {notifications.map((notification) => (
                  <NotificationListItem key={notification.id} notification={notification} />
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationListItem({ notification }: { notification: NotificationItem }) {
  const isUnread = !notification.readAt;
  const relativeTime = useMemo(() => formatRelativeTime(notification.createdAt), [notification.createdAt]);

  return (
    <li
      className="group rounded-md border border-border/50 bg-muted/40 p-3 text-sm text-muted-foreground transition hover:bg-muted/60"
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
      {notification.href ? (
        <Link
          href={notification.href}
          className="mt-2 inline-flex items-center text-xs font-medium text-primary transition hover:underline"
        >
          Ver detalhes
        </Link>
      ) : null}
      {isUnread ? <span className="mt-2 block h-1 w-12 rounded-full bg-primary/80" /> : null}
    </li>
  );
}
