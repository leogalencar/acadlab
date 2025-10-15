import { PrismaClient, Prisma, Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const FALLBACK_PASSWORD = "ChangeMe123!";
const SYSTEM_RULES_ID = "acadlab-system-rules";

const DEFAULT_SYSTEM_RULES = {
  primaryColor: "#1D4ED8",
  secondaryColor: "#1E293B",
  accentColor: "#F97316",
  morningFirstClassStart: 7 * 60,
  morningClassDurationMinutes: 50,
  morningClassesCount: 6,
  morningIntervalStart: 9 * 60 + 50,
  morningIntervalDurationMinutes: 20,
  afternoonFirstClassStart: 13 * 60,
  afternoonClassDurationMinutes: 50,
  afternoonClassesCount: 5,
  afternoonIntervalStart: 15 * 60 + 40,
  afternoonIntervalDurationMinutes: 15,
  eveningFirstClassStart: 18 * 60 + 30,
  eveningClassDurationMinutes: 50,
  eveningClassesCount: 4,
  eveningIntervalStart: 19 * 60 + 20,
  eveningIntervalDurationMinutes: 10,
};

type EnsureUserOptions = {
  email: string;
  defaultName: string;
  nameFromEnv?: string;
  passwordFromEnv?: string;
  role: Role;
  logLabel: string;
};

async function ensureRoleUser({
  email,
  defaultName,
  nameFromEnv,
  passwordFromEnv,
  role,
  logLabel,
}: EnsureUserOptions) {
  const name = (nameFromEnv ?? defaultName).trim();

  if (!passwordFromEnv) {
    console.warn(
      `[seed] ${logLabel} password env not set. A temporary password will be used for new accounts and existing passwords will stay unchanged.`,
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const passwordHash = await hash(passwordFromEnv ?? FALLBACK_PASSWORD, 10);

    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        status: UserStatus.ACTIVE,
      },
    });

    console.log(`[seed] Created ${logLabel} user (${email}).`);
    if (!passwordFromEnv) {
      console.log("[seed] Temporary password:", FALLBACK_PASSWORD);
    } else {
      console.log("[seed] Password sourced from environment variable.");
    }

    return;
  }

  const updates: Prisma.UserUpdateInput = {};

  if (existing.role !== role) {
    updates.role = role;
  }

  if (existing.status !== UserStatus.ACTIVE) {
    updates.status = UserStatus.ACTIVE;
  }

  if (name && name !== existing.name) {
    updates.name = name;
  }

  if (passwordFromEnv) {
    updates.passwordHash = await hash(passwordFromEnv, 10);
  }

  const needsUpdate = Object.keys(updates).length > 0;

  if (needsUpdate) {
    await prisma.user.update({
      where: { id: existing.id },
      data: updates,
    });

    console.log(`[seed] Updated ${logLabel} user (${email}).`);
    if (passwordFromEnv) {
      console.log("[seed] Password updated from environment variable.");
    } else {
      console.log("[seed] Existing password left unchanged.");
    }
  } else {
    console.log(`[seed] ${logLabel} user (${email}) already up-to-date.`);
    if (!passwordFromEnv) {
      console.log("[seed] Existing password left unchanged.");
    }
  }
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@acadlab.local";
  const nameFromEnv = process.env.ADMIN_NAME;
  const passwordFromEnv = process.env.ADMIN_PASSWORD;

  if (!passwordFromEnv) {
    console.warn(
      "[seed] ADMIN_PASSWORD not set. A temporary password will be used for new admins and existing passwords will stay unchanged.",
    );
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email } });

  if (!existingAdmin) {
    const passwordHash = await hash(passwordFromEnv ?? FALLBACK_PASSWORD, 10);

    await prisma.user.create({
      data: {
        email,
        name: nameFromEnv ?? "Administrator",
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    console.log(`[seed] Created admin user (${email}).`);
    if (!passwordFromEnv) {
      console.log("[seed] Temporary password:", FALLBACK_PASSWORD);
    } else {
      console.log("[seed] Password sourced from ADMIN_PASSWORD env variable.");
    }

    return;
  }

  const updates: Prisma.UserUpdateInput = {};

  if (existingAdmin.role !== Role.ADMIN) {
    updates.role = Role.ADMIN;
  }

  if (existingAdmin.status !== UserStatus.ACTIVE) {
    updates.status = UserStatus.ACTIVE;
  }

  if (nameFromEnv && nameFromEnv !== existingAdmin.name) {
    updates.name = nameFromEnv;
  }

  if (passwordFromEnv) {
    updates.passwordHash = await hash(passwordFromEnv, 10);
  }

  const needsUpdate = Object.keys(updates).length > 0;

  if (needsUpdate) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: updates,
    });
    console.log(`[seed] Updated admin user (${email}).`);
    if (passwordFromEnv) {
      console.log("[seed] Password updated from ADMIN_PASSWORD env variable.");
    } else {
      console.log("[seed] Existing admin password left unchanged.");
    }
  } else {
    console.log(`[seed] Admin user (${email}) already up-to-date.`);
    if (!passwordFromEnv) {
      console.log("[seed] Existing admin password left unchanged.");
    }
  }
}

async function ensureSystemRules() {
  await prisma.systemRules.upsert({
    where: { id: SYSTEM_RULES_ID },
    update: {},
    create: {
      id: SYSTEM_RULES_ID,
      ...DEFAULT_SYSTEM_RULES,
    },
  });

  console.log("[seed] System rules configured.");
}

async function main() {
  await ensureAdmin();
  await ensureRoleUser({
    email: process.env.TECHNICIAN_EMAIL ?? "tech@acadlab.local",
    defaultName: "Technician",
    nameFromEnv: process.env.TECHNICIAN_NAME,
    passwordFromEnv: process.env.TECHNICIAN_PASSWORD,
    role: Role.TECHNICIAN,
    logLabel: "technician",
  });
  await ensureRoleUser({
    email: process.env.PROFESSOR_EMAIL ?? "prof@acadlab.local",
    defaultName: "Professor",
    nameFromEnv: process.env.PROFESSOR_NAME,
    passwordFromEnv: process.env.PROFESSOR_PASSWORD,
    role: Role.PROFESSOR,
    logLabel: "professor",
  });
  await ensureSystemRules();
}

main()
  .catch((error) => {
    console.error("[seed] Failed to seed admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
