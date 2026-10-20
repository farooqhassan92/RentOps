import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BusinessForm } from "@/components/record-forms";
import { Brand } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ownerClerkId = await requireUser();
  if (await db.business.findUnique({ where: { ownerClerkId } })) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="standalone">
      <Brand />
      <div className="panel form-panel">
        <div className="eyebrow">BUSINESS SETUP</div>
        <h1>Set up your workspace</h1>
        <p>One owner, one branch, and a private home for your rental business.</p>
        <BusinessForm error={error} />
      </div>
    </div>
  );
}
