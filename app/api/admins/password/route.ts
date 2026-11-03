import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q } from "@/lib/db";
import { requireUserApi, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";
const Body = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string().min(10, "New password must be at least 10 characters").max(200),
});

export async function POST(req: Request) {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: b.error.issues[0].message }, { status: 400 });
  const [a] = await q<{ password_hash: string }>("SELECT password_hash FROM admins WHERE id = $1", [s.sub]);
  if (!a || !(await bcrypt.compare(b.data.current, a.password_hash)))
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  await q("UPDATE admins SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(b.data.next, 12), s.sub]);
  return NextResponse.json({ ok: true });
}
