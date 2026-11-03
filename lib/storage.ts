import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Storage drivers
 *  - "s3":    any S3-compatible bucket — Supabase Storage (S3 protocol), Cloudflare R2, AWS S3,
 *             Hetzner Object Storage. Bucket should be PRIVATE; originals are served via
 *             short-lived presigned URLs only after the admin session is checked.
 *  - "local": writes to STORAGE_LOCAL_DIR on the server's disk. Real uploads, suitable for a
 *             single VPS deployment (not for serverless/Vercel, whose disk is ephemeral).
 */
export type Driver = "s3" | "local";
export const driver: Driver = (process.env.STORAGE_DRIVER as Driver) || "local";

let _s3: S3Client | null = null;
function s3() {
  if (_s3) return _s3;
  const need = ["S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Storage misconfigured, missing: ${missing.join(", ")}`);
  _s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true, // required by Supabase Storage & most S3-compatibles
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return _s3;
}
const bucket = () => process.env.S3_BUCKET!;
const localRoot = () => path.resolve(process.env.STORAGE_LOCAL_DIR || "./storage");

function safeLocalPath(key: string) {
  const p = path.resolve(localRoot(), key);
  if (!p.startsWith(localRoot() + path.sep)) throw new Error("Invalid storage key");
  return p;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (driver === "s3") {
    await s3().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
    );
    return;
  }
  const p = safeLocalPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

export async function deleteObjects(keys: string[]) {
  const ks = keys.filter(Boolean);
  if (!ks.length) return;
  if (driver === "s3") {
    for (let i = 0; i < ks.length; i += 1000) {
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: ks.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
    return;
  }
  await Promise.all(ks.map((k) => fs.rm(safeLocalPath(k), { force: true })));
}

/** S3 only: presigned GET URL (5 min). */
export async function signedUrl(key: string, downloadName?: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: downloadName
        ? `attachment; filename="${downloadName.replace(/"/g, "")}"`
        : undefined,
    }),
    { expiresIn: 300 },
  );
}

/** Read an object's bytes from whichever driver is active (used to attach screenshots to emails). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  if (driver === "s3") {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty object body");
    return Buffer.from(bytes);
  }
  return readLocal(key);
}

/** Local only: read the file. */
export async function readLocal(key: string) {
  return fs.readFile(safeLocalPath(key));
}
