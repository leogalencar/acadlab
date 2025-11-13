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
import { createAuditSpan } from "@/lib/logging/audit";
import { notifyAuthEvent, notifyEntityAction } from "@/features/notifications/server/triggers";

export type AuthActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  statusCode?: number;
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
  const audit = createAuditSpan(
    {
      module: "auth",
      action: "loginAction",
    },
    {
      hasCallbackUrl: Boolean(formData.get("callbackUrl")),
      emailProvided: typeof formData.get("email") === "string",
    },
    "Processing credential login",
    { importance: "high", persist: true },
  );
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar os dados.";
    audit.validationFailure({ reason: "invalid_payload" });
    return { status: "error", message, statusCode: 400 };
  }

  const callbackUrl = parsed.data.callbackUrl ?? "/dashboard";
  const userRecord = await audit.trackPrisma(
    { model: "user", action: "findUnique", targetIds: parsed.data.email },
    () =>
      prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      }),
  );

  try {
    const redirectUrl = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
      redirect: false,
    });

    if (typeof redirectUrl === "string") {
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      const url = new URL(redirectUrl, baseUrl);

      if (url.searchParams.get("error") === "CredentialsSignin") {
        audit.validationFailure({ reason: "invalid_credentials" });
        return {
          status: "error",
          message: "E-mail ou senha inválidos.",
          statusCode: 401,
        };
      }

      if (userRecord) {
        await notifyAuthEvent({ userId: userRecord.id, event: "login" });
      }

      audit.success({ userId: userRecord?.id ?? null, redirectUrl });
      redirect(redirectUrl);
    }

    if (userRecord) {
      await notifyAuthEvent({ userId: userRecord.id, event: "login" });
    }

    audit.success({ userId: userRecord?.id ?? null });
    return { status: "success", statusCode: 200 };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        audit.validationFailure({ reason: "invalid_credentials" });
        return {
          status: "error",
          message: "E-mail ou senha inválidos.",
          statusCode: 401,
        };
      }

      audit.failure(error, { stage: "signIn" });
      return {
        status: "error",
        message: "Não foi possível iniciar a sessão. Tente novamente.",
        statusCode: 500,
      };
    }

    audit.failure(error, { stage: "loginAction" });
    throw error;
  }
}

export async function signOutAction() {
  const session = await auth();

  const audit = createAuditSpan(
    {
      module: "auth",
      action: "signOutAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    undefined,
    "Processing sign out",
    { importance: "normal", persist: true },
  );

  if (session?.user) {
    await notifyAuthEvent({ userId: session.user.id, event: "logout" });
  }

  await signOut({ redirectTo: "/login", redirect: false });
  audit.success({ userId: session?.user?.id ?? null });
  redirect("/login");
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

  const audit = createAuditSpan(
    {
      module: "auth",
      action: "requestPasswordResetAction",
    },
    { emailProvided: parsed.data.email },
    "Processing password reset request",
    { importance: "high", persist: true },
  );

  const user = await audit.trackPrisma(
    { model: "user", action: "findUnique", targetIds: parsed.data.email },
    () => prisma.user.findUnique({ where: { email: parsed.data.email } }),
  );

  if (!user) {
    audit.info({ userFound: false });
    return {
      status: "success",
      message: "Se o e-mail estiver cadastrado, enviaremos as instruções em instantes.",
    };
  }

  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

  await audit.trackPrisma(
    { model: "passwordResetToken", action: "deleteMany", targetIds: user.id },
    () => prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  );

  await audit.trackPrisma(
    { model: "passwordResetToken", action: "create", targetIds: user.id },
    () =>
      prisma.passwordResetToken.create({
        data: {
          token: hashedToken,
          userId: user.id,
          expiresAt,
        },
      }),
  );

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // TODO: send email with the reset link below instead of logging it on console
  audit.info({ userId: user.id, resetUrlTemplate: `${baseUrl}/reset-password/[token]` }, "Password reset token generated");

  audit.success({ userId: user.id });
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

  const audit = createAuditSpan(
    {
      module: "auth",
      action: "resetPasswordAction",
    },
    undefined,
    "Processing password reset",
    { importance: "high", persist: true },
  );
  const hashedToken = createHash("sha256").update(parsed.data.token).digest("hex");

  const tokenRecord = await audit.trackPrisma(
    { model: "passwordResetToken", action: "findUnique" },
    () =>
      prisma.passwordResetToken.findUnique({
        where: { token: hashedToken },
      }),
  );

  if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
    audit.validationFailure({ reason: "invalid_or_expired_token" });
    return {
      status: "error",
      message: "O link de recuperação é inválido ou expirou.",
    };
  }

  const newPasswordHash = await hash(parsed.data.password, 12);

  await audit.trackPrisma(
    { model: "passwordResetToken", action: "$transaction", targetIds: tokenRecord.userId },
    () =>
      prisma.$transaction([
        prisma.user.update({
          where: { id: tokenRecord.userId },
          data: { passwordHash: newPasswordHash },
        }),
        prisma.passwordResetToken.deleteMany({ where: { userId: tokenRecord.userId } }),
      ]),
  );

  audit.success({ userId: tokenRecord.userId });
  redirect("/login?reset=success");
}

export async function updateProfileAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const session = await auth();

  const audit = createAuditSpan(
    {
      module: "auth",
      action: "updateProfileAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    { fieldCount: Array.from(formData.keys()).length },
    "Updating profile",
    { importance: "normal", persist: true },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
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
    audit.validationFailure({ reason: "invalid_payload", issues: parsed.error.issues.length });
    return { status: "error", message };
  }

  const user = await audit.trackPrisma(
    { model: "user", action: "findUnique", targetIds: session.user.id },
    () => prisma.user.findUnique({ where: { id: session.user.id } }),
  );

  if (!user) {
    audit.validationFailure({ reason: "user_not_found", userId: session.user.id });
    return { status: "error", message: "Usuário não encontrado." };
  }

  if (parsed.data.newPassword) {
    const isValid = await compare(parsed.data.currentPassword ?? "", user.passwordHash);

    if (!isValid) {
      audit.validationFailure({ reason: "invalid_current_password" });
      return { status: "error", message: "A senha atual informada é inválida." };
    }
  }

  try {
    await audit.trackPrisma(
      { model: "user", action: "update", targetIds: user.id },
      async () =>
        prisma.user.update({
          where: { id: user.id },
          data: {
            name: parsed.data.name,
            email: parsed.data.email,
            ...(parsed.data.newPassword && {
              passwordHash: await hash(parsed.data.newPassword, 12),
            }),
          },
        }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      audit.validationFailure({ reason: "duplicate_email" });
      return {
        status: "error",
        message: "Já existe um usuário com este e-mail.",
      };
    }

    audit.failure(error, { stage: "update_profile" });
    throw error;
  }

  await notifyEntityAction({
    userId: user.id,
    entity: "Perfil",
    entityName: parsed.data.name,
    type: "update",
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  audit.success({ userId: user.id });
  return { status: "success", message: "Perfil atualizado com sucesso." };
}
