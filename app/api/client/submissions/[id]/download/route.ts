import { CLIENT_HEADERS, notAllowed, rateLimit } from "@/lib/client-api";
import { zipResponse } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/client/submissions/:id/download → ZIP of every original screenshot of one submission. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "heavy");
  if (limited) return limited;
  return zipResponse((await params).id, CLIENT_HEADERS);
}
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
