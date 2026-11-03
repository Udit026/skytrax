// Edge-safe session helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sky_session";
const MAX_AGE_HOURS = Number(process.env.SESSION_HOURS ?? 12);

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (min 32 chars).");
  return new TextEncoder().encode(s);
}

export type Role = "admin" | "viewer";
export type Session = { sub: string; email: string; name: string; role: Role };

export async function signSession(s: Session) {
  return new SignJWT({ email: s.email, name: s.name, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_HOURS}h`)
    .sign(key());
}

export async function verifySession(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    // Fail safe: anything that is not exactly "admin" is treated as the read-only role.
    return { sub: String(payload.sub), email: String(payload.email), name: String(payload.name), role: payload.role === "admin" ? "admin" : "viewer" };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_HOURS * 3600,
};
