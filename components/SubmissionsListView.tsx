import Link from "next/link";
import { Inbox, SearchX, UploadCloud } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import SubmissionsTable from "@/components/SubmissionsTable";
import { listSubmissions, parseFilters } from "@/lib/submissions";

/** All-submissions body shared by the admin app (basePath "", apiBase "/api") and the public client view. */
export default async function SubmissionsListView({ searchParams, isAdmin, basePath = "", apiBase = "/api", hideDownloads = false, hideSubmissionDate = false, hideStatus = false }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>; isAdmin: boolean; basePath?: string; apiBase?: string;
  hideDownloads?: boolean; hideSubmissionDate?: boolean; // CLIENT-HIDE: restore by removing hideDownloads / hideSubmissionDate
  hideStatus?: boolean; // CLIENT-HIDE: restore by removing hideStatus
}) {
  const raw = await searchParams;
  const sp = new URLSearchParams();
  Object.entries(raw).forEach(([k, v]) => typeof v === "string" && sp.set(k, v));
  const f = parseFilters(sp);
  const data = await listSubmissions(f);
  const filtered = !!(f.search || f.status || f.from || f.to);

  return (
    <>
      <PageHeader title="All submissions" subtitle={isAdmin ? "Search, review and export survey submissions." : "Search and review survey submissions, view and download screenshots."}
        actions={isAdmin ? <Link href="/upload" className="btn-primary"><UploadCloud className="size-4" /> Upload submission</Link> : undefined} />
      <FilterBar total={data.total} apiBase={apiBase} hideDownloads={hideDownloads} hideStatus={hideStatus} />
      <div className="card mt-4 overflow-hidden">
        {data.rows.length === 0 ? (
          filtered
            ? <EmptyState icon={SearchX} title="No matching submissions" body="Try a different search term, status or date range." />
            : <EmptyState icon={Inbox} title="No submissions yet" body={isAdmin ? "Survey submissions you upload will appear here." : "Submissions will appear here as soon as the campaign team records them."}
                action={isAdmin ? <Link href="/upload" className="btn-primary"><UploadCloud className="size-4" /> Upload submission</Link> : undefined} />
        ) : (
          <>
            <SubmissionsTable rows={data.rows} offset={(data.page - 1) * data.pageSize} canEdit={isAdmin} basePath={basePath} apiBase={apiBase} hideDownloads={hideDownloads} hideSubmissionDate={hideSubmissionDate} hideStatus={hideStatus} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} />
          </>
        )}
      </div>
    </>
  );
}
