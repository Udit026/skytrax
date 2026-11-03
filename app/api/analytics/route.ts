import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  const sp = new URL(req.url).searchParams;
  const d = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return NextResponse.json(await getAnalytics(d(sp.get("from")), d(sp.get("to"))));
}
