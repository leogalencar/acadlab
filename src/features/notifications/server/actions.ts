"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";
import type { NotificationsOverview } from "@/features/notifications/types";
import {
  getLiveNotificationsOverview,
} from "@/features/notifications/server/queries";

const notificationIdSchema = z.string().min(1, "Notificação inválida.");

async function prepareNotificationsAudit(
  action: string,
  details?: Record<string, unknown>,
) {
  const session = await auth();
  const audit = createAuditSpan(
    {
      module: "notifications",
      action,
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    details,
    `Notifications action: ${action}`,
    { importance: "low", logStart: false, logSuccess: false },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    throw new Error("Usuário não autenticado.");
  }

  return { user: session.user, audit } as const;
}

async function getUpdatedOverview(
  userId: string,
  correlationId?: string,
): Promise<NotificationsOverview> {
  return getLiveNotificationsOverview({ userId, correlationId });
}

export async function loadNotificationsAction(): Promise<NotificationsOverview> {
  const { user, audit } = await prepareNotificationsAudit("loadNotificationsAction");

  try {
    const overview = await getUpdatedOverview(user.id, audit.correlationId);
    audit.success({ notificationCount: overview.notifications.length });
    return overview;
  } catch (error) {
    audit.failure(error, { stage: "loadNotificationsAction" });
    throw error;
  }
}

export async function markNotificationAsReadAction(
  notificationId: string,
): Promise<NotificationsOverview> {
  const { user, audit } = await prepareNotificationsAudit(
    "markNotificationAsReadAction",
    { notificationId },
  );
  const parsed = notificationIdSchema.safeParse(notificationId);

  if (!parsed.success) {
    audit.validationFailure({ reason: "invalid_notification_id" });
    throw new Error("Identificador de notificação inválido.");
  }

  try {
    const result = await audit.trackPrisma(
      { model: "notification", action: "updateMany", targetIds: parsed.data },
      () =>
        prisma.notification.updateMany({
          where: { id: parsed.data, userId: user.id, readAt: null },
          data: { readAt: new Date() },
        }),
    );

    const overview = await getUpdatedOverview(user.id, audit.correlationId);
    audit.success({ updated: result.count });
    return overview;
  } catch (error) {
    audit.failure(error, { stage: "markNotificationAsReadAction" });
    throw error;
  }
}

export async function markAllNotificationsAsReadAction(): Promise<NotificationsOverview> {
  const { user, audit } = await prepareNotificationsAudit(
    "markAllNotificationsAsReadAction",
  );

  try {
    const result = await audit.trackPrisma(
      { model: "notification", action: "updateMany", targetIds: user.id },
      () =>
        prisma.notification.updateMany({
          where: { userId: user.id, readAt: null },
          data: { readAt: new Date() },
        }),
    );

    const overview = await getUpdatedOverview(user.id, audit.correlationId);
    audit.success({ updated: result.count });
    return overview;
  } catch (error) {
    audit.failure(error, { stage: "markAllNotificationsAsReadAction" });
    throw error;
  }
}

export async function deleteNotificationAction(
  notificationId: string,
): Promise<NotificationsOverview> {
  const { user, audit } = await prepareNotificationsAudit(
    "deleteNotificationAction",
    { notificationId },
  );
  const parsed = notificationIdSchema.safeParse(notificationId);

  if (!parsed.success) {
    audit.validationFailure({ reason: "invalid_notification_id" });
    throw new Error("Identificador de notificação inválido.");
  }

  try {
    const result = await audit.trackPrisma(
      { model: "notification", action: "deleteMany", targetIds: parsed.data },
      () =>
        prisma.notification.deleteMany({
          where: { id: parsed.data, userId: user.id },
        }),
    );

    const overview = await getUpdatedOverview(user.id, audit.correlationId);
    audit.success({ deleted: result.count });
    return overview;
  } catch (error) {
    audit.failure(error, { stage: "deleteNotificationAction" });
    throw error;
  }
}

export async function clearNotificationsAction(): Promise<NotificationsOverview> {
  const { user, audit } = await prepareNotificationsAudit("clearNotificationsAction");

  try {
    const result = await audit.trackPrisma(
      { model: "notification", action: "deleteMany", targetIds: user.id },
      () => prisma.notification.deleteMany({ where: { userId: user.id } }),
    );

    const overview = await getUpdatedOverview(user.id, audit.correlationId);
    audit.success({ deleted: result.count });
    return overview;
  } catch (error) {
    audit.failure(error, { stage: "clearNotificationsAction" });
    throw error;
  }
}
