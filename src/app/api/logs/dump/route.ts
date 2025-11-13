import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function escapeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (session.user.role !== Role.ADMIN) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
  const statements = logs.map((log) => {
    const values = [
      log.id,
      log.level,
      log.module,
      log.action,
      log.actorId ?? null,
      log.message,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.createdAt.toISOString().replace("T", " ").replace("Z", ""),
    ].map((value) => (value === null ? "NULL" : `'${escapeValue(String(value))}'`));

    return `INSERT INTO AuditLog (id, level, module, action, actorId, message, metadata, createdAt) VALUES (${values.join(", ")});`;
  });

  const body = [
    "-- Audit log dump",
    `-- Generated at ${new Date().toISOString()}`,
    ...statements,
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-dump.sql"`,
    },
  });
}
