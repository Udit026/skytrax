import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";
import { csvResponse } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams every row matching the current filters as an Excel-compatible UTF-8 CSV, in keyset batches. */
export async function GET(req: Request) {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  return csvResponse(req, { adminRemarks: true, filesBase: "/api" });
}
