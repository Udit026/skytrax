import { NextResponse } from "next/server";
import { z } from "zod";
import { tx } from "@/lib/db";
import { requireAdminApi, requireUserApi, sameOrigin } from "@/lib/auth";
import { listSubmissions, parseFilters } from "@/lib/submissions";
import { putObject, deleteObjects } from "@/lib/storage";
import { MAX_FILE_MB, MAX_FILES, cleanOriginalName, processImage, sniff, storageKeys } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await requireUserApi();
  if (s instanceof NextResponse) return s;
  return NextResponse.json(await listSubmissions(parseFilters(new URL(req.url).searchParams)));
}

const Fields = z.object({
  respondent_email: z.string().trim().toLowerCase().email("Enter a valid email ID").max(254),
  passenger_name: z.string().trim().max(150).optional().transform((v) => v || null),
  remarks: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export async function POST(req: Request) {
  const s = await requireAdminApi();
  if (s instanceof NextResponse) return s;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload was interrupted or malformed. Please retry." }, { status: 400 });
  }

  const fields = Fields.safeParse({
    respondent_email: form.get("respondent_email") ?? "",
    passenger_name: form.get("passenger_name") ?? undefined,
    remarks: form.get("remarks") ?? undefined,
  });
  if (!fields.success)
    return NextResponse.json({ error: fields.error.issues[0].message, field: fields.error.issues[0].path[0] }, { status: 400 });

  const files = form.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Attach at least one screenshot.", field: "screenshots" }, { status: 400 });
  if (files.length > MAX_FILES)
    return NextResponse.json({ error: `Maximum ${MAX_FILES} screenshots per submission.` }, { status: 400 });

  // 1) Validate + process every file before touching storage/DB
  const prepared: {
    original: string; key: string; thumbKey: string; mime: string; size: number;
    buf: Buffer; thumb: Buffer; width: number; height: number;
  }[] = [];
  const fileErrors: { file: string; error: string }[] = [];

  for (const f of files) {
    const name = cleanOriginalName(f.name);
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      fileErrors.push({ file: name, error: `Larger than ${MAX_FILE_MB} MB` });
      continue;
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const type = sniff(buf);
    if (!type) {
      fileErrors.push({ file: name, error: "Not a JPG, PNG or WEBP image" });
      continue;
    }
    try {
      const img = await processImage(buf);
      const keys = storageKeys(type.ext);
      prepared.push({
        original: name, key: keys.original, thumbKey: keys.thumb, mime: type.mime,
        size: buf.length, buf, thumb: img.thumb, width: img.width, height: img.height,
      });
    } catch {
      fileErrors.push({ file: name, error: "Image is corrupted or unreadable" });
    }
  }
  if (fileErrors.length)
    return NextResponse.json({ error: "Some files were rejected. Nothing was saved.", fileErrors }, { status: 422 });

  // 2) Upload to storage, then 3) write DB in a transaction; clean up storage on any failure
  const written: string[] = [];
  try {
    for (const p of prepared) {
      await putObject(p.key, p.buf, p.mime);
      written.push(p.key);
      await putObject(p.thumbKey, p.thumb, "image/webp");
      written.push(p.thumbKey);
    }
    const sub = await tx(async (c) => {
      const { rows } = await c.query<{ id: string; submission_id: string }>(
        `INSERT INTO survey_submissions (respondent_email, passenger_name, remarks, screenshot_count, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, submission_id`,
        [fields.data.respondent_email, fields.data.passenger_name, fields.data.remarks, prepared.length, s.sub],
      );
      for (const p of prepared) {
        const { rows: shot } = await c.query<{ id: string }>(
          `INSERT INTO uploaded_screenshots
             (submission_id, original_filename, stored_filename, thumb_filename, file_url, file_size, mime_type, width, height, uploaded_at)
           VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8, clock_timestamp()) RETURNING id`,
          [rows[0].id, p.original, p.key, p.thumbKey, p.size, p.mime, p.width, p.height],
        );
        await c.query(`UPDATE uploaded_screenshots SET file_url = $1 WHERE id = $2`, [`/api/files/${shot[0].id}`, shot[0].id]);
      }
      return rows[0];
    });
    return NextResponse.json({ ok: true, id: sub.id, submission_id: sub.submission_id, screenshots: prepared.length }, { status: 201 });
  } catch (e) {
    console.error("Upload failed", e);
    await deleteObjects(written).catch(() => {});
    const msg = e instanceof Error && e.message.startsWith("Storage misconfigured") ? e.message : "Upload failed on the server. Nothing was saved — please retry.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
