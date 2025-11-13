"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SoftwareRequestStatus, UserStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageSoftwareRequests } from "@/features/software-requests/types";
import { MANAGER_ROLES } from "@/features/shared/roles";
import type { ActionState } from "@/features/shared/types";
import {
  notifyEntityAction,
  notifySoftwareRequestStatusChange,
  notifySoftwareRequestCreatedForManagers,
  notifySoftwareRequestCancelledForManagers,
} from "@/features/notifications/server/triggers";

const notAuthenticated: ActionState = {
  status: "error",
  message: "Você precisa estar autenticado.",
};

const notAuthorized: ActionState = {
  status: "error",
  message: "Você não possui permissão para executar esta ação.",
};

const createRequestSchema = z.object({
  laboratoryId: z.string().min(1, "Laboratório inválido."),
  softwareName: z
    .string()
    .trim()
    .min(2, "Informe o nome do software.")
    .max(120, "O nome do software deve ter no máximo 120 caracteres."),
  softwareVersion: z
    .string()
    .trim()
    .min(1, "Informe a versão do software.")
    .max(60, "A versão do software deve ter no máximo 60 caracteres."),
  justification: z
    .string()
    .trim()
    .min(10, "Descreva o motivo da solicitação (mínimo de 10 caracteres).")
    .max(600, "A justificativa deve ter no máximo 600 caracteres."),
});

const updateStatusSchema = z.object({
  requestId: z.string().min(1, "Solicitação inválida."),
  status: z.nativeEnum(SoftwareRequestStatus),
  responseNotes: z
    .string()
    .trim()
    .max(600, "As observações devem ter no máximo 600 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

const cancelRequestSchema = z.object({
  requestId: z.string().min(1, "Solicitação inválida."),
  reason: z
    .string()
    .trim()
    .max(400, "O motivo deve ter no máximo 400 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export async function createSoftwareRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return notAuthenticated;
  }

  const parsed = createRequestSchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
    softwareName: formData.get("softwareName"),
    softwareVersion: formData.get("softwareVersion"),
    justification: formData.get("justification"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados informados.";
    return { status: "error", message };
  }

  const laboratory = await prisma.laboratory.findUnique({
    where: { id: parsed.data.laboratoryId },
    select: { id: true, name: true },
  });

  if (!laboratory) {
    return { status: "error", message: "Laboratório não encontrado." };
  }

  const softwareLabel = parsed.data.softwareVersion
    ? `${parsed.data.softwareName} • ${parsed.data.softwareVersion}`
    : parsed.data.softwareName;

  await prisma.softwareRequest.create({
    data: {
      laboratoryId: parsed.data.laboratoryId,
      softwareName: parsed.data.softwareName,
      softwareVersion: parsed.data.softwareVersion,
      justification: parsed.data.justification,
      requesterId: session.user.id,
    },
  });

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Solicitação de software",
    entityName: softwareLabel,
    href: "/software-requests",
    type: "create",
  });

  const recipientIds = await resolveManagerRecipientIds(session.user.id);

  if (recipientIds.length > 0) {
    await notifySoftwareRequestCreatedForManagers({
      recipientIds,
      softwareName: parsed.data.softwareName,
      softwareVersion: parsed.data.softwareVersion,
      laboratoryName: laboratory.name,
      requesterName: session.user.name ?? null,
    });
  }

  await revalidateSoftwareRequestRoutes();

  return { status: "success", message: "Solicitação registrada com sucesso." };
}

export async function updateSoftwareRequestStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return notAuthenticated;
  }

  if (!canManageSoftwareRequests(session.user.role)) {
    return notAuthorized;
  }

  const parsed = updateStatusSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    responseNotes: formData.get("responseNotes"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados informados.";
    return { status: "error", message };
  }

  if (parsed.data.status === SoftwareRequestStatus.CANCELLED) {
    return {
      status: "error",
      message: "Use o cancelamento disponível para o solicitante.",
    };
  }

  const existing = await prisma.softwareRequest.findUnique({
    where: { id: parsed.data.requestId },
    select: {
      id: true,
      requesterId: true,
      softwareName: true,
      softwareVersion: true,
      laboratory: { select: { name: true } },
    },
  });

  if (!existing) {
    return { status: "error", message: "Solicitação não encontrada." };
  }

  const { status, responseNotes } = parsed.data;
  const isPending = status === SoftwareRequestStatus.PENDING;

  await prisma.softwareRequest.update({
    where: { id: parsed.data.requestId },
    data: {
      status,
      responseNotes: responseNotes ?? null,
      reviewerId: isPending ? null : session.user.id,
      reviewedAt: isPending ? null : new Date(),
    },
  });

  const softwareLabel = existing.softwareVersion
    ? `${existing.softwareName} • ${existing.softwareVersion}`
    : existing.softwareName;

  if (!isPending) {
    await notifySoftwareRequestStatusChange({
      userId: existing.requesterId,
      softwareName: existing.softwareName,
      status,
      laboratoryName: existing.laboratory.name,
      reviewerName: session.user.name ?? null,
      notes: responseNotes ?? null,
    });
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Solicitações de software",
    entityName: softwareLabel,
    href: "/software-requests",
    type: "update",
  });

  await revalidateSoftwareRequestRoutes();

  return { status: "success", message: "Status da solicitação atualizado." };
}

export async function cancelSoftwareRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return notAuthenticated;
  }

  const parsed = cancelRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar a solicitação.";
    return { status: "error", message };
  }

  const existing = await prisma.softwareRequest.findUnique({
    where: { id: parsed.data.requestId },
    select: {
      id: true,
      requesterId: true,
      status: true,
      softwareName: true,
      softwareVersion: true,
      laboratory: { select: { name: true } },
    },
  });

  if (!existing) {
    return { status: "error", message: "Solicitação não encontrada." };
  }

  if (existing.requesterId !== session.user.id) {
    return {
      status: "error",
      message: "Você só pode cancelar solicitações registradas por você.",
    };
  }

  if (existing.status !== SoftwareRequestStatus.PENDING) {
    return {
      status: "error",
      message: "Somente solicitações pendentes podem ser canceladas.",
    };
  }

  await prisma.softwareRequest.update({
    where: { id: existing.id },
    data: {
      status: SoftwareRequestStatus.CANCELLED,
      responseNotes: parsed.data.reason ?? null,
      reviewerId: null,
      reviewedAt: new Date(),
    },
  });

  const softwareLabel = existing.softwareVersion
    ? `${existing.softwareName} • ${existing.softwareVersion}`
    : existing.softwareName;

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Solicitações de software",
    entityName: softwareLabel,
    href: "/software-requests",
    type: "delete",
  });

  const recipientIds = await resolveManagerRecipientIds(session.user.id);

  if (recipientIds.length > 0) {
    await notifySoftwareRequestCancelledForManagers({
      recipientIds,
      softwareName: existing.softwareName,
      softwareVersion: existing.softwareVersion,
      laboratoryName: existing.laboratory.name,
      requesterName: session.user.name ?? null,
    });
  }

  await revalidateSoftwareRequestRoutes();

  return { status: "success", message: "Solicitação cancelada com sucesso." };
}

async function revalidateSoftwareRequestRoutes() {
  revalidatePath("/software-requests");
  revalidatePath("/dashboard");
}

async function resolveManagerRecipientIds(excludeUserId?: string): Promise<string[]> {
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: MANAGER_ROLES },
      status: UserStatus.ACTIVE,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return Array.from(new Set(recipients.map((entry) => entry.id)));
}
