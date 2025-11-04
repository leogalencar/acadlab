import { prisma } from "@/lib/prisma";
import {
  mapNotificationToItem,
} from "@/features/notifications/utils";
import type {
  NotificationItem,
  NotificationsOverview,
} from "@/features/notifications/types";

const DEFAULT_NOTIFICATIONS_LIMIT = 15;

async function fetchNotificationsForUser({
  userId,
  limit = DEFAULT_NOTIFICATIONS_LIMIT,
}: {
  userId: string;
  limit?: number;
}): Promise<NotificationItem[]> {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications.map(mapNotificationToItem);
}

async function fetchNotificationsOverview({
  userId,
  limit = DEFAULT_NOTIFICATIONS_LIMIT,
}: {
  userId: string;
  limit?: number;
}): Promise<NotificationsOverview> {
  const [notifications, unreadCount] = await Promise.all([
    fetchNotificationsForUser({ userId, limit }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  return { notifications, unreadCount };
}

export async function getNotificationsForUser(args: {
  userId: string;
  limit?: number;
}): Promise<NotificationItem[]> {
  return fetchNotificationsForUser(args);
}

export async function getNotificationsOverview(args: {
  userId: string;
  limit?: number;
}): Promise<NotificationsOverview> {
  return fetchNotificationsOverview(args);
}

export async function getLiveNotificationsOverview(args: {
  userId: string;
  limit?: number;
}): Promise<NotificationsOverview> {
  // Alias used by server actions to guarantee the latest state
  return fetchNotificationsOverview(args);
}
