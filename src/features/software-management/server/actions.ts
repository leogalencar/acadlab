"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES } from "@/features/shared/roles";
import type { ActionState } from "@/features/shared/types";
import { notifyEntityAction } from "@/features/notifications/server/triggers";

function canManageSoftware(role: Role): boolean {
  return MANAGER_ROLES.includes(role);
}

const notAuthenticated: ActionState = {
  status: "error",
  message: "Você precisa estar autenticado.",
};

const notAuthorized: ActionState = {
  status: "error",
  message: "Você não possui permissão para realizar esta ação.",
};

const createSoftwareSchema = z.object({
  name: z.string().min(1, "Informe o nome do software."),
  version: z.string().min(1, "Informe a versão do software."),
  supplier: z
    .string()
    .trim()
    .max(120, "O fornecedor deve ter no máximo 120 caracteres.")
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
});

const updateSoftwareSchema = createSoftwareSchema.extend({
  softwareId: z.string().min(1, "Software inválido."),
});

const deleteSoftwareSchema = z.object({
  softwareId: z.string().min(1, "Software inválido."),
});

export async function createSoftwareAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return notAuthenticated;
  }

  if (!canManageSoftware(session.user.role)) {
    return notAuthorized;
  }

  const parsed = createSoftwareSchema.safeParse({
    name: formData.get("name"),
    version: formData.get("version"),
    supplier: formData.get("supplier"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  try {
    await prisma.software.create({
      data: {
        name: parsed.data.name.trim(),
        version: parsed.data.version.trim(),
        supplier: parsed.data.supplier,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: "Já existe um software cadastrado com este nome e versão.",
      };
    }

    throw error;
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Software",
    entityName: `${parsed.data.name.trim()} • ${parsed.data.version.trim()}`,
    href: "/software",
    type: "create",
  });

  await revalidateSoftwareRelatedRoutes();

  return { status: "success", message: "Software cadastrado com sucesso." };
}

export async function updateSoftwareAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return notAuthenticated;
  }

  if (!canManageSoftware(session.user.role)) {
    return notAuthorized;
  }

  const parsed = updateSoftwareSchema.safeParse({
    softwareId: formData.get("softwareId"),
    name: formData.get("name"),
    version: formData.get("version"),
    supplier: formData.get("supplier"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  try {
    await prisma.software.update({
      where: { id: parsed.data.softwareId },
      data: {
        name: parsed.data.name.trim(),
        version: parsed.data.version.trim(),
        supplier: parsed.data.supplier,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          status: "error",
          message: "Já existe um software cadastrado com este nome e versão.",
        };
      }
      if (error.code === "P2025") {
        return {
          status: "error",
          message: "Software não encontrado.",
        };
      }
    }

    throw error;
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Software",
    entityName: `${parsed.data.name.trim()} • ${parsed.data.version.trim()}`,
    href: "/software",
    type: "update",
  });

  await revalidateSoftwareRelatedRoutes();

  return { status: "success", message: "Software atualizado com sucesso." };
}

export async function deleteSoftwareAction(
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();

  if (!session?.user) {
    return notAuthenticated;
  }

  if (!canManageSoftware(session.user.role)) {
    return notAuthorized;
  }

  const parsed = deleteSoftwareSchema.safeParse({
    softwareId: formData.get("softwareId"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  const software = await prisma.software.findUnique({
    where: { id: parsed.data.softwareId },
    select: { name: true, version: true },
  });

  if (!software) {
    return { status: "error", message: "Software não encontrado." };
  }

  try {
    await prisma.software.delete({ where: { id: parsed.data.softwareId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return {
          status: "error",
          message: "Software não encontrado.",
        };
      }
    }

    throw error;
  }

  const softwareLabel = software.version
    ? `${software.name} • ${software.version}`
    : software.name;

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Software",
    entityName: softwareLabel,
    href: "/software",
    type: "delete",
  });

  await revalidateSoftwareRelatedRoutes();

  return { status: "success", message: "Software removido com sucesso." };
}

async function revalidateSoftwareRelatedRoutes() {
  revalidatePath("/software");
  revalidatePath("/laboratories");
  revalidatePath("/dashboard");
}
