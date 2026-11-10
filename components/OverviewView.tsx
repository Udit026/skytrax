import Link from "next/link";
import { Inbox, Mail, Images, CalendarCheck, CalendarRange, Clock, UploadCloud, ArrowRight } from "lucide-react";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "@/components/ui";
import { TrendArea, StatusDonut, COLORS } from "@/components/charts";
import { getOverviewStats, listSubmissions } from "@/lib/submissions";
import { getAnalytics } from "@/lib/analytics";
import { fmtDateTime, fmtNum, timeAgo } from "@/lib/format";

/** Overview body shared by the admin app (basePath "") and the public client view (basePath "/<slug>"). */
export default async function OverviewView({ isAdmin, basePath = "", hideSubmissionDate = false, hideStatus = false, hideAnalytics = false, hideChart = false }: {
  isAdmin: boolean; basePath?: string;
  hideChart?: boolean; // CLIENT-HIDE: restore by removing hideChart
  hideSubmissionDate?: boolean; // CLIENT-HIDE: restore by removing hideSubmissionDate
  hideStatus?: boolean; // CLIENT-HIDE: restore by removing hideStatus
  hideAnalytics?: boolean; // CLIENT-HIDE: restore by removing hideAnalytics
}) {
  const [stats, recent, analytics] = await Promise.all([
    getOverviewStats(),
    listSubmissions({ page: 1, pageSize: 8, sort: "desc" }),
    getAnalytics(),
  ]);
  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  return (
    <>
      <PageHeader
        title="Campaign overview"
        subtitle="Skytrax passenger survey · Indira Gandhi International Airport, New Delhi"
        actions={isAdmin ? <Link href="/upload" className="btn-primary"><UploadCloud className="size-4" /> Upload submission</Link> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total submissions" value={fmtNum(stats.total)} icon={Inbox} hint={hideStatus ? undefined /* CLIENT-HIDE: restore by removing hideStatus */ : `${fmtNum(stats.pending)} awaiting review`} />
        <StatCard label="Unique email IDs" value={fmtNum(stats.uniqueEmails)} icon={Mail} tone="violet"
          hint={stats.total ? `${fmtNum(stats.total - stats.uniqueEmails)} repeat submissions` : "—"} />
        <StatCard label="Screenshots uploaded" value={fmtNum(stats.screenshots)} icon={Images} tone="sky" />
        <StatCard label="Today" value={fmtNum(stats.today)} icon={CalendarCheck} tone="emerald" hint="Since midnight IST" />
        <StatCard label="This month" value={fmtNum(stats.month)} icon={CalendarRange} tone="amber" />
        <StatCard label="Last submission" icon={Clock} tone="slate"
          value={<span className="text-lg">{stats.lastAt ? timeAgo(stats.lastAt) : "—"}</span>}
          hint={stats.lastAt ? fmtDateTime(stats.lastAt) : "No submissions yet"} />
      </div>

      {/* CLIENT-HIDE: restore by removing hideChart (the whole chart/status row is skipped when both are hidden, so no empty grid or extra gap is left) */}
      {!(hideChart && hideStatus) && (
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* CLIENT-HIDE: restore by removing hideChart */}
        {!hideChart && (
        <div className={`card p-5 ${hideStatus ? "lg:col-span-3" : "lg:col-span-2"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Submissions · last 30 days</div>
              <div className="text-xs text-muted">{fmtNum(analytics.totals.total)} in this period</div>
            </div>
            {/* CLIENT-HIDE: restore by removing hideAnalytics */}
            {!hideAnalytics && <Link href={`${basePath}/analytics`} className="text-sm text-brand font-medium inline-flex items-center gap-1 hover:underline">Analytics <ArrowRight className="size-3.5" /></Link>}
          </div>
          <div className="mt-4"><TrendArea data={analytics.daily} /></div>
        </div>
        )}
        {/* CLIENT-HIDE: restore by removing hideStatus */}
        {!hideStatus && (
        <div className="card p-5">
          <div className="font-semibold">Verification status</div>
          <div className="text-xs text-muted">All-time</div>
          <StatusDonut verified={stats.verified} pending={stats.pending} rejected={stats.rejected} />
          <div className="mt-2 space-y-2">
            {([["Verified", stats.verified, COLORS.verified], ["Pending", stats.pending, COLORS.pending], ["Rejected", stats.rejected, COLORS.rejected]] as const).map(([l, n, c]) => (
              <div key={l} className="flex items-center gap-3 text-sm">
                <span className="size-2 rounded-full" style={{ background: c }} />
                <span className="flex-1 text-muted">{l}</span>
                <span className="font-medium tnum">{fmtNum(n)}</span>
                <span className="w-10 text-right text-xs text-faint tnum">{pct(n)}%</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
      )}

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="font-semibold">Latest submissions</div>
          <Link href={`${basePath}/submissions`} className="text-sm text-brand font-medium inline-flex items-center gap-1 hover:underline">View all <ArrowRight className="size-3.5" /></Link>
        </div>
        {recent.rows.length === 0 ? (
          <EmptyState icon={Inbox} title="No submissions yet"
            body={isAdmin ? "Upload the first survey submission to start tracking the campaign." : "Submissions will appear here as soon as the campaign team records them."}
            action={isAdmin ? <Link href="/upload" className="btn-primary"><UploadCloud className="size-4" /> Upload submission</Link> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">ID</th><th className="th">Email ID</th><th className="th">Passenger</th><th className="th">Screenshots</th>{/* CLIENT-HIDE: restore by removing hideSubmissionDate / hideStatus */}{!hideSubmissionDate && <th className="th">Submitted</th>}{!hideStatus && <th className="th">Status</th>}</tr></thead>
              <tbody>
                {recent.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#fafbfd]">
                    <td className="td"><Link href={`${basePath}/submissions/${r.id}`} className="font-mono text-xs text-brand hover:underline">{r.submission_id}</Link></td>
                    <td className="td font-medium">{r.respondent_email}</td>
                    <td className="td text-muted">{r.passenger_name || "—"}</td>
                    <td className="td tnum">{r.screenshot_count}</td>
                    {/* CLIENT-HIDE: restore by removing hideSubmissionDate / hideStatus */}
                    {!hideSubmissionDate && <td className="td text-muted whitespace-nowrap">{fmtDateTime(r.created_at)}</td>}
                    {!hideStatus && <td className="td"><StatusBadge status={r.status} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
