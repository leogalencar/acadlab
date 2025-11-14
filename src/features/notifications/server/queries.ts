import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";
import { mapNotificationToItem } from "@/features/notifications/utils";
import type {
  NotificationItem,
  NotificationsOverview,
} from "@/features/notifications/types";

const DEFAULT_NOTIFICATIONS_LIMIT = 15;

async function fetchNotificationsForUser({
  userId,
  limit = DEFAULT_NOTIFICATIONS_LIMIT,
  correlationId,
}: {
  userId: string;
  limit?: number;
  correlationId?: string;
}): Promise<NotificationItem[]> {
  const audit = createAuditSpan(
    {
      module: "notifications",
      action: "fetchNotificationsForUser",
      correlationId,
    },
    { userId, limit },
    "Loading notifications",
    { importance: "low", logStart: false, logSuccess: false },
  );

  try {
    const notifications = await audit.trackPrisma(
      { model: "notification", action: "findMany", targetIds: userId, meta: { limit } },
      () =>
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    );

    const items = notifications.map(mapNotificationToItem);
    audit.success({ returned: items.length });
    return items;
  } catch (error) {
    audit.failure(error, { stage: "fetchNotificationsForUser" });
    throw error;
  }
}

async function fetchNotificationsOverview({
  userId,
  limit = DEFAULT_NOTIFICATIONS_LIMIT,
  correlationId,
}: {
  userId: string;
  limit?: number;
  correlationId?: string;
}): Promise<NotificationsOverview> {
  const audit = createAuditSpan(
    {
      module: "notifications",
      action: "fetchNotificationsOverview",
      correlationId,
    },
    { userId, limit },
    "Loading notifications overview",
    { importance: "low", logStart: false, logSuccess: false },
  );

  try {
    const [notifications, unreadCount] = await Promise.all([
      fetchNotificationsForUser({ userId, limit, correlationId: audit.correlationId }),
      audit.trackPrisma(
        { model: "notification", action: "count", targetIds: userId },
        () =>
          prisma.notification.count({
            where: { userId, readAt: null },
          }),
      ),
    ]);

    const overview = { notifications, unreadCount };
    audit.success({ returned: notifications.length, unreadCount });
    return overview;
  } catch (error) {
    audit.failure(error, { stage: "fetchNotificationsOverview" });
    throw error;
  }
}

export async function getNotificationsForUser(args: {
  userId: string;
  limit?: number;
  correlationId?: string;
}): Promise<NotificationItem[]> {
  return fetchNotificationsForUser(args);
}

export async function getNotificationsOverview(args: {
  userId: string;
  limit?: number;
  correlationId?: string;
}): Promise<NotificationsOverview> {
  return fetchNotificationsOverview(args);
}

export async function getLiveNotificationsOverview(args: {
  userId: string;
  limit?: number;
  correlationId?: string;
}): Promise<NotificationsOverview> {
  // Alias used by server actions to guarantee the latest state
  return fetchNotificationsOverview(args);
}
