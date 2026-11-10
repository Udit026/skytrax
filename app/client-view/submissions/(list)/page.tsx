import SubmissionsListView from "@/components/SubmissionsListView";
import { clientSlug } from "@/lib/client-slug";

export default function ClientSubmissions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // CLIENT-HIDE: restore by removing hideDownloads / hideSubmissionDate / hideStatus / hideDateTime
  return <SubmissionsListView searchParams={searchParams} isAdmin={false} basePath={`/${clientSlug()}`} apiBase="/api/client" hideDownloads hideSubmissionDate hideStatus hideDateTime />;
}
