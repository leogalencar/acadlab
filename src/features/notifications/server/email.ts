import nodemailer from "nodemailer";

export type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let transporter: nodemailer.Transporter | null = null;
let transportMode: "smtp" | "json" | null = null;

function resolveTransporter() {
  if (transporter) {
    return transporter;
  }

  const secure = process.env.SMTP_SECURE === "true";
  const host = process.env.SMTP_HOST;

  if (!host) {
    transportMode = "json";
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  const resolvedPort = process.env.SMTP_PORT;
  const defaultPort = secure ? 465 : 587;
  const port = resolvedPort ? Number(resolvedPort) : defaultPort;
  const authUser = process.env.SMTP_USER;
  const authPassword = process.env.SMTP_PASSWORD;

  transportMode = "smtp";
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      authUser && authPassword
        ? {
            user: authUser,
            pass: authPassword,
          }
        : undefined,
  });

  return transporter;
}

export async function sendEmail(payload: SendEmailPayload) {
  const mailer = resolveTransporter();
  const from = process.env.SMTP_FROM ?? "AcadLab <no-reply@acadlab.local>";

  const info = await mailer.sendMail({
    from,
    ...payload,
  });

  if (transportMode === "json") {
    console.info("[mail] E-mail capturado (modo JSON)", {
      messageId: info.messageId,
      subject: payload.subject,
      to: payload.to,
    });
  }

  return info;
}

export function isEmailDeliveryConfigured() {
  return Boolean(process.env.SMTP_HOST);
}
