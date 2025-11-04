"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { NotificationsOverview } from "@/features/notifications/types";
import { getNotificationsOverview } from "@/features/notifications/server/queries";

const notificationIdSchema = z.string().min(1, "Notificação inválida.");

async function ensureAuthenticatedUser() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Usuário não autenticado.");
  }

  return session.user;
}

export async function loadNotificationsAction(): Promise<NotificationsOverview> {
  const user = await ensureAuthenticatedUser();

  return getNotificationsOverview({ userId: user.id });
}

export async function markNotificationAsReadAction(
  notificationId: string,
): Promise<NotificationsOverview> {
  const user = await ensureAuthenticatedUser();
  const parsed = notificationIdSchema.safeParse(notificationId);

  if (!parsed.success) {
    throw new Error("Identificador de notificação inválido.");
  }

  await prisma.notification.updateMany({
    where: { id: parsed.data, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return getNotificationsOverview({ userId: user.id });
}

export async function markAllNotificationsAsReadAction(): Promise<NotificationsOverview> {
  const user = await ensureAuthenticatedUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return getNotificationsOverview({ userId: user.id });
}
