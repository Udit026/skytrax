import { CLIENT_HEADERS, notAllowed, rateLimit } from "@/lib/client-api";
import { csvResponse } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV of every row matching the filters. No admin remarks column; screenshot links point at the public files route. */
export async function GET(req: Request) {
  const limited = rateLimit(req, "heavy");
  if (limited) return limited;
  return csvResponse(req, { adminRemarks: false, filesBase: "/api/client", headers: CLIENT_HEADERS });
}
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
