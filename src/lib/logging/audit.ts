import { logger } from "@/lib/logging/logger";
import { persistAuditLog } from "@/lib/logging/persistence";
import type { Prisma } from "@prisma/client";

export type AuditSpanMeta = {
  module: string;
  action: string;
  actorId?: string;
  actorRole?: string;
  correlationId?: string;
};

type Primitive = string | number | boolean | null | undefined;

export type PrismaOperationMeta<T> = {
  model: string;
  action: string;
  targetIds?: string | string[] | null;
  meta?: Record<string, unknown>;
  summarizeResult?: (result: T) => Record<string, unknown>;
};

export type AuditImportance = "low" | "normal" | "high";

export type AuditSpanOptions = {
  importance?: AuditImportance;
  persist?: boolean;
  logStart?: boolean;
  logSuccess?: boolean;
};

export type AuditSpan = {
  correlationId: string;
  success(details?: Record<string, unknown>, message?: string): void;
  failure(error: unknown, details?: Record<string, unknown>, message?: string): void;
  validationFailure(details: Record<string, unknown>, message?: string): void;
  info(details?: Record<string, unknown>, message?: string): void;
  debug(details?: Record<string, unknown>, message?: string): void;
  trackPrisma<T>(operation: PrismaOperationMeta<T>, executor: () => Promise<T>): Promise<T>;
};

const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "email",
  "document",
  "notes",
  "reason",
  "description",
];

const MAX_STRING_LENGTH = 160;
const MAX_ARRAY_PREVIEW = 5;

const importanceRank: Record<AuditImportance, number> = {
  low: 0,
  normal: 1,
  high: 2,
};

function getImportanceThreshold(): AuditImportance {
  const raw = process.env.AUDIT_LOG_LEVEL?.toLowerCase() as AuditImportance | undefined;
  if (raw === "low" || raw === "normal" || raw === "high") {
    return raw;
  }
  return "high";
}

const importanceThreshold = getImportanceThreshold();
const persistenceEnabled = (process.env.AUDIT_LOG_PERSISTENCE ?? "true").toLowerCase() !== "false";

function shouldLogImportance(importance: AuditImportance) {
  return importanceRank[importance] >= importanceRank[importanceThreshold];
}

const toMetadataPayload = (
  value?: Record<string, unknown>,
): Prisma.InputJsonValue | undefined => {
  if (!value || Object.keys(value).length === 0) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
};

export function createAuditSpan(
  meta: AuditSpanMeta,
  startDetails?: Record<string, unknown>,
  startMessage = `Starting ${meta.action}`,
  options: AuditSpanOptions = {},
): AuditSpan {
  const correlationId = meta.correlationId ?? generateCorrelationId();
  const baseLogger = logger.child({
    module: meta.module,
    action: meta.action,
    actorId: meta.actorId,
    actorRole: meta.actorRole,
    correlationId,
  });

  const createdAt = Date.now();
  const importance = options.importance ?? "normal";
  const shouldLog = shouldLogImportance(importance);
  const shouldPersist = options.persist ?? (importance !== "low" && persistenceEnabled);
  const logStart = options.logStart ?? shouldLog;
  const logSuccess = options.logSuccess ?? shouldLog;

  const record = (
    level: "debug" | "info" | "warn" | "error",
    payload: Record<string, unknown> | undefined,
    message: string,
    config: { log?: boolean; persist?: boolean } = {},
  ) => {
    const shouldWriteLog =
      typeof config.log === "boolean"
        ? config.log
        : level === "error" || level === "warn" || (level === "debug" ? shouldLog : shouldLog);

    if (shouldWriteLog) {
      baseLogger[level](payload, message);
    }

    const shouldWritePersistence = (shouldPersist && level !== "debug") || Boolean(config.persist);
    if (shouldWritePersistence) {
      void persistAuditLog({
        level,
        module: meta.module,
        action: meta.action,
        actorId: meta.actorId,
        message,
        metadata: toMetadataPayload(payload),
      });
    }
  };

  if (logStart) {
    record(
      "info",
      {
        event: "audit_start",
        ...sanitizeDetails(startDetails),
      },
      startMessage,
      { log: logStart },
    );
  }

  return {
    correlationId,
    success(details, message = `${meta.action} succeeded`) {
      const payload = {
        event: "audit_success",
        durationMs: Date.now() - createdAt,
        ...sanitizeDetails(details),
      };
      record("info", payload, message, {
        log: logSuccess,
        persist: shouldPersist,
      });
    },
    failure(error, details, message = `${meta.action} failed`) {
      record(
        "error",
        {
          event: "audit_failure",
          durationMs: Date.now() - createdAt,
          error: serializeError(error),
          ...sanitizeDetails(details),
        },
        message,
        { persist: true },
      );
    },
    validationFailure(details, message = `${meta.action} validation failed`) {
      record(
        "warn",
        {
          event: "audit_validation_failure",
          durationMs: Date.now() - createdAt,
          ...sanitizeDetails(details),
        },
        message,
        { persist: shouldPersist },
      );
    },
    info(details, message = `${meta.action} info`) {
      record(
        "info",
        {
          event: "audit_info",
          ...sanitizeDetails(details),
        },
        message,
        { log: shouldLog },
      );
    },
    debug(details, message = `${meta.action} debug`) {
      record(
        "debug",
        {
          event: "audit_debug",
          ...sanitizeDetails(details),
        },
        message,
        { log: shouldLog },
      );
    },
    async trackPrisma<T>(
      operation: PrismaOperationMeta<T>,
      executor: () => Promise<T>,
    ) {
      const opLogger = baseLogger.child({
        event: "prisma_operation",
        model: operation.model,
        action: operation.action,
        targetIds: sanitizeValue("targetIds", operation.targetIds),
      });
      const startedAt = Date.now();

      if (shouldLog) {
        opLogger.debug(
          {
            stage: "start",
            meta: sanitizeDetails(operation.meta),
          },
          "Executing Prisma operation",
        );
      }

      try {
        const result = await executor();
        const summary = operation.summarizeResult?.(result) ?? summarizeResult(result);
        if (shouldLog) {
          opLogger.info(
            {
              stage: "success",
              durationMs: Date.now() - startedAt,
              ...sanitizeDetails(summary),
            },
            "Prisma operation succeeded",
          );
        }
        return result;
      } catch (error) {
        opLogger.error(
          {
            stage: "failure",
            durationMs: Date.now() - startedAt,
            meta: sanitizeDetails(operation.meta),
            error: serializeError(error),
          },
          "Prisma operation failed",
        );
        throw error;
      }
    },
  };
}

function generateCorrelationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { message: String(error) };
}

function sanitizeDetails(details?: Record<string, unknown>) {
  if (!details) {
    return undefined;
  }

  return Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const sanitized = sanitizeValue(key, value);
    if (sanitized !== undefined) {
      acc[key] = sanitized;
    }
    return acc;
  }, {});
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalizedKey = key.toLowerCase();

  if (typeof value === "string") {
    if (SENSITIVE_KEYS.some((sensitive) => normalizedKey.includes(sensitive))) {
      return maskSensitiveString(normalizedKey, value);
    }
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length <= MAX_ARRAY_PREVIEW && value.every(isPrimitive)) {
      return value;
    }

    return {
      count: value.length,
      sample: value.slice(0, MAX_ARRAY_PREVIEW).map((item) => summarizeValue(item)),
    };
  }

  if (typeof value === "object") {
    return sanitizeDetails(value as Record<string, unknown>);
  }

  return String(value);
}

function summarizeResult(result: unknown) {
  if (Array.isArray(result)) {
    return {
      count: result.length,
      sampleIds: result
        .slice(0, MAX_ARRAY_PREVIEW)
        .map(extractId)
        .filter(Boolean),
    };
  }

  if (typeof result === "number") {
    return { count: result };
  }

  if (result && typeof result === "object") {
    const asRecord = result as Record<string, unknown>;
    if (asRecord.id && typeof asRecord.id === "string") {
      return { id: asRecord.id };
    }
    if (typeof asRecord.count === "number") {
      return { count: asRecord.count };
    }
    return sanitizeDetails(asRecord);
  }

  return { resultType: typeof result };
}

function extractId(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const maybeRecord = value as Record<string, unknown>;
  if (typeof maybeRecord.id === "string") {
    return maybeRecord.id;
  }
  return undefined;
}

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function summarizeValue(value: unknown) {
  if (isPrimitive(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return { count: value.length };
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value && typeof value === "object") {
    const maybeRecord = value as Record<string, unknown>;
    if (typeof maybeRecord.id === "string") {
      return { id: maybeRecord.id };
    }
    return { keys: Object.keys(maybeRecord).slice(0, MAX_ARRAY_PREVIEW) };
  }
  return String(value);
}

function maskSensitiveString(key: string, value: string) {
  if (key.includes("email")) {
    const [local, domain] = value.split("@");
    if (!domain) {
      return "[redacted-email]";
    }
    const maskedLocal = local.length <= 2 ? `${local.slice(0, 1)}*` : `${local.slice(0, 2)}***`;
    return `${maskedLocal}@${domain}`;
  }

  return "[redacted]";
}
