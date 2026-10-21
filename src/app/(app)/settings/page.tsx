import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui";
import { BusinessForm } from "@/components/record-forms";
import { dateLabel } from "@/lib/domain";
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const b = await requireBusiness();
  const { saved } = await searchParams;
  const audit = await db.audit.findMany({
    where: { businessId: b.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE"
        title="Settings"
        description="Your business details, rental defaults, and recent activity."
      />
      {saved && <div className="notice success">Workspace settings saved.</div>}
      <div className="stack">
        <div className="panel form-panel">
          <BusinessForm business={b} />
        </div>
        <Panel
          title="Recent activity"
          subtitle="Your latest 25 changes. Financial records are preserved."
        >
          <ul className="activity">
            {audit.map((a) => (
              <li key={a.id}>
                <strong>{a.action.replaceAll("_", " ").toLowerCase()}</strong>
                <small>
                  {dateLabel(a.createdAt, b.timezone)} · {a.entityType}
                </small>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
