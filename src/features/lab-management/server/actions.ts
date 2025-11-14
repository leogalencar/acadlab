"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, LaboratoryStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";
import { canManageLaboratories } from "@/features/lab-management/types";
import type { ActionState } from "@/features/shared/types";
import { notifyEntityAction } from "@/features/notifications/server/triggers";

const initialError: ActionState = {
  status: "error",
  message: "Você não possui permissão para realizar esta ação.",
};

const notAuthenticated: ActionState = {
  status: "error",
  message: "Você precisa estar autenticado.",
};

const laboratoryDetailsSchema = z.object({
  name: z.string().min(1, "Informe o nome do laboratório."),
  capacity: z
    .coerce.number({ invalid_type_error: "Informe a capacidade do laboratório." })
    .int("A capacidade deve ser um número inteiro.")
    .min(1, "A capacidade deve ser de pelo menos 1 estação."),
  status: z.nativeEnum(LaboratoryStatus, {
    errorMap: () => ({ message: "Selecione um status válido." }),
  }),
  description: z
    .string()
    .trim()
    .max(500, "A descrição deve ter no máximo 500 caracteres.")
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
});

const createLaboratorySchema = laboratoryDetailsSchema.extend({
  softwareIds: z.array(z.string().min(1)).optional(),
});

const updateLaboratorySchema = laboratoryDetailsSchema.extend({
  laboratoryId: z.string().min(1, "Laboratório inválido."),
});

const deleteLaboratorySchema = z.object({
  laboratoryId: z.string().min(1, "Laboratório inválido."),
});

const assignSoftwareSchema = z.object({
  laboratoryId: z.string().min(1, "Laboratório inválido."),
  softwareId: z.string().min(1, "Software inválido."),
});

const removeSoftwareSchema = assignSoftwareSchema;

export async function createLaboratoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  const audit = createAuditSpan(
    {
      module: "lab-management",
      action: "createLaboratoryAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    {
      fieldCount: Array.from(formData.keys()).length,
    },
    "Received request to create laboratory",
    { importance: "high", persist: true },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    return notAuthenticated;
  }

  if (!canManageLaboratories(session.user.role)) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    return initialError;
  }

  const parsed = createLaboratorySchema.safeParse({
    name: formData.get("name"),
    capacity: formData.get("capacity"),
    status: formData.get("status"),
    description: formData.get("description"),
    softwareIds: formData
      .getAll("softwareIds")
      .filter((value): value is string => typeof value === "string"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    audit.validationFailure({ reason: "invalid_payload", issues: parsed.error.issues.length });
    return { status: "error", message };
  }

  const { softwareIds: submittedSoftwareIds, ...laboratoryData } = parsed.data;
  const softwareIds = Array.from(new Set(submittedSoftwareIds ?? []));
  const sessionUserId = session.user.id;

  audit.debug(
    {
      summary: {
        softwareCount: softwareIds.length,
        hasDescription: Boolean(laboratoryData.description),
      },
    },
    "Validated laboratory payload",
  );

  if (softwareIds.length > 0) {
    const existingSoftwareCount = await audit.trackPrisma(
      {
        model: "software",
        action: "count",
        meta: { requested: softwareIds.length },
      },
      () =>
        prisma.software.count({
          where: { id: { in: softwareIds } },
        }),
    );

    if (existingSoftwareCount !== softwareIds.length) {
      audit.validationFailure({
        reason: "software_mismatch",
        expected: softwareIds.length,
        found: existingSoftwareCount,
      });
      return {
        status: "error",
        message: "Alguns softwares selecionados não estão disponíveis. Atualize a página e tente novamente.",
      };
    }
  }

  let createdLaboratoryId: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const laboratory = await audit.trackPrisma(
        {
          model: "laboratory",
          action: "create",
          meta: { hasSoftware: softwareIds.length > 0 },
        },
        () =>
          tx.laboratory.create({
            data: {
              name: laboratoryData.name.trim(),
              capacity: laboratoryData.capacity,
              status: laboratoryData.status,
              description: laboratoryData.description,
            },
            select: { id: true, name: true },
          }),
      );

      createdLaboratoryId = laboratory.id;

      if (softwareIds.length > 0) {
        await audit.trackPrisma(
          {
            model: "laboratorySoftware",
            action: "createMany",
            targetIds: laboratory.id,
            meta: { count: softwareIds.length },
          },
          () =>
            tx.laboratorySoftware.createMany({
              data: softwareIds.map((softwareId) => ({
                laboratoryId: laboratory.id,
                softwareId,
                installedById: sessionUserId,
              })),
            }),
        );
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      audit.validationFailure({ reason: "duplicate_laboratory_name" });
      return {
        status: "error",
        message: "Já existe um laboratório cadastrado com este nome.",
      };
    }

    audit.failure(error, { stage: "createLaboratoryTransaction" });
    throw error;
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Laboratório",
    entityName: laboratoryData.name.trim(),
    href: "/dashboard/laboratories",
    type: "create",
  });

  await revalidateLaboratories();

  audit.success(
    {
      laboratoryId: createdLaboratoryId,
      softwareCount: softwareIds.length,
    },
    "Laboratório criado",
  );

  return { status: "success", message: "Laboratório cadastrado com sucesso." };
}

export async function updateLaboratoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  const audit = createAuditSpan(
    {
      module: "lab-management",
      action: "updateLaboratoryAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    { fieldCount: Array.from(formData.keys()).length },
    "Received request to update laboratory",
    { importance: "high", persist: true },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    return notAuthenticated;
  }

  if (!canManageLaboratories(session.user.role)) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    return initialError;
  }

  const parsed = updateLaboratorySchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
    name: formData.get("name"),
    capacity: formData.get("capacity"),
    status: formData.get("status"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    audit.validationFailure({ reason: "invalid_payload", issues: parsed.error.issues.length });
    return { status: "error", message };
  }

  try {
    await audit.trackPrisma(
      {
        model: "laboratory",
        action: "update",
        targetIds: parsed.data.laboratoryId,
      },
      () =>
        prisma.laboratory.update({
          where: { id: parsed.data.laboratoryId },
          data: {
            name: parsed.data.name.trim(),
            capacity: parsed.data.capacity,
            status: parsed.data.status,
            description: parsed.data.description,
          },
        }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        audit.validationFailure({ reason: "duplicate_laboratory_name" });
        return {
          status: "error",
          message: "Já existe um laboratório cadastrado com este nome.",
        };
      }
      if (error.code === "P2025") {
        audit.validationFailure({ reason: "laboratory_not_found", laboratoryId: parsed.data.laboratoryId });
        return {
          status: "error",
          message: "Laboratório não encontrado.",
        };
      }
    }

    audit.failure(error, { stage: "updateLaboratory" });
    throw error;
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Laboratório",
    entityName: parsed.data.name.trim(),
    href: "/dashboard/laboratories",
    type: "update",
  });

  await revalidateLaboratories();

  audit.success({ laboratoryId: parsed.data.laboratoryId }, "Laboratório atualizado");

  return { status: "success", message: "Laboratório atualizado com sucesso." };
}

export async function deleteLaboratoryAction(
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  const audit = createAuditSpan(
    {
      module: "lab-management",
      action: "deleteLaboratoryAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    { fieldCount: Array.from(formData.keys()).length },
    "Received request to delete laboratory",
    { importance: "high", persist: true },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    return notAuthenticated;
  }

  if (!canManageLaboratories(session.user.role)) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    return initialError;
  }

  const parsed = deleteLaboratorySchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    audit.validationFailure({ reason: "invalid_payload", issues: parsed.error.issues.length });
    return { status: "error", message };
  }

  const laboratory = await audit.trackPrisma(
    {
      model: "laboratory",
      action: "findUnique",
      targetIds: parsed.data.laboratoryId,
    },
    () =>
      prisma.laboratory.findUnique({
        where: { id: parsed.data.laboratoryId },
        select: { name: true },
      }),
  );

  if (!laboratory) {
    audit.validationFailure({ reason: "laboratory_not_found", laboratoryId: parsed.data.laboratoryId });
    return { status: "error", message: "Laboratório não encontrado." };
  }

  try {
    await audit.trackPrisma(
      {
        model: "laboratory",
        action: "delete",
        targetIds: parsed.data.laboratoryId,
      },
      () => prisma.laboratory.delete({ where: { id: parsed.data.laboratoryId } }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        audit.validationFailure({ reason: "laboratory_not_found", laboratoryId: parsed.data.laboratoryId });
        return {
          status: "error",
          message: "Laboratório não encontrado.",
        };
      }
    }

    audit.failure(error, { stage: "deleteLaboratory" });
    throw error;
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Laboratório",
    entityName: laboratory.name,
    href: "/dashboard/laboratories",
    type: "delete",
  });

  await revalidateLaboratories();

  audit.success({ laboratoryId: parsed.data.laboratoryId }, "Laboratório removido");

  return { status: "success", message: "Laboratório removido com sucesso." };
}

export async function assignSoftwareToLaboratoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  const audit = createAuditSpan(
    {
      module: "lab-management",
      action: "assignSoftwareToLaboratoryAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    { fieldCount: Array.from(formData.keys()).length },
    "Received request to attach software to laboratory",
    { importance: "high", persist: true },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    return notAuthenticated;
  }

  if (!canManageLaboratories(session.user.role)) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    return initialError;
  }

  const parsed = assignSoftwareSchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
    softwareId: formData.get("softwareId"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    audit.validationFailure({ reason: "invalid_payload", issues: parsed.error.issues.length });
    return { status: "error", message };
  }

  const laboratory = await audit.trackPrisma(
    {
      model: "laboratory",
      action: "findUnique",
      targetIds: parsed.data.laboratoryId,
    },
    () =>
      prisma.laboratory.findUnique({
        where: { id: parsed.data.laboratoryId },
        select: { id: true, name: true },
      }),
  );

  if (!laboratory) {
    audit.validationFailure({ reason: "laboratory_not_found", laboratoryId: parsed.data.laboratoryId });
    return { status: "error", message: "Laboratório não encontrado." };
  }

  const software = await audit.trackPrisma(
    {
      model: "software",
      action: "findUnique",
      targetIds: parsed.data.softwareId,
    },
    () =>
      prisma.software.findUnique({
        where: { id: parsed.data.softwareId },
        select: { id: true, name: true, version: true },
      }),
  );

  if (!software) {
    audit.validationFailure({ reason: "software_not_found", softwareId: parsed.data.softwareId });
    return { status: "error", message: "Software não encontrado." };
  }

  try {
    await audit.trackPrisma(
      {
        model: "laboratorySoftware",
        action: "create",
        targetIds: `${parsed.data.laboratoryId}:${parsed.data.softwareId}`,
      },
      () =>
        prisma.laboratorySoftware.create({
          data: {
            laboratoryId: parsed.data.laboratoryId,
            softwareId: parsed.data.softwareId,
            installedById: session.user.id,
          },
        }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      audit.validationFailure({ reason: "already_associated" });
      return {
        status: "error",
        message: "Este software já está associado ao laboratório.",
      };
    }

    audit.failure(error, { stage: "assignSoftware" });
    throw error;
  }

  const softwareLabel = software.version
    ? `${software.name} • ${software.version}`
    : software.name;

  await notifyEntityAction({
    userId: session.user.id,
    entity: `Softwares do laboratório ${laboratory.name}`,
    entityName: softwareLabel,
    href: "/dashboard/laboratories",
    type: "update",
  });

  await revalidateLaboratories();

  audit.success(
    {
      laboratoryId: parsed.data.laboratoryId,
      softwareId: parsed.data.softwareId,
    },
    "Software associado ao laboratório",
  );

  return { status: "success", message: "Software associado ao laboratório." };
}

export async function removeSoftwareFromLaboratoryAction(
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  const audit = createAuditSpan(
    {
      module: "lab-management",
      action: "removeSoftwareFromLaboratoryAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    { fieldCount: Array.from(formData.keys()).length },
    "Received request to remove software from laboratory",
    { importance: "high", persist: true },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    return notAuthenticated;
  }

  if (!canManageLaboratories(session.user.role)) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    return initialError;
  }

  const parsed = removeSoftwareSchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
    softwareId: formData.get("softwareId"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    audit.validationFailure({ reason: "invalid_payload", issues: parsed.error.issues.length });
    return { status: "error", message };
  }

  const association = await audit.trackPrisma(
    {
      model: "laboratorySoftware",
      action: "findUnique",
      targetIds: `${parsed.data.laboratoryId}:${parsed.data.softwareId}`,
    },
    () =>
      prisma.laboratorySoftware.findUnique({
        where: {
          laboratoryId_softwareId: {
            laboratoryId: parsed.data.laboratoryId,
            softwareId: parsed.data.softwareId,
          },
        },
        select: {
          laboratory: { select: { name: true } },
          software: { select: { name: true, version: true } },
        },
      }),
  );

  if (!association) {
    audit.validationFailure({ reason: "association_not_found" });
    return { status: "error", message: "Associação não encontrada." };
  }

  try {
    await audit.trackPrisma(
      {
        model: "laboratorySoftware",
        action: "delete",
        targetIds: `${parsed.data.laboratoryId}:${parsed.data.softwareId}`,
      },
      () =>
        prisma.laboratorySoftware.delete({
          where: {
            laboratoryId_softwareId: {
              laboratoryId: parsed.data.laboratoryId,
              softwareId: parsed.data.softwareId,
            },
          },
        }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        audit.validationFailure({ reason: "association_not_found" });
        return {
          status: "error",
          message: "Associação não encontrada.",
        };
      }
    }

    audit.failure(error, { stage: "removeSoftware" });
    throw error;
  }

  const softwareLabel = association.software.version
    ? `${association.software.name} • ${association.software.version}`
    : association.software.name;

  await notifyEntityAction({
    userId: session.user.id,
    entity: `Softwares do laboratório ${association.laboratory.name}`,
    entityName: softwareLabel,
    href: "/dashboard/laboratories",
    type: "update",
  });

  await revalidateLaboratories();

  audit.success(
    {
      laboratoryId: parsed.data.laboratoryId,
      softwareId: parsed.data.softwareId,
    },
    "Software removido do laboratório",
  );

  return { status: "success", message: "Software removido do laboratório." };
}

async function revalidateLaboratories() {
  revalidatePath("/laboratories");
  revalidatePath("/dashboard");
}
