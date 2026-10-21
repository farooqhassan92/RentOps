import { requireBusiness } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const business = await requireBusiness();
  return <Shell business={business}>{children}</Shell>;
}
