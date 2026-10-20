import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ quiet: true });
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running billing.");
const { runMonthlyBilling } = await import("../src/lib/service");
const { db } = await import("../src/lib/db");
try { console.log(`Checked monthly billing for ${await runMonthlyBilling()} active rentals.`); }
finally { await db.$disconnect(); }
