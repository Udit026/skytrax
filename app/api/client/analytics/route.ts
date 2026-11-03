import { getAnalytics } from "@/lib/analytics";
import { clientJson, notAllowed, rateLimit } from "@/lib/client-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "api");
  if (limited) return limited;
  const sp = new URL(req.url).searchParams;
  const d = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return clientJson(await getAnalytics(d(sp.get("from")), d(sp.get("to"))));
}
export { notAllowed as POST, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
