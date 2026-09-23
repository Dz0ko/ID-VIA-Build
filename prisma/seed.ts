import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@idaevia.app").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set ADMIN_PASSWORD (12+ characters) in the environment before seeding. No default password is used.");
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({
      data: {
        email,
        name: "IDÆVIA Admin",
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        plan: "AGENCY",
        credits: 15000,
      },
    });
    console.log(`Created admin ${email}`);
  } else {
    console.log(`Admin ${email} already exists`);
  }
}

main().finally(() => db.$disconnect());
