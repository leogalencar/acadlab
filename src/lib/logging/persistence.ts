import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type PersistedAuditLogEntry = {
  level: "debug" | "info" | "warn" | "error";
  module: string;
  action: string;
  actorId?: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

export async function persistAuditLog(entry: PersistedAuditLogEntry) {
  try {
    const defaultMetadata: Prisma.JsonObject = {};
    const metadata: Prisma.InputJsonValue = entry.metadata ?? defaultMetadata;

    await prisma.auditLog.create({
      data: {
        level: entry.level,
        module: entry.module,
        action: entry.action,
        actorId: entry.actorId,
        message: entry.message,
        metadata,
      },
    });
  } catch (error) {
    console.error("[audit-log] Failed to persist audit log", error);
  }
}
