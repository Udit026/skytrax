import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { q } from "./db";
import { SESSION_COOKIE, verifySession, type Session, type Role } from "./session";

/** Verifies the JWT AND that the admin still exists (deleted admins lose access immediately). */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = await verifySession(token);
  if (!s) return null;
  // Role comes from the DB, never from the token, so a role change/removal applies immediately.
  const rows = await q<{ id: string; name: string; email: string; role: Role }>(
    "SELECT id, name, email, role FROM admins WHERE id = $1",
    [s.sub],
  );
  if (!rows[0]) return null;
  return { sub: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role === "admin" ? "admin" : "viewer" };
}

/** Any signed-in user (admin or client viewer). */
export async function requireUserPage(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Admin-only pages: viewers are sent back to the overview. */
export async function requireAdminPage(): Promise<Session> {
  const s = await requireUserPage();
  if (s.role !== "admin") redirect("/");
  return s;
}

/** READ endpoints: any signed-in user (admin or viewer). Returns session or a 401 response. */
export async function requireUserApi(): Promise<Session | NextResponse> {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

/** WRITE / management endpoints: admins only. 401 if signed out, 403 for viewers. */
export async function requireAdminApi(): Promise<Session | NextResponse> {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  if (s.role !== "admin") return NextResponse.json({ error: "Read-only account: you do not have permission to do this." }, { status: 403 });
  return s;
}

/** Basic CSRF guard for state-changing API calls: Origin must match Host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl) – still need the session cookie
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
