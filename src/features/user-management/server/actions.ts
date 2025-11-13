"use server";

import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role, UserStatus } from "@prisma/client";
import { getAllowedEmailDomains } from "@/features/system-rules/server/queries";
import { extractEmailDomain } from "@/features/system-rules/utils";
import { MANAGER_ROLES } from "@/features/shared/roles";
import { sendNewUserPasswordEmail } from "@/features/user-management/server/email";
import { notifyEntityAction } from "@/features/notifications/server/triggers";

export type UserManagementActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const createUserSchema = z
  .object({
    name: z.string().min(1, "Informe o nome completo."),
    email: z
      .string()
      .trim()
      .email("Informe um e-mail válido.")
      .transform((value) => value.toLowerCase()),
    role: z.nativeEnum(Role, {
      errorMap: () => ({ message: "Selecione um perfil de acesso válido." }),
    }),
  });

const updateUserSchema = z
  .object({
    userId: z.string().min(1, "Usuário inválido."),
    name: z.string().min(1, "Informe o nome completo."),
    email: z
      .string()
      .trim()
      .email("Informe um e-mail válido.")
      .transform((value) => value.toLowerCase()),
    role: z.nativeEnum(Role, {
      errorMap: () => ({ message: "Selecione um perfil de acesso válido." }),
    }),
    status: z.nativeEnum(UserStatus, {
      errorMap: () => ({ message: "Selecione um status válido." }),
    }),
  });

const deleteUserSchema = z.object({
  userId: z.string().min(1, "Usuário inválido."),
});

export async function createUserAction(
  _prevState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const session = await auth();

  if (!session?.user) {
    return { status: "error", message: "Você precisa estar autenticado." };
  }

  const actorRole = session.user.role;
  if (!canManageUsers(actorRole)) {
    return {
      status: "error",
      message: "Você não possui permissão para cadastrar usuários.",
    };
  }

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  if (!canManageRole(actorRole, parsed.data.role)) {
    return {
      status: "error",
      message: "Você não possui permissão para cadastrar usuários com este perfil de acesso.",
    };
  }

  const allowedDomains = await getAllowedEmailDomains();
  const emailDomain = extractEmailDomain(parsed.data.email);

  if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    return {
      status: "error",
      message: buildDisallowedDomainMessage(allowedDomains),
    };
  }

  const sanitizedName = parsed.data.name.trim();
  const sanitizedEmail = parsed.data.email.toLowerCase();
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hash(temporaryPassword, 12);

  let createdUserId: string | null = null;

  try {
    const createdUser = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail,
        role: parsed.data.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      select: { id: true },
    });

    createdUserId = createdUser.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: "Já existe um usuário cadastrado com este e-mail.",
      };
    }

    throw error;
  }

  try {
    await sendNewUserPasswordEmail({
      name: sanitizedName,
      email: sanitizedEmail,
      temporaryPassword,
    });
  } catch (error) {
    console.error("[user-management] Falha ao enviar senha provisória por e-mail.", error);

    if (createdUserId) {
      await prisma.user
        .delete({ where: { id: createdUserId } })
        .catch((deleteError) => {
          console.error(
            "[user-management] Falha ao remover usuário após erro no envio de e-mail.",
            deleteError,
          );
        });
    }

    return {
      status: "error",
      message:
        "Não foi possível enviar o e-mail com a senha provisória. Nenhuma conta foi criada. Tente novamente mais tarde.",
    };
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Usuários",
    entityName: sanitizedName,
    href: "/users",
    type: "create",
  });

  revalidatePath("/users");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: "Usuário cadastrado com sucesso. Enviamos a senha provisória por e-mail.",
  };
}

export async function updateUserAction(
  _prevState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const session = await auth();

  if (!session?.user) {
    return { status: "error", message: "Você precisa estar autenticado." };
  }

  const actorRole = session.user.role;
  if (!canManageUsers(actorRole)) {
    return {
      status: "error",
      message: "Você não possui permissão para editar usuários.",
    };
  }

  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return { status: "error", message: "Usuário não encontrado." };
  }

  if (targetUser.id === session.user.id) {
    return {
      status: "error",
      message: "Você não pode editar os seus próprios dados por este módulo.",
    };
  }

  if (!canManageRole(actorRole, targetUser.role)) {
    return {
      status: "error",
      message: "Você não possui permissão para editar este usuário.",
    };
  }

  if (!canManageRole(actorRole, parsed.data.role)) {
    return {
      status: "error",
      message: "Você não possui permissão para atribuir este perfil de acesso.",
    };
  }

  const allowedDomains = await getAllowedEmailDomains();
  const emailDomain = extractEmailDomain(parsed.data.email);

  if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    return {
      status: "error",
      message: buildDisallowedDomainMessage(allowedDomains),
    };
  }

  const sanitizedName = parsed.data.name.trim();
  const sanitizedEmail = parsed.data.email.toLowerCase();

  const updateData: Prisma.UserUpdateInput = {
    name: sanitizedName,
    email: sanitizedEmail,
    role: parsed.data.role,
    status: parsed.data.status,
  };

  try {
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: updateData,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: "Já existe um usuário cadastrado com este e-mail.",
      };
    }

    throw error;
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Usuários",
    entityName: sanitizedName,
    href: "/users",
    type: "update",
  });

  revalidatePath("/users");
  revalidatePath("/dashboard");

  return { status: "success", message: "Usuário atualizado com sucesso." };
}

export async function deleteUserAction(formData: FormData): Promise<UserManagementActionState> {
  const session = await auth();

  if (!session?.user) {
    return { status: "error", message: "Você precisa estar autenticado." };
  }

  const actorRole = session.user.role;
  if (!canManageUsers(actorRole)) {
    return {
      status: "error",
      message: "Você não possui permissão para remover usuários.",
    };
  }

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  if (parsed.data.userId === session.user.id) {
    return {
      status: "error",
      message: "Você não pode remover o seu próprio usuário.",
    };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { role: true, name: true },
  });

  if (!targetUser) {
    return { status: "error", message: "Usuário não encontrado." };
  }

  if (!canManageRole(actorRole, targetUser.role)) {
    return {
      status: "error",
      message: "Você não possui permissão para remover este usuário.",
    };
  }

  try {
    await prisma.user.delete({
      where: { id: parsed.data.userId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return {
        status: "error",
        message: "Usuário não encontrado.",
      };
    }

    throw error;
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Usuários",
    entityName: targetUser.name ?? "Usuário",
    href: "/users",
    type: "delete",
  });

  revalidatePath("/users");
  revalidatePath("/dashboard");

  return { status: "success", message: "Usuário removido com sucesso." };
}

// Omit characters like 0/O and 1/l to avoid visually ambiguous passwords in emails.
const TEMPORARY_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

function generateTemporaryPassword(length = 12): string {
  const randomBuffer = randomBytes(length);
  const alphabetLength = TEMPORARY_PASSWORD_ALPHABET.length;

  let password = "";
  for (let index = 0; index < length; index += 1) {
    const characterIndex = randomBuffer[index] % alphabetLength;
    password += TEMPORARY_PASSWORD_ALPHABET[characterIndex];
  }

  return password;
}

function buildDisallowedDomainMessage(allowedDomains: string[]): string {
  if (allowedDomains.length === 0) {
    return "Não há domínios de e-mail permitidos configurados. Entre em contato com um administrador.";
  }

  if (allowedDomains.length === 1) {
    return `Somente endereços @${allowedDomains[0]} podem ser cadastrados.`;
  }

  const formatted = allowedDomains.map((domain) => `@${domain}`).join(", ");
  return `Informe um e-mail institucional com os domínios permitidos: ${formatted}.`;
}

function canManageUsers(role: Role) {
  return MANAGER_ROLES.includes(role);
}

function canManageRole(actorRole: Role, targetRole: Role) {
  if (actorRole === Role.ADMIN) {
    return true;
  }

  if (actorRole === Role.TECHNICIAN) {
    return targetRole === Role.PROFESSOR;
  }

  return false;
}
