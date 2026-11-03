// Edge-safe (used by middleware, server components and route handlers).
export const DEFAULT_CLIENT_SLUG = "delhiairportclient";

/** Paths the slug must never shadow. */
const RESERVED = new Set(["", "api", "login", "upload", "settings", "submissions", "analytics", "client-view", "_next", "favicon.ico", "robots.txt"]);

/** Public client-view slug from CLIENT_VIEW_SLUG; falls back to the default if unset or unusable. */
export function clientSlug(): string {
  const v = (process.env.CLIENT_VIEW_SLUG ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(v) || RESERVED.has(v.toLowerCase())) return DEFAULT_CLIENT_SLUG;
  return v;
}

/** Internal App Router folder the slug is rewritten to. Never reachable directly (middleware 404s it). */
export const CLIENT_INTERNAL_PREFIX = "/client-view";
