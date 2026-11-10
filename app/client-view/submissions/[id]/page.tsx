import { notFound } from "next/navigation";
import SubmissionDetailView from "@/components/SubmissionDetailView";
import { toPublicSubmission } from "@/lib/client-api";
import { clientSlug } from "@/lib/client-slug";
import { getSubmission } from "@/lib/submissions";

export default async function ClientSubmission({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSubmission((await params).id);
  if (!s) notFound();
  // Same allow-list as the public API: no admin remarks, staff names/ids or storage keys reach the page.
  // CLIENT-HIDE: restore by removing hideDownloads / hideStatus
  return <SubmissionDetailView s={toPublicSubmission(s)} isAdmin={false} basePath={`/${clientSlug()}`} apiBase="/api/client" hideDownloads hideStatus />;
}
