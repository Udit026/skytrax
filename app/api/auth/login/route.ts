import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { sameOrigin } from "@/lib/auth";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

// Simple in-memory brute-force guard: 8 failed attempts per IP+email per 15 min.
const attempts = new Map<string, { n: number; until: number }>();
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 12); // equalises timing for unknown emails

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  const { email, password } = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const k = `${ip}|${email}`;
  const a = attempts.get(k);
  if (a && a.n >= 8 && a.until > Date.now())
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });

  const [admin] = await q<{ id: string; name: string; email: string; password_hash: string; role: "admin" | "viewer" }>(
    "SELECT id, name, email, password_hash, role FROM admins WHERE lower(email) = $1",
    [email],
  );
  const ok = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_HASH);
  if (!admin || !ok) {
    attempts.set(k, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  attempts.delete(k);
  await q("UPDATE admins SET last_login_at = now() WHERE id = $1", [admin.id]);

  const token = await signSession({ sub: admin.id, email: admin.email, name: admin.name, role: admin.role });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
