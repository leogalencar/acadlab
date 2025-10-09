import NextAuth, { AuthError, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { Role, UserStatus } from "@prisma/client";

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
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || user.status !== UserStatus.ACTIVE) {
          return null;
        }

        const isValidPassword = await compare(password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        const authUser: User = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        };

        return authUser;
      },
    }),
  ],
  logger: {
    error(error) {
      if (error instanceof AuthError && error.type === "CredentialsSignin") {
        return;
      }
      console.error(error);
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

      return session;
    },
  },
});
