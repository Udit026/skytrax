import { listSubmissions, parseFilters } from "@/lib/submissions";
import { clientJson, notAllowed, rateLimit } from "@/lib/client-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, read-only. Row fields are already free of admin data (see SubmissionRow).
export async function GET(req: Request) {
  const limited = rateLimit(req, "api");
  if (limited) return limited;
  return clientJson(await listSubmissions(parseFilters(new URL(req.url).searchParams)));
}
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
