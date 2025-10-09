import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Hash password for test users
  const hashedPassword = await bcrypt.hash("password123", 10);

  // Create test users
  await prisma.user.upsert({
    where: { email: "professor@acadlab.com" },
    update: {},
    create: {
      email: "professor@acadlab.com",
      name: "John Professor",
      password: hashedPassword,
      role: "PROFESSOR",
    },
  });

  await prisma.user.upsert({
    where: { email: "technician@acadlab.com" },
    update: {},
    create: {
      email: "technician@acadlab.com",
      name: "Jane Technician",
      password: hashedPassword,
      role: "TECHNICIAN",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@acadlab.com" },
    update: {},
    create: {
      email: "admin@acadlab.com",
      name: "Admin User",
      password: hashedPassword,
      role: "ADMINISTRATOR",
    },
  });

  console.log("Seeding completed!");
  console.log("\nTest users created:");
  console.log("1. Professor - professor@acadlab.com / password123");
  console.log("2. Technician - technician@acadlab.com / password123");
  console.log("3. Administrator - admin@acadlab.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
