import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "./db";
export const configured = () => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY && process.env.DATABASE_URL);
export async function requireUser() {
  if (!configured()) redirect("/setup");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}
export async function requireBusiness() {
  const ownerClerkId = await requireUser();
  const business = await db.business.findUnique({ where: { ownerClerkId } });
  if (!business) redirect("/onboarding");
  return business;
}
