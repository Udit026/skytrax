import "server-only";
import { NextResponse } from "next/server";
import type { Status, getSubmission } from "./submissions";

/** Headers for every /api/client/* response. */
export const CLIENT_HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export function clientJson(data: unknown, init: ResponseInit = {}) {
  const res = NextResponse.json(data, init);
  for (const [k, v] of Object.entries(CLIENT_HEADERS)) res.headers.set(k, v);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/** The public API is read-only: every non-GET method is refused. */
export function notAllowed() {
  const res = clientJson({ error: "Method not allowed" }, { status: 405 });
  res.headers.set("Allow", "GET, HEAD");
  return res;
}

// ── per-IP rate limiting (in-memory; per server instance) ─────────────
type Bucket = "api" | "files" | "heavy";
const LIMITS: Record<Bucket, number> = {
  api: Number(process.env.CLIENT_RATE_API ?? 120),      // list / detail / analytics, per minute
  files: Number(process.env.CLIENT_RATE_FILES ?? 600),  // thumbnails + originals: one list page loads up to 100 thumbs
  heavy: Number(process.env.CLIENT_RATE_HEAVY ?? 10),   // ZIP + CSV
};
const WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; reset: number }>();
let lastSweep = 0;

function ipOf(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0].trim() : req.headers.get("x-real-ip")) || "unknown";
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function rateLimit(req: Request, bucket: Bucket): NextResponse | null {
  const now = Date.now();
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now;
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }
  const key = `${bucket}:${ipOf(req)}`;
  let h = hits.get(key);
  if (!h || h.reset <= now) hits.set(key, (h = { n: 0, reset: now + WINDOW_MS }));
  if (++h.n <= LIMITS[bucket]) return null;
  const res = clientJson({ error: "Too many requests. Please slow down and retry shortly." }, { status: 429 });
  res.headers.set("Retry-After", String(Math.max(1, Math.ceil((h.reset - now) / 1000))));
  return res;
}

// ── response shaping ──────────────────────────────────────────────────
type FullSubmission = NonNullable<Awaited<ReturnType<typeof getSubmission>>>;

export type PublicSubmission = {
  id: string; submission_id: string; respondent_email: string; passenger_name: string | null;
  remarks: string | null; status: Status; created_at: string; reviewed_at: string | null;
  screenshots: { id: string; original_filename: string; file_size: number; mime_type: string;
    width: number | null; height: number | null; uploaded_at: string }[];
};

/** Explicit allow-list: admin remarks, staff names/ids and storage keys can never leak by adding a column. */
export function toPublicSubmission(s: FullSubmission): PublicSubmission {
  return {
    id: s.id, submission_id: s.submission_id, respondent_email: s.respondent_email, passenger_name: s.passenger_name,
    remarks: s.remarks, status: s.status, created_at: s.created_at, reviewed_at: s.reviewed_at,
    screenshots: s.screenshots.map((x) => ({
      id: x.id, original_filename: x.original_filename, file_size: x.file_size, mime_type: x.mime_type,
      width: x.width, height: x.height, uploaded_at: x.uploaded_at,
    })),
  };
}
