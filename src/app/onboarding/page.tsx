import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BusinessForm } from "@/components/record-forms";
import { Brand } from "@/components/shell";
import { OnboardingAccount } from "@/components/onboarding-account";
import { Building2, Check, ArrowRight, ShieldCheck } from "lucide-react";
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
    <div className="onboarding-page">
      <header className="onboarding-header">
        <nav className="onboarding-nav" aria-label="Main navigation">
          <div className="onboarding-nav-brand">
            <Brand />
            <span className="onboarding-nav-label">Workspace setup</span>
          </div>
          <OnboardingAccount />
        </nav>
      </header>
      <main className="onboarding-main">
        <aside className="onboarding-guide" aria-label="Setup progress">
          <div className="onboarding-guide-icon">
            <Building2 size={23} />
          </div>
          <div className="eyebrow">WELCOME TO RENTOPS</div>
          <h1>A home for your rental business.</h1>
          <p>Bring your fleet, customers, and bookings together in one workspace.</p>
          <ol className="onboarding-steps">
            <li>
              <span className="onboarding-step-done">
                <Check size={15} />
              </span>
              <div>
                <strong>Your account</strong>
                <small>You’re signed in and ready to go</small>
              </div>
            </li>
            <li aria-current="step">
              <span className="onboarding-step-current">2</span>
              <div>
                <strong>Set up your workspace</strong>
                <small>Add your business details and preferences</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Make it yours</strong>
                <small>Add your first vehicle from the dashboard</small>
              </div>
            </li>
          </ol>
          <div className="onboarding-security">
            <ShieldCheck size={19} />
            <p>
              Your business, your space.
              <br />
              Only your account can access this workspace.
            </p>
          </div>
        </aside>
        <section className="panel onboarding-form-panel" aria-labelledby="workspace-heading">
          <div className="onboarding-form-heading">
            <span className="onboarding-step-label">STEP 2 OF 3</span>
            <h2 id="workspace-heading">Let’s set up your workspace</h2>
            <p>Start with the essentials. You can update these in settings later.</p>
          </div>
          <BusinessForm error={error} />
          <p className="onboarding-form-note">
            <ArrowRight size={14} /> Next stop: your RentOps dashboard
          </p>
        </section>
      </main>
      <footer className="onboarding-footer">
        <span>RentOps · Your rental business, in control.</span>
        <span>
          <ShieldCheck size={14} /> Private workspace
        </span>
      </footer>
    </div>
  );
}
