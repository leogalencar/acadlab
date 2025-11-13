import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const defaultLevel = isProduction ? "info" : "debug";
const level = process.env.LOG_LEVEL ?? defaultLevel;

const envTransport = process.env.LOG_TRANSPORT;

const transport = (() => {
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
})();

export type LogContext = {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
};

export const logger = pino({
  level,
  transport,
  base: undefined,
  messageKey: "message",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

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
