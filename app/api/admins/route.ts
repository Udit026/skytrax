import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q } from "@/lib/db";
import { requireAdminApi, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const s = await requireAdminApi();
  if (s instanceof NextResponse) return s;
  return NextResponse.json(await q("SELECT id, name, email, role, created_at, last_login_at FROM admins ORDER BY created_at"));
}

const NewAdmin = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
  role: z.enum(["admin", "viewer"]).default("admin"),
});

export async function POST(req: Request) {
  const s = await requireAdminApi();
  if (s instanceof NextResponse) return s;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const b = NewAdmin.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: b.error.issues[0].message }, { status: 400 });
  const hash = await bcrypt.hash(b.data.password, 12);
  try {
    const [row] = await q("INSERT INTO admins (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, created_at",
      [b.data.name, b.data.email, hash, b.data.role]);
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    throw e;
  }
}
