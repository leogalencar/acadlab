import { sendEmail } from "@/features/notifications/server/email";
import { createAuditSpan } from "@/lib/logging/audit";

interface SendPasswordResetEmailParams {
  email: string;
  token: string;
  name?: string | null;
  expiresAt: Date;
}

const APP_NAME = process.env.APP_NAME ?? "AcadLab";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendPasswordResetEmail({
  email,
  token,
  name,
  expiresAt,
}: SendPasswordResetEmailParams) {
  const resetUrl = new URL(`/reset-password/${token}`, BASE_URL).toString();
  const recipientDomain = email.split("@")[1] ?? "unknown";
  const audit = createAuditSpan(
    {
      module: "auth-email",
      action: "sendPasswordResetEmail",
    },
    { recipientDomain },
    "Sending password reset email",
    { importance: "low", logStart: false },
  );
  const expiresAtLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(expiresAt);
  const subject = `${APP_NAME} - Redefinição de senha`;
  const safeName = sanitizeName(name);

  const text = `Olá ${safeName},\n\nRecebemos uma solicitação para redefinir sua senha no ${APP_NAME}.\nUse o link abaixo para criar uma nova senha:\n${resetUrl}\n\nO link é válido até ${expiresAtLabel}. Se você não fez esta solicitação, ignore este e-mail.`;

  const html = `
    <div style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Olá ${escapeHtml(safeName)},</p>
      <p>Recebemos uma solicitação para redefinir sua senha no <strong>${escapeHtml(APP_NAME)}</strong>.</p>
      <p>Use o link abaixo para criar uma nova senha:</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #f8fafc; padding: 10px 16px; border-radius: 8px; text-decoration: none;">Redefinir senha</a>
      </p>
      <p style="font-size: 0.95rem;">O link é válido até <strong>${escapeHtml(expiresAtLabel)}</strong>.</p>
      <p style="font-size: 0.875rem; color: #475569;">Se você não fez esta solicitação, ignore este e-mail.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject,
      text,
      html,
    });

    audit.success({ recipientDomain });
  } catch (error) {
    audit.failure(error, { stage: "send_email" });
    throw error;
  }
}

function sanitizeName(name?: string | null) {
  const trimmed = (name ?? "").trim();

  if (!trimmed) {
    return "Usuário";
  }

  return trimmed;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}
