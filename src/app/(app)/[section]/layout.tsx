import { notFound } from "next/navigation";
import WorkspaceLayout from "@/components/workspace-layout";

export const dynamic = "force-dynamic";

export default async function SectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  // Missing assets (for example /favicon.ico) also match [section]. Clerk
  // intentionally skips static-file paths, so reject them before calling auth().
  if (
    !["vehicles", "customers", "rentals", "finance", "maintenance", "reports", "calendar"].includes(
      section,
    )
  ) {
    notFound();
  }

  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
