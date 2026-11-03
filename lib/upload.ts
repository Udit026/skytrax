import "server-only";
import crypto from "crypto";
import sharp from "sharp";

export const MAX_FILE_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
export const MAX_FILES = Number(process.env.MAX_FILES_PER_SUBMISSION ?? 10);

const ALLOWED: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": {
    ext: "png",
    magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/webp": {
    ext: "webp",
    magic: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
};

/** Detect type from the file's bytes — never trust the client-supplied MIME or extension. */
export function sniff(buf: Buffer): { mime: string; ext: string } | null {
  for (const [mime, v] of Object.entries(ALLOWED)) if (v.magic(buf)) return { mime, ext: v.ext };
  return null;
}

export function cleanOriginalName(name: string) {
  // keep it human-readable but strip paths / control chars
  return (name.split(/[\\/]/).pop() || "screenshot")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 200);
}

export function storageKeys(ext: string) {
  const d = new Date();
  const ym = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const id = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
  return { original: `originals/${ym}/${id}.${ext}`, thumb: `thumbs/${ym}/${id}.webp` };
}

/** Validates it decodes as a real image and builds a 480px WEBP thumbnail (aspect preserved). */
export async function processImage(buf: Buffer) {
  const img = sharp(buf, { failOn: "error", limitInputPixels: 100_000_000 });
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("File is not a readable image");
  const thumb = await sharp(buf)
    .rotate()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  return { width: meta.width, height: meta.height, thumb };
}
