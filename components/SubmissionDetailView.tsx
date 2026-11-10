import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { Gallery, ReviewPanel, DownloadPanel } from "@/components/SubmissionDetail";
import type { Shot } from "@/components/Lightbox";
import { fmtDateTime } from "@/lib/format";

/** Fields the page needs. The public client view passes an allow-listed object without the optional admin fields. */
export type DetailData = {
  id: string; submission_id: string; respondent_email: string; passenger_name: string | null;
  remarks: string | null; status: string; created_at: string; reviewed_at: string | null;
  admin_remarks?: string | null; created_by_name?: string | null; reviewed_by_name?: string | null;
  screenshots: (Shot & { mime_type: string; uploaded_at: string })[];
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="py-3 grid grid-cols-[150px_1fr] gap-4 border-b border-line last:border-0">
    <dt className="text-sm text-muted">{label}</dt><dd className="text-sm font-medium break-words">{children}</dd>
  </div>
);

/** Submission detail body shared by the admin app (basePath "", apiBase "/api") and the public client view. */
export default function SubmissionDetailView({ s, isAdmin, basePath = "", apiBase = "/api", hideDownloads = false, hideStatus = false }: {
  s: DetailData; isAdmin: boolean; basePath?: string; apiBase?: string;
  hideDownloads?: boolean; // CLIENT-HIDE: restore by removing hideDownloads / hideSubmissionDate
  hideStatus?: boolean; // CLIENT-HIDE: restore by removing hideStatus
}) {
  return (
    <>
      <Link href={`${basePath}/submissions`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> All submissions</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight font-mono">{s.submission_id}</h1>
        {/* CLIENT-HIDE: restore by removing hideStatus */}
        {!hideStatus && <StatusBadge status={s.status} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
        <div className="space-y-4">
          <div className="card px-5 py-2">
            <dl>
              <Field label="Submission ID"><span className="font-mono">{s.submission_id}</span></Field>
              <Field label="Email ID"><a href={`mailto:${s.respondent_email}`} className="text-brand hover:underline">{s.respondent_email}</a></Field>
              <Field label="Passenger name">{s.passenger_name || <span className="text-faint font-normal">Not provided</span>}</Field>
              <Field label="Submitted">{fmtDateTime(s.created_at)}{isAdmin && s.created_by_name && <span className="text-muted font-normal"> · by {s.created_by_name}</span>}</Field>
              <Field label="Upload remarks">{s.remarks || <span className="text-faint font-normal">—</span>}</Field>
              {/* CLIENT-HIDE: restore by removing hideStatus (status badge + reviewed_at) */}
              {!hideStatus && (
              <Field label="Verification">
                <StatusBadge status={s.status} />
                {s.reviewed_at && <span className="ml-2 text-muted font-normal">{fmtDateTime(s.reviewed_at)}{isAdmin && s.reviewed_by_name ? ` · ${s.reviewed_by_name}` : ""}</span>}
              </Field>
              )}
              {isAdmin && <Field label="Admin remarks">{s.admin_remarks || <span className="text-faint font-normal">—</span>}</Field>}
              <Field label="Original filename(s)">
                {s.screenshots.map((x) => <div key={x.id} className="font-normal">{x.original_filename}</div>)}
              </Field>
            </dl>
          </div>
          <div className="card p-5">
            <div className="mb-4 font-semibold">Screenshots <span className="text-muted font-normal">({s.screenshots.length})</span></div>
            <Gallery shots={s.screenshots} title={`${s.submission_id} · ${s.respondent_email}`} apiBase={apiBase} hideDownloads={hideDownloads} />
          </div>
        </div>
        <div className="lg:sticky lg:top-6">
          {isAdmin ? (
            <ReviewPanel id={s.id} submissionId={s.submission_id} status={s.status} adminRemarks={s.admin_remarks ?? null}
              firstShotId={s.screenshots[0]?.id ?? null} shotCount={s.screenshots.length} />
          ) : (
            /* CLIENT-HIDE: restore by removing hideDownloads / hideSubmissionDate */
            !hideDownloads && <DownloadPanel id={s.id} firstShotId={s.screenshots[0]?.id ?? null} shotCount={s.screenshots.length} apiBase={apiBase} />
          )}
        </div>
      </div>
    </>
  );
}
