import "server-only";
import { NextResponse } from "next/server";
import { q } from "./db";
import { driver, readLocal, signedUrl } from "./storage";

/**
 * GET …/files/:screenshotId            → original (inline)
 * GET …/files/:screenshotId?v=thumb    → 480px WEBP thumbnail
 * GET …/files/:screenshotId?dl=1       → original as download with its original filename
 * Callers authorise first. Only files that belong to an existing submission are served.
 */
export async function serveScreenshot(req: Request, id: string, extra: Record<string, string> = {}) {
  const notFound = () => new NextResponse("Not found", { status: 404, headers: extra });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();

  const [f] = await q<{ stored_filename: string; thumb_filename: string | null; mime_type: string; original_filename: string }>(
    `SELECT u.stored_filename, u.thumb_filename, u.mime_type, u.original_filename
       FROM uploaded_screenshots u JOIN survey_submissions s ON s.id = u.submission_id
      WHERE u.id = $1`, [id]);
  if (!f) return notFound();

  const sp = new URL(req.url).searchParams;
  const thumb = sp.get("v") === "thumb" && f.thumb_filename;
  const download = sp.get("dl") === "1";
  const key = thumb ? f.thumb_filename! : f.stored_filename;
  const mime = thumb ? "image/webp" : f.mime_type;

  if (driver === "s3") {
    const url = await signedUrl(key, download ? f.original_filename : undefined);
    const res = NextResponse.redirect(url, 302);
    for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
    return res;
  }
  try {
    const buf = await readLocal(key);
    const name = encodeURIComponent(f.original_filename);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(download ? { "Content-Disposition": `attachment; filename*=UTF-8''${name}` } : {}),
        ...extra,
      },
    });
  } catch {
    return new NextResponse("File missing from storage", { status: 410, headers: extra });
  }
}
