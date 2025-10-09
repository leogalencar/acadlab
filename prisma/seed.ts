import { PrismaClient, Prisma, Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const FALLBACK_PASSWORD = "ChangeMe123!";

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

async function main() {
  await ensureAdmin();
}

main()
  .catch((error) => {
    console.error("[seed] Failed to seed admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
