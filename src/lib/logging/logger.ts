import pino, { type Logger as PinoLogger } from "pino";

const hasNodeProcess =
  typeof process !== "undefined" &&
  typeof process.versions?.node === "string";

const env = hasNodeProcess ? process.env : undefined;
const isProduction = env?.NODE_ENV === "production";
const defaultLevel = isProduction ? "info" : "debug";
const level = env?.LOG_LEVEL ?? defaultLevel;

const runtimeFromEnv = env?.NEXT_RUNTIME;
const nextRuntimeHints = [
  "NEXT_PHASE",
  "__NEXT_PRIVATE_PREBUNDLED_REACT",
  "__NEXT_DEV_SERVER",
  "TURBOPACK",
  "VERCEL",
];
const hasNextHints = nextRuntimeHints.some((key) => Boolean(env?.[key]));
const isManagedByNext =
  runtimeFromEnv === "edge" ||
  runtimeFromEnv === "nodejs" ||
  hasNextHints;
const isEdgeRuntime = !hasNodeProcess || runtimeFromEnv === "edge";

type ConsoleLogLevel = "debug" | "info" | "warn" | "error";

type BaseLogger = {
  child: (context?: LogContext) => BaseLogger;
  debug: (obj?: unknown, message?: string) => void;
  info: (obj?: unknown, message?: string) => void;
  warn: (obj?: unknown, message?: string) => void;
  error: (obj?: unknown, message?: string) => void;
};

const consoleMethodMap: Record<ConsoleLogLevel, keyof Console> = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
};

type NormalizedPayload = {
  metadata?: Record<string, unknown>;
  logMessage?: string;
};

function normalizePayload(payload?: unknown, message?: string): NormalizedPayload {
  let logMessage = message;
  let metadata: Record<string, unknown> | undefined;

  if (typeof payload === "string" && !message) {
    logMessage = payload;
  } else if (payload && typeof payload === "object") {
    metadata = payload as Record<string, unknown>;
  } else if (payload !== undefined) {
    metadata = { value: payload };
  }

  return { metadata, logMessage };
}

function logWithConsole(
  level: ConsoleLogLevel,
  context: LogContext,
  payload?: unknown,
  message?: string,
) {
  const { metadata, logMessage } = normalizePayload(payload, message);

  const merged = { ...context, ...(metadata ?? {}) };
  const method = console[consoleMethodMap[level]];
  const consoleMethod =
    (typeof method === "function" ? method : console.log) as (...args: unknown[]) => void;
  const prefix = `[${level}]`;

  if (Object.keys(merged).length > 0) {
    consoleMethod(`${prefix} ${logMessage ?? ""}`.trim(), merged);
  } else if (logMessage) {
    consoleMethod(`${prefix} ${logMessage}`);
  } else if (metadata) {
    consoleMethod(prefix, merged);
  } else {
    consoleMethod(prefix);
  }
}

function logWithPino(
  instance: PinoLogger,
  level: ConsoleLogLevel,
  payload?: unknown,
  message?: string,
) {
  const { metadata, logMessage } = normalizePayload(payload, message);

  if (metadata && logMessage !== undefined) {
    instance[level](metadata, logMessage);
    return;
  }

  if (metadata) {
    instance[level](metadata);
    return;
  }

  if (logMessage !== undefined) {
    instance[level](logMessage);
    return;
  }

  instance[level](`[${level}]`);
}

function createConsoleLogger(context: LogContext = {}): BaseLogger {
  return {
    child(childContext: LogContext = {}) {
      return createConsoleLogger({ ...context, ...childContext });
    },
    debug(payload?: unknown, message?: string) {
      logWithConsole("debug", context, payload, message);
    },
    info(payload?: unknown, message?: string) {
      logWithConsole("info", context, payload, message);
    },
    warn(payload?: unknown, message?: string) {
      logWithConsole("warn", context, payload, message);
    },
    error(payload?: unknown, message?: string) {
      logWithConsole("error", context, payload, message);
    },
  };
}

const resolveTransport = () => {
  const envTransport = env?.LOG_TRANSPORT;

  if (isProduction) {
    return undefined;
  }

  if (!envTransport || envTransport === "pretty") {
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    } as const;
  }

  if (envTransport === "json") {
    return undefined;
  }

  return { target: envTransport } as const;
};

export type LogContext = {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
};

function wrapPinoInstance(instance: PinoLogger): BaseLogger {
  return {
    child(childContext: LogContext = {}) {
      return wrapPinoInstance(instance.child(childContext));
    },
    debug(payload?: unknown, message?: string) {
      logWithPino(instance, "debug", payload, message);
    },
    info(payload?: unknown, message?: string) {
      logWithPino(instance, "info", payload, message);
    },
    warn(payload?: unknown, message?: string) {
      logWithPino(instance, "warn", payload, message);
    },
    error(payload?: unknown, message?: string) {
      logWithPino(instance, "error", payload, message);
    },
  };
}

function createPinoLogger(): BaseLogger {
  try {
    const instance = pino({
      level,
      transport: isManagedByNext ? undefined : resolveTransport(),
      base: undefined,
      messageKey: "message",
      formatters: {
        level(label) {
          return { level: label };
        },
      },
    });
    return wrapPinoInstance(instance);
  } catch (error) {
    console.warn(
      "[logger] Failed to initialize pino transport. Falling back to console logger.",
      error,
    );
    return createConsoleLogger();
  }
}

const baseLogger: BaseLogger = isEdgeRuntime ? createConsoleLogger() : createPinoLogger();

export const logger = baseLogger;

export type Logger = typeof logger;

export function withContext(context: LogContext) {
  return logger.child(context);
}

export function withRequestContext(requestId: string, context: LogContext = {}) {
  return withContext({ ...context, requestId });
}

export function withUserContext(userId: string, context: LogContext = {}) {
  return withContext({ ...context, userId });
}

export function withRequestAndUser(
  requestId: string,
  userId: string,
  context: LogContext = {},
) {
  return withContext({ ...context, requestId, userId });
}
