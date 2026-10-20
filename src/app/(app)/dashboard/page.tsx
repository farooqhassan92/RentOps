import { requireBusiness } from "@/lib/auth";
import { overview } from "@/lib/overview";
import { Dashboard } from "@/components/dashboard";
export default async function DashboardPage() {
  const business = await requireBusiness();
  return <Dashboard business={business} data={await overview(business.id)} />;
}
