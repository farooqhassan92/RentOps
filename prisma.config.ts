import { config } from "dotenv";
import { defineConfig } from "prisma/config";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

const migrationUrl = new URL(
  process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    "postgresql://rentops:rentops_local@127.0.0.1:55432/rentops",
);
// Neon may add this libpq-only option. Prisma's migration engine does not support it.
migrationUrl.searchParams.delete("channel_binding");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: migrationUrl.toString() },
});
