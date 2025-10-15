"use server";

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
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a senha com pelo menos 8 caracteres."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
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
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const wantsPasswordChange = Boolean(data.password && data.password.length > 0);
    const providedConfirmPassword = Boolean(data.confirmPassword && data.confirmPassword.length > 0);

    if (!wantsPasswordChange && !providedConfirmPassword) {
      return;
    }

    if (!data.password || data.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "A nova senha deve ter pelo menos 8 caracteres.",
      });
    }

    if (!data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Confirme a nova senha.",
      });
      return;
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "As senhas não conferem.",
      });
    }
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
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
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

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        status: UserStatus.ACTIVE,
        passwordHash: await hash(parsed.data.password, 12),
      },
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

  revalidatePath("/users");
  revalidatePath("/dashboard");

  return { status: "success", message: "Usuário cadastrado com sucesso." };
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
    password: (formData.get("password") ?? undefined) as string | undefined,
    confirmPassword: (formData.get("confirmPassword") ?? undefined) as string | undefined,
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

  if (targetUser.id === session.user.id && parsed.data.role !== targetUser.role) {
    return {
      status: "error",
      message: "Não é possível alterar o seu próprio perfil de acesso por este módulo.",
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

  const updateData: Prisma.UserUpdateInput = {
    name: parsed.data.name.trim(),
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    status: parsed.data.status,
  };

  if (parsed.data.password && parsed.data.password.length > 0) {
    updateData.passwordHash = await hash(parsed.data.password, 12);
  }

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
    select: { role: true },
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

  revalidatePath("/users");
  revalidatePath("/dashboard");

  return { status: "success", message: "Usuário removido com sucesso." };
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
