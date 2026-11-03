import { getSubmission } from "@/lib/submissions";
import { clientJson, notAllowed, rateLimit, toPublicSubmission } from "@/lib/client-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "api");
  if (limited) return limited;
  const sub = await getSubmission((await params).id);
  if (!sub) return clientJson({ error: "Not found" }, { status: 404 });
  return clientJson(toPublicSubmission(sub));
}
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
