import type { Notification } from "@prisma/client";

import type {
  NotificationItem,
  NotificationPayload,
} from "@/features/notifications/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseNotificationPayload(
  payload: Notification["payload"],
): NotificationPayload {
  if (!isRecord(payload)) {
    return {};
  }

  const { title, body, href, meta } = payload;

  return {
    title: typeof title === "string" && title.length > 0 ? title : undefined,
    body: typeof body === "string" && body.length > 0 ? body : undefined,
    href:
      typeof href === "string" && href.length > 0
        ? (href.startsWith("/") || href.startsWith("http") ? href : `/${href}`)
        : null,
    meta: isRecord(meta) ? meta : null,
  };
}

export function mapNotificationToItem(notification: Notification): NotificationItem {
  const payload = parseNotificationPayload(notification.payload);

  return {
    id: notification.id,
    type: notification.type,
    title: payload.title ?? resolveNotificationDefaultTitle(notification.type),
    body: payload.body,
    href: payload.href ?? null,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function resolveNotificationDefaultTitle(type: Notification["type"]): string {
  switch (type) {
    case "RESERVATION_CONFIRMED":
      return "Reserva confirmada";
    case "RESERVATION_CANCELLED":
      return "Reserva cancelada";
    case "SOFTWARE_REQUEST_UPDATED":
      return "Status do pedido atualizado";
    case "AUTH_LOGIN":
      return "Sessão iniciada";
    case "AUTH_LOGOUT":
      return "Sessão encerrada";
    case "ENTITY_CREATED":
      return "Cadastro realizado";
    case "ENTITY_UPDATED":
      return "Atualização registrada";
    case "ENTITY_DELETED":
      return "Registro removido";
    default:
      return "Notificação";
  }
}

export function formatRelativeTime(isoDate: string, locale = "pt-BR"): string {
  const target = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = target - now;

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
    ["second", 1000],
  ];

  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });

  for (const [unit, unitMs] of units) {
    if (Math.abs(diffMs) >= unitMs || unit === "second") {
      const value = Math.round(diffMs / unitMs);
      return formatter.format(value, unit);
    }
  }

  return formatter.format(0, "second");
}
