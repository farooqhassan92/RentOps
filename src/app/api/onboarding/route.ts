import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { configured } from "@/lib/auth";
import { createBusiness, publicError } from "@/lib/service";

export async function POST(request: NextRequest) {
  // Native form posts need the same origin protection as Server Actions.
  const origin = request.headers.get("origin");
  let originHost: string | undefined;
  try {
    if (origin) originHost = new URL(origin).host;
  } catch {
    // Malformed or opaque origins must not reach authenticated writes.
  }
  if (!originHost || originHost !== request.headers.get("host")) {
    return new NextResponse("Invalid form origin.", { status: 403 });
  }

  // Use the browser's host so localhost and 127.0.0.1 retain their own cookies.
  const destination = new URL(request.url);
  destination.host = request.headers.get("host")!;
  const go = (pathname: string, error?: string) => {
    destination.pathname = pathname;
    destination.search = "";
    if (error) destination.searchParams.set("error", error);
    return NextResponse.redirect(destination, 303);
  };

  if (!configured()) return go("/setup");
  const { userId } = await auth();
  if (!userId) return go("/sign-in");

  try {
    const form = await request.formData();
    const text = (name: string) => String(form.get(name) ?? "");
    await createBusiness(userId, {
      name: text("name"),
      branchName: text("branchName"),
      country: text("country"),
      currency: text("currency"),
      timezone: text("timezone"),
      address: text("address"),
      email: text("email"),
      phone: text("phone"),
      taxId: text("taxId"),
      taxBps: Math.round(Number(text("taxRate")) * 100),
      turnaroundMinutes: Number(text("turnaroundMinutes")),
      invoicePrefix: text("invoicePrefix"),
      contractTerms: text("contractTerms"),
    });
  } catch (error) {
    return go("/onboarding", publicError(error));
  }

  // A document navigation avoids reusing an onboarding router snapshot after
  // the database commit. This also works before React has hydrated the form.
  return go("/dashboard");
}
