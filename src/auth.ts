import NextAuth, { AuthError, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { Role, UserStatus } from "@prisma/client";
import { logger } from "@/lib/logging/logger";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

const isRole = (value: unknown): value is Role =>
  typeof value === "string" &&
  (Object.values(Role) as string[]).includes(value);

const isUserStatus = (value: unknown): value is UserStatus =>
  typeof value === "string" &&
  (Object.values(UserStatus) as string[]).includes(value);

const authLogger = logger.child({ module: "auth" });

const SENSITIVE_METADATA_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "sessionToken",
]);

const sanitizeLogDetail = (detail: unknown) => {
  if (!detail) {
    return undefined;
  }

  if (detail instanceof Error) {
    const { name, message, stack } = detail;
    return { name, message, stack };
  }

  if (typeof detail !== "object") {
    return detail;
  }

  return Object.entries(detail).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (SENSITIVE_METADATA_KEYS.has(key)) {
        acc[key] = "[redacted]";
        return acc;
      }

      acc[key] = value;
      return acc;
    },
    {},
  );
};

const logAuthRejection = (
  reason: string,
  details: Record<string, unknown>,
  message: string,
) => {
  authLogger.warn({ reason, ...details }, message);
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (
        credentials,
        _request,
      ): Promise<User | null> => {
        void _request;
        const attemptedEmail = credentials?.email ?? "unknown";
        authLogger.info(
          { email: attemptedEmail },
          "Received credentials authentication request",
        );

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          const issues = parsed.error.issues.map(({ path, message }) => ({
            path: path.join("."),
            message,
          }));
          logAuthRejection(
            "validation_failed",
            { email: attemptedEmail, issues },
            "Rejecting authentication: credentials validation failed",
          );
          return null;
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          logAuthRejection(
            "user_not_found",
            { email },
            "Rejecting authentication: user not found",
          );
          return null;
        }

        if (user.status !== UserStatus.ACTIVE) {
          logAuthRejection(
            "user_inactive",
            { email, userId: user.id, status: user.status },
            "Rejecting authentication: user not active",
          );
          return null;
        }

        const isValidPassword = await compare(password, user.passwordHash);

        if (!isValidPassword) {
          logAuthRejection(
            "invalid_password",
            { email, userId: user.id },
            "Rejecting authentication: invalid password",
          );
          return null;
        }

        const authUser: User = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        };

        authLogger.info(
          {
            event: "credentials_authenticated",
            userId: user.id,
            email: user.email,
            role: user.role,
            status: user.status,
          },
          "User authenticated via credentials",
        );

        return authUser;
      },
    }),
  ],
  logger: {
    error(...details) {
      const [primary, ...rest] = details;
      if (
        primary instanceof AuthError &&
        primary.type === "CredentialsSignin"
      ) {
        authLogger.debug(
          { reason: "expected_credentials_error" },
          "Suppressed noisy credentials error log",
        );
        return;
      }

      authLogger.error(
        {
          event: "nextauth_error",
          detail: sanitizeLogDetail(primary),
          extra: rest.map(sanitizeLogDetail).filter(Boolean),
        },
        "NextAuth reported an error",
      );
    },
    warn(...details) {
      const [primary, ...rest] = details;
      authLogger.warn(
        {
          event: "nextauth_warning",
          detail: sanitizeLogDetail(primary),
          extra: rest.map(sanitizeLogDetail).filter(Boolean),
        },
        "NextAuth warning",
      );
    },
    debug(...details) {
      const [primary, ...rest] = details;
      authLogger.debug(
        {
          event: "nextauth_debug",
          detail: sanitizeLogDetail(primary),
          extra: rest.map(sanitizeLogDetail).filter(Boolean),
        },
        "NextAuth debug",
      );
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const { role, status } = user as {
          role?: Role;
          status?: UserStatus;
        };

        if (role) {
          token.role = role;
        }

        if (status) {
          token.status = status;
        }

        authLogger.debug(
          {
            event: "jwt_mutation",
            userId: user.id ?? token.sub,
            role: token.role,
            status: token.status,
          },
          "JWT callback attached user claims",
        );
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (isRole(token.role)) {
          session.user.role = token.role;
        }
        if (isUserStatus(token.status)) {
          session.user.status = token.status;
        }
        if (token.name) {
          session.user.name = token.name;
        }
        if (token.email) {
          session.user.email = token.email;
        }
      }

      if (session.user) {
        authLogger.debug(
          {
            event: "session_mutation",
            userId: session.user.id,
            email: session.user.email,
            role: session.user.role,
            status: session.user.status,
          },
          "Session synchronized with JWT claims",
        );
      }

      return session;
    },
  },
  events: {
    async signOut({ token, session }) {
      const eventDetails = {
        event: "sign_out",
        userId: token?.sub ?? session?.user?.id,
        email: session?.user?.email,
        role: token?.role,
        status: token?.status,
      };

      authLogger.info(eventDetails, "User signed out");
    },
  },
});
