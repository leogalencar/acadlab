import type { NotificationType } from "@prisma/client";

export type NotificationPayload = {
  title?: string;
  body?: string;
  href?: string | null;
  meta?: Record<string, unknown> | null;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsOverview = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export type EntityActionType =
  | "create"
  | "update"
  | "delete";

export type EntityActionPayload = {
  userId: string;
  entity: string;
  entityName?: string;
  href?: string | null;
  type: EntityActionType;
};
