import "server-only";
import { NextResponse } from "next/server";
import { Zip, ZipPassThrough } from "fflate";
import { q } from "./db";
import { getObjectBuffer } from "./storage";

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 150) || "screenshot";

/** ZIP of every original screenshot of one submission, streamed one file at a time. Callers authorise first. */
export async function zipResponse(id: string, headers: Record<string, string> = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404, headers });

  const [sub] = await q<{ submission_id: string }>("SELECT submission_id FROM survey_submissions WHERE id = $1", [id]);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const shots = await q<{ stored_filename: string; original_filename: string }>(
    "SELECT stored_filename, original_filename FROM uploaded_screenshots WHERE submission_id = $1 ORDER BY uploaded_at, id", [id]);
  if (!shots.length) return NextResponse.json({ error: "No screenshots" }, { status: 404, headers });

  // Images are already compressed → store without re-compressing. Files are added one at a time
  // so only one screenshot is held in memory at once.
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return ctrl.error(err);
        ctrl.enqueue(chunk);
        if (final) ctrl.close();
      });
      try {
        for (const [i, f] of shots.entries()) {
          const buf = await getObjectBuffer(f.stored_filename);
          const entry = new ZipPassThrough(`${sub.submission_id}/${String(i + 1).padStart(2, "0")}-${safeName(f.original_filename)}`);
          zip.add(entry);
          entry.push(new Uint8Array(buf), true);
        }
        zip.end();
      } catch (e) {
        console.error("ZIP download failed", e);
        ctrl.error(e);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${sub.submission_id}-screenshots.zip"`,
      "Cache-Control": "private, no-store",
      ...headers,
    },
  });
}
