import { CLIENT_HEADERS, notAllowed, rateLimit } from "@/lib/client-api";
import { serveScreenshot } from "@/lib/files";

export const runtime = "nodejs";

/** Public thumbnail / original / ?dl=1 download, only for screenshots that belong to an existing submission. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "files");
  if (limited) return limited;
  return serveScreenshot(req, (await params).id, CLIENT_HEADERS);
}
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
