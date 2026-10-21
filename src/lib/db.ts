import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
const globalDb = globalThis as unknown as { rentopsDb?: PrismaClient };
export const db = globalDb.rentopsDb ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || "postgresql://rentops:rentops_local@127.0.0.1:55432/rentops", max: 10 }),
});
if (process.env.NODE_ENV !== "production") globalDb.rentopsDb = db;
