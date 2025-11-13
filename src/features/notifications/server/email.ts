import nodemailer from "nodemailer";
import { createAuditSpan } from "@/lib/logging/audit";

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
  const parsedPort = resolvedPort ? Number(resolvedPort) : NaN;
  const port = Number.isFinite(parsedPort) ? parsedPort : defaultPort;
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
  const recipientDomain = payload.to.split("@")[1] ?? "unknown";

  const audit = createAuditSpan(
    {
      module: "notifications-email",
      action: "sendEmail",
    },
    { recipientDomain, subject: payload.subject },
    "Sending email",
    { importance: "low", logStart: false },
  );

  try {
    const info = await mailer.sendMail({
      from,
      ...payload,
    });

    if (transportMode === "json") {
      audit.info({ mode: "json", messageId: info.messageId });
    }

    audit.success({ mode: transportMode ?? "unknown", messageId: info.messageId });
    return info;
  } catch (error) {
    audit.failure(error, { stage: "sendMail" });
    throw error;
  }
}

export function isEmailDeliveryConfigured() {
  return Boolean(process.env.SMTP_HOST);
}
