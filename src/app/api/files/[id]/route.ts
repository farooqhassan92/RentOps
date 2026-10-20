import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { privateFile } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = await requireBusiness(); const { id } = await params;
  const file = await db.attachment.findFirst({ where: { id, businessId: b.id } });
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(/* turbopackIgnore: true */ privateFile(file.storageKey));
    return new Response(data, { headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("File unavailable", { status: 404 }); }
}
