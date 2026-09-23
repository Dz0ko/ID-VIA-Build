import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConnection } from "./database-connection";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connection = databaseConnection(process.env.DATABASE_URL || "postgresql://localhost/idaevia");

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(connection.pool, { schema: connection.schema }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
