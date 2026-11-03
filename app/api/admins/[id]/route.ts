import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAdminApi, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdminApi();
  if (s instanceof NextResponse) return s;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const id = (await params).id;
  if (id === s.sub) return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ n }] = await q<{ n: string }>("SELECT count(*) n FROM admins WHERE role = 'admin'");
  const [target] = await q<{ role: string }>("SELECT role FROM admins WHERE id = $1", [id]);
  if (target?.role === "admin" && +n <= 1) return NextResponse.json({ error: "At least one admin must remain." }, { status: 400 });
  const rows = await q("DELETE FROM admins WHERE id = $1 RETURNING id", [id]);
  return rows[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
