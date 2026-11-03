import { NextResponse } from "next/server";
import { z } from "zod";
import { q, tx } from "@/lib/db";
import { requireAdminApi, requireUserApi, sameOrigin } from "@/lib/auth";
import { getSubmission } from "@/lib/submissions";
import { deleteObjects } from "@/lib/storage";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function GET(_req: Request, { params }: Ctx) {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  const sub = await getSubmission((await params).id);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Internal review notes and staff names are not shared with client (viewer) accounts.
  if (s.role !== "admin") return NextResponse.json({ ...sub, admin_remarks: null, created_by_name: null, reviewed_by_name: null });
  return NextResponse.json(sub);
}

const Patch = z.object({
  status: z.enum(["pending", "verified", "rejected"]).optional(),
  admin_remarks: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireAdminApi();
  if (s instanceof NextResponse) return s;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const id = (await params).id;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = Patch.safeParse(await req.json().catch(() => null));
  if (!body.success || (body.data.status === undefined && body.data.admin_remarks === undefined))
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.data.status !== undefined) {
    vals.push(body.data.status);
    sets.push(`status = $${vals.length}`);
    vals.push(s.sub);
    sets.push(`reviewed_by = $${vals.length}`, `reviewed_at = now()`);
  }
  if (body.data.admin_remarks !== undefined) {
    vals.push(body.data.admin_remarks || null);
    sets.push(`admin_remarks = $${vals.length}`);
  }
  vals.push(id);
  const rows = await q(`UPDATE survey_submissions SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING id, status`, vals);
  return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const s = await requireAdminApi();
  if (s instanceof NextResponse) return s;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const id = (await params).id;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const keys = await tx(async (c) => {
    const { rows } = await c.query<{ stored_filename: string; thumb_filename: string | null }>(
      "SELECT stored_filename, thumb_filename FROM uploaded_screenshots WHERE submission_id = $1", [id]);
    const del = await c.query("DELETE FROM survey_submissions WHERE id = $1", [id]);
    if (!del.rowCount) return null;
    return rows.flatMap((r) => [r.stored_filename, r.thumb_filename ?? ""]);
  });
  if (!keys) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteObjects(keys).catch((e) => console.error("Storage cleanup failed", e));
  return NextResponse.json({ ok: true });
}
