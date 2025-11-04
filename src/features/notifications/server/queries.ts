import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  mapNotificationToItem,
} from "@/features/notifications/utils";
import type {
  NotificationItem,
  NotificationsOverview,
} from "@/features/notifications/types";

const DEFAULT_NOTIFICATIONS_LIMIT = 15;

export const getNotificationsForUser = cache(
  async ({
    userId,
    limit = DEFAULT_NOTIFICATIONS_LIMIT,
  }: {
    userId: string;
    limit?: number;
  }): Promise<NotificationItem[]> => {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return notifications.map(mapNotificationToItem);
  },
);

export const getNotificationsOverview = cache(
  async ({
    userId,
    limit = DEFAULT_NOTIFICATIONS_LIMIT,
  }: {
    userId: string;
    limit?: number;
  }): Promise<NotificationsOverview> => {
    const [notifications, unreadCount] = await Promise.all([
      getNotificationsForUser({ userId, limit }),
      prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return { notifications, unreadCount };
  },
);
