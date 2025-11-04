import type { Prisma, PrismaClient } from "@prisma/client";
import { NotificationType, SoftwareRequestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { EntityActionType } from "@/features/notifications/types";

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

type BaseNotificationInput = {
  userId: string;
  title: string;
  body?: string;
  href?: string | null;
  meta?: Record<string, unknown> | null;
  client?: PrismaClientOrTransaction;
};

type ReservationNotificationPayload = {
  userId: string;
  laboratoryName: string;
  startTime: Date;
  endTime: Date;
  occurrences?: number;
  cancelledByName?: string | null;
  reason?: string | null;
  client?: PrismaClientOrTransaction;
};

type SoftwareRequestNotificationPayload = {
  userId: string;
  softwareName: string;
  status: SoftwareRequestStatus;
  laboratoryName: string;
  reviewerName?: string | null;
  notes?: string | null;
  client?: PrismaClientOrTransaction;
};

type AuthEventPayload = {
  userId: string;
  event: "login" | "logout";
  ipAddress?: string | null;
  client?: PrismaClientOrTransaction;
};

type EntityActionNotificationPayload = {
  userId: string;
  entity: string;
  entityName?: string;
  href?: string | null;
  type: EntityActionType;
  client?: PrismaClientOrTransaction;
};

function resolveClient(client?: PrismaClientOrTransaction): PrismaClientOrTransaction {
  return client ?? prisma;
}

function normalizeHref(href?: string | null): string | null {
  if (!href) {
    return null;
  }

  if (href.startsWith("/") || href.startsWith("http")) {
    return href;
  }

  return `/${href}`;
}

async function createNotification(
  type: NotificationType,
  { userId, title, body, href, meta, client }: BaseNotificationInput,
) {
  const payload: Record<string, unknown> = {
    title,
  };

  if (body) {
    payload.body = body;
  }

  if (href) {
    payload.href = normalizeHref(href);
  }

  if (meta) {
    payload.meta = meta;
  }

  try {
    await resolveClient(client).notification.create({
      data: {
        userId,
        type,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error(
      `[@acadlab/notifications] Não foi possível registrar a notificação (${type}).`,
      error,
    );
  }
}

export async function notifyReservationConfirmed({
  userId,
  laboratoryName,
  startTime,
  endTime,
  occurrences = 1,
  client,
}: ReservationNotificationPayload) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const formattedStart = formatter.format(startTime);

  const title = occurrences > 1 ? "Reservas confirmadas" : "Reserva confirmada";
  const body =
    occurrences > 1
      ? `Recorrência confirmada no laboratório ${laboratoryName} a partir de ${formattedStart}.`
      : `Reserva confirmada no laboratório ${laboratoryName} para ${formattedStart}.`;

  await createNotification(NotificationType.RESERVATION_CONFIRMED, {
    userId,
    title,
    body,
    href: "/dashboard/scheduling/agenda",
    meta: {
      laboratoryName,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      occurrences,
    },
    client,
  });
}

export async function notifyReservationCancelled({
  userId,
  laboratoryName,
  startTime,
  endTime,
  cancelledByName,
  reason,
  client,
}: ReservationNotificationPayload) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const formattedStart = formatter.format(startTime);

  const title = "Reserva cancelada";
  const reasonText = reason && reason.trim().length > 0 ? ` Motivo: ${reason.trim()}.` : "";
  const cancelledBy = cancelledByName ? ` por ${cancelledByName}` : "";
  const body = `Reserva no laboratório ${laboratoryName}${cancelledBy} cancelada em ${formattedStart}.${reasonText}`;

  await createNotification(NotificationType.RESERVATION_CANCELLED, {
    userId,
    title,
    body,
    href: "/dashboard/scheduling/history",
    meta: {
      laboratoryName,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      cancelledByName,
      reason: reason ?? null,
    },
    client,
  });
}

export async function notifySoftwareRequestStatusChange({
  userId,
  softwareName,
  status,
  laboratoryName,
  reviewerName,
  notes,
  client,
}: SoftwareRequestNotificationPayload) {
  const statusLabels: Record<SoftwareRequestStatus, string> = {
    PENDING: "pendente",
    APPROVED: "aprovado",
    REJECTED: "rejeitado",
  };

  const formattedStatus = statusLabels[status];
  const reviewerInfo = reviewerName ? ` por ${reviewerName}` : "";
  const notesInfo = notes && notes.trim().length > 0 ? ` Observações: ${notes.trim()}.` : "";

  await createNotification(NotificationType.SOFTWARE_REQUEST_UPDATED, {
    userId,
    title: `Pedido de software ${formattedStatus}`,
    body: `O pedido "${softwareName}" para o laboratório ${laboratoryName} foi ${formattedStatus}${reviewerInfo}.${notesInfo}`,
    href: "/software-requests",
    meta: {
      softwareName,
      status,
      laboratoryName,
      reviewerName: reviewerName ?? null,
    },
    client,
  });
}

export async function notifyAuthEvent({
  userId,
  event,
  ipAddress,
  client,
}: AuthEventPayload) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const now = new Date();
  const formatted = formatter.format(now);

  const isLogin = event === "login";
  const type = isLogin ? NotificationType.AUTH_LOGIN : NotificationType.AUTH_LOGOUT;
  const title = isLogin ? "Sessão iniciada" : "Sessão encerrada";
  const bodyBase = isLogin
    ? `Você acessou o sistema em ${formatted}.`
    : `Você encerrou a sessão em ${formatted}.`;
  const body = ipAddress
    ? `${bodyBase} Endereço IP: ${ipAddress}.`
    : bodyBase;

  await createNotification(type, {
    userId,
    title,
    body,
    client,
  });
}

function resolveEntityNotificationType(type: EntityActionType): NotificationType {
  switch (type) {
    case "create":
      return NotificationType.ENTITY_CREATED;
    case "update":
      return NotificationType.ENTITY_UPDATED;
    case "delete":
      return NotificationType.ENTITY_DELETED;
    default:
      return NotificationType.ENTITY_UPDATED;
  }
}

function resolveEntityActionTitle(entity: string, type: EntityActionType): string {
  switch (type) {
    case "create":
      return `${entity} cadastrado`;
    case "update":
      return `${entity} atualizado`;
    case "delete":
      return `${entity} removido`;
    default:
      return `${entity} atualizado`;
  }
}

function resolveEntityActionBody(
  entity: string,
  entityName: string | undefined,
  type: EntityActionType,
): string {
  const resolvedName = entityName ? ` "${entityName}"` : "";

  switch (type) {
    case "create":
      return `Você cadastrou o${resolvedName} em ${entity}.`;
    case "update":
      return `Você atualizou o${resolvedName} em ${entity}.`;
    case "delete":
      return `Você removeu o${resolvedName} de ${entity}.`;
    default:
      return `Uma ação foi registrada em ${entity}.`;
  }
}

export async function notifyEntityAction({
  userId,
  entity,
  entityName,
  href,
  type,
  client,
}: EntityActionNotificationPayload) {
  await createNotification(resolveEntityNotificationType(type), {
    userId,
    title: resolveEntityActionTitle(entity, type),
    body: resolveEntityActionBody(entity, entityName, type),
    href,
    meta: {
      entity,
      entityName: entityName ?? null,
      action: type,
    },
    client,
  });
}
