import { sendEmail } from "@/features/notifications/server/email";
import { createAuditSpan } from "@/lib/logging/audit";

interface SendNewUserPasswordEmailParams {
  name: string;
  email: string;
  temporaryPassword: string;
}

const APP_NAME = process.env.APP_NAME ?? "AcadLab";
const BASE_URL = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendNewUserPasswordEmail({
  name,
  email,
  temporaryPassword,
}: SendNewUserPasswordEmailParams) {
  const recipientDomain = email.split("@")[1] ?? "unknown";
  const audit = createAuditSpan(
    {
      module: "user-management-email",
      action: "sendNewUserPasswordEmail",
    },
    { recipientDomain },
    "Sending new user password email",
    { importance: "low", logStart: false },
  );
  const loginUrl = `${BASE_URL}/login`;
  const subject = `${APP_NAME} - Sua conta foi criada`;

  const safeName = sanitizeName(name);
  const text = `Olá ${safeName},\n\nSua conta no ${APP_NAME} foi criada e já está pronta para uso.\n\nUse a senha provisória abaixo para acessar o sistema pela primeira vez e, em seguida, solicite a redefinição da senha na página de login.\n\nSenha provisória: ${temporaryPassword}\nAcesse: ${loginUrl}\n\nSe você não esperava este e-mail, ignore-o ou entre em contato com o suporte.`;

  const html = `
    <div style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Olá ${escapeHtml(safeName)},</p>
      <p>Sua conta no <strong>${escapeHtml(APP_NAME)}</strong> foi criada e já está pronta para uso.</p>
      <p>
        Use a senha provisória abaixo para acessar o sistema pela primeira vez e, em seguida,
        solicite a redefinição na opção <em>Esqueci minha senha</em> na página de login.
      </p>
      <p style="margin: 24px 0;">
        <strong>Senha provisória:</strong>
        <span style="display: inline-block; font-family: 'Fira Code', monospace; background: #0f172a; color: #f8fafc; padding: 8px 12px; border-radius: 8px; letter-spacing: 1px;">${escapeHtml(temporaryPassword)}</span>
      </p>
      <p>
        Acesse em: <a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a>
      </p>
      <p style="font-size: 0.875rem; color: #475569;">
        Se você não esperava este e-mail, ignore-o ou entre em contato com o suporte.
      </p>
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

function sanitizeName(name: string) {
  const trimmed = name.trim();
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
