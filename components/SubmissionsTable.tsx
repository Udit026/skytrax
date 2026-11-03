"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Trash2, ImageOff, Loader2, Maximize2 } from "lucide-react";
import Lightbox, { type Shot } from "./Lightbox";
import ConfirmDialog from "./ConfirmDialog";
import { StatusBadge } from "./ui";
import { fmtBytes, fmtDate, fmtTime } from "@/lib/format";

export type Row = {
  id: string; submission_id: string; respondent_email: string; passenger_name: string | null; status: string;
  created_at: string; screenshot_count: number; first_shot_id: string | null; first_shot_name: string | null;
  first_shot_size: number | null; total_size: number | null;
};

function Thumb({ id, name, apiBase }: { id: string; name: string; apiBase: string }) {
  const [err, setErr] = useState(false);
  if (err) return <div className="grid place-items-center size-12 rounded-md bg-page text-faint"><ImageOff className="size-4" /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${apiBase}/files/${id}?v=thumb`} alt={name} loading="lazy" decoding="async" onError={() => setErr(true)}
    className="size-12 rounded-md object-cover border border-line bg-page" />;
}

export default function SubmissionsTable({ rows, offset, canEdit = false, basePath = "", apiBase = "/api" }: { rows: Row[]; offset: number; canEdit?: boolean; basePath?: string; apiBase?: string }) {
  const router = useRouter();
  const [viewer, setViewer] = useState<{ shots: Shot[]; title: string } | null>(null);
  const [loadingView, setLoadingView] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function openViewer(r: Row) {
    setLoadingView(r.id);
    try {
      const res = await fetch(`${apiBase}/submissions/${r.id}`);
      if (!res.ok) throw new Error();
      const j = await res.json();
      setViewer({ shots: j.screenshots, title: `${j.submission_id} · ${j.respondent_email}` });
    } catch {
      setError("Could not load screenshots for this submission.");
    } finally {
      setLoadingView(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/submissions/${toDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { setError("Delete failed. Please try again."); return; }
    setToDelete(null);
    router.refresh();
  }

  return (
    <>
      {error && <div className="mx-4 mt-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700 flex justify-between">{error}<button onClick={() => setError("")}>✕</button></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px]">
          <thead>
            <tr>
              <th className="th w-12">#</th><th className="th">Email ID</th><th className="th">Passenger name</th>
              <th className="th">Screenshot</th><th className="th">Original filename</th><th className="th">File size</th>
              <th className="th">Submission date</th><th className="th">Status</th><th className="th text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-[#fafbfd] group">
                <td className="td text-faint tnum">{offset + i + 1}</td>
                <td className="td">
                  <Link href={`${basePath}/submissions/${r.id}`} className="font-medium hover:text-brand">{r.respondent_email}</Link>
                  <div className="font-mono text-[11px] text-faint">{r.submission_id}</div>
                </td>
                <td className="td text-muted">{r.passenger_name || <span className="text-faint">—</span>}</td>
                <td className="td">
                  {r.first_shot_id ? (
                    <button onClick={() => openViewer(r)} className="relative block group/t" title="View screenshot">
                      <Thumb id={r.first_shot_id} name={r.first_shot_name ?? ""} apiBase={apiBase} />
                      <span className="absolute inset-0 grid place-items-center rounded-md bg-ink/50 text-white opacity-0 group-hover/t:opacity-100 transition">
                        {loadingView === r.id ? <Loader2 className="size-4 animate-spin" /> : <Maximize2 className="size-4" />}
                      </span>
                      {r.screenshot_count > 1 && <span className="absolute -top-1.5 -right-1.5 rounded-full bg-brand text-white text-[10px] font-semibold px-1.5 py-px ring-2 ring-white">+{r.screenshot_count - 1}</span>}
                    </button>
                  ) : <span className="text-faint text-xs">None</span>}
                </td>
                <td className="td max-w-[220px]">
                  <div className="truncate text-muted" title={r.first_shot_name ?? ""}>{r.first_shot_name ?? "—"}</div>
                  {r.screenshot_count > 1 && <div className="text-[11px] text-faint">and {r.screenshot_count - 1} more</div>}
                </td>
                <td className="td text-muted tnum whitespace-nowrap">
                  {fmtBytes(r.first_shot_size)}
                  {r.screenshot_count > 1 && <div className="text-[11px] text-faint">{fmtBytes(r.total_size)} total</div>}
                </td>
                <td className="td whitespace-nowrap"><div>{fmtDate(r.created_at)}</div><div className="text-xs text-faint">{fmtTime(r.created_at)}</div></td>
                <td className="td"><StatusBadge status={r.status} /></td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    <Link href={`${basePath}/submissions/${r.id}`} className="btn-ghost h-8 px-2.5 text-xs"><Eye className="size-3.5" /> View</Link>
                    {canEdit && <button onClick={() => setToDelete(r)} className="btn-danger h-8 px-2.5" aria-label="Delete"><Trash2 className="size-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewer && <Lightbox shots={viewer.shots} index={0} title={viewer.title} apiBase={apiBase} onClose={() => setViewer(null)} />}
      <ConfirmDialog open={!!toDelete} busy={deleting} title="Delete this submission?"
        body={<>This permanently removes <b>{toDelete?.submission_id}</b> ({toDelete?.respondent_email}) and its {toDelete?.screenshot_count} screenshot(s) from the database and storage. This cannot be undone.</>}
        onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </>
  );
}
