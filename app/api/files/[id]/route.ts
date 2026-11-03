import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";
import { serveScreenshot } from "@/lib/files";

export const runtime = "nodejs";

/** Always behind the session. Originals are only fetched when requested; see lib/files.ts for the query options. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  return serveScreenshot(req, (await params).id);
}
