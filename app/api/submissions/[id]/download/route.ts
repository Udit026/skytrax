import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";
import { zipResponse } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/submissions/:id/download → ZIP of every original screenshot of one submission (admin or viewer). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  return zipResponse((await params).id);
}
