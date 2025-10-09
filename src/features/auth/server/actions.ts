"use server";

import { randomBytes, createHash } from "crypto";

import { Prisma } from "@prisma/client";
import { hash, compare } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuthActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const emailSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const loginSchema = emailSchema.extend({
  password: z.string().min(1, "A senha é obrigatória."),
  callbackUrl: z.string().url().optional(),
});

const updateProfileSchema = z
  .object({
    name: z.string().min(1, "O nome é obrigatório."),
    email: z.string().email("Informe um e-mail válido."),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const wantsPasswordChange = Boolean(data.newPassword || data.confirmPassword);

    if (!wantsPasswordChange) {
      return;
    }

    if (!data.currentPassword) {
      ctx.addIssue({
        path: ["currentPassword"],
        code: z.ZodIssueCode.custom,
        message: "Informe a senha atual para alterar a senha.",
      });
    }

    if (!data.newPassword || !data.confirmPassword) {
      ctx.addIssue({
        path: ["newPassword"],
        code: z.ZodIssueCode.custom,
        message: "Informe e confirme a nova senha.",
      });
      return;
    }

    if (data.newPassword.length < 8) {
      ctx.addIssue({
        path: ["newPassword"],
        code: z.ZodIssueCode.custom,
        message: "A nova senha deve ter pelo menos 8 caracteres.",
      });
    }

    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        code: z.ZodIssueCode.custom,
        message: "As senhas não conferem.",
      });
    }
  });

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token inválido."),
    password: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a nova senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: parsed.data.callbackUrl ?? "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { status: "error", message: "E-mail ou senha inválidos." };
      }

      return {
        status: "error",
        message: "Não foi possível iniciar a sessão. Tente novamente.",
      };
    }

    throw error;
  }

  return { status: "success" };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Informe um e-mail válido.";
    return { status: "error", message };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (!user) {
    return {
      status: "success",
      message: "Se o e-mail estiver cadastrado, enviaremos as instruções em instantes.",
    };
  }

  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  await prisma.passwordResetToken.create({
    data: {
      token: hashedToken,
      userId: user.id,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password/${rawToken}`;

  // TODO: send email with reset link instead of logging it on console
  console.info("[auth] password reset link", resetLink);

  return {
    status: "success",
    message: "Se o e-mail estiver cadastrado, enviaremos as instruções em instantes.",
  };
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  const hashedToken = createHash("sha256").update(parsed.data.token).digest("hex");

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token: hashedToken },
  });

  if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
    return {
      status: "error",
      message: "O link de recuperação é inválido ou expirou.",
    };
  }

  const newPasswordHash = await hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: tokenRecord.userId } }),
  ]);

  redirect("/login?reset=success");
}

export async function updateProfileAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const session = await auth();

  if (!session?.user) {
    return { status: "error", message: "Você precisa estar autenticado." };
  }

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword") || undefined,
    newPassword: formData.get("newPassword") || undefined,
    confirmPassword: formData.get("confirmPassword") || undefined,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    return { status: "error", message };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (!user) {
    return { status: "error", message: "Usuário não encontrado." };
  }

  if (parsed.data.newPassword) {
    const isValid = await compare(parsed.data.currentPassword ?? "", user.passwordHash);

    if (!isValid) {
      return { status: "error", message: "A senha atual informada é inválida." };
    }
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        ...(parsed.data.newPassword && {
          passwordHash: await hash(parsed.data.newPassword, 12),
        }),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: "Já existe um usuário com este e-mail.",
      };
    }

    throw error;
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return { status: "success", message: "Perfil atualizado com sucesso." };
}
