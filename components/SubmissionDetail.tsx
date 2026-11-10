"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle, Download, Trash2, Loader2, RotateCcw, Save, Maximize2, Archive } from "lucide-react";
import Lightbox, { type Shot } from "./Lightbox";
import ConfirmDialog from "./ConfirmDialog";
import { fmtBytes, fmtDateTime } from "@/lib/format";

export function Gallery({ shots, title, apiBase = "/api", hideDownloads = false }: { shots: (Shot & { mime_type: string; uploaded_at: string })[]; title: string; apiBase?: string; hideDownloads?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {shots.map((s, i) => (
          <figure key={s.id} className="rounded-xl border border-line overflow-hidden bg-white">
            <button onClick={() => setOpen(i)} className="group relative block w-full bg-[repeating-conic-gradient(#f3f5f8_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
              {/* thumbnail with natural aspect ratio, no cropping */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${apiBase}/files/${s.id}?v=thumb`} alt={s.original_filename} loading="lazy" className="mx-auto max-h-[360px] w-auto object-contain" />
              <span className="absolute inset-0 grid place-items-center bg-ink/0 group-hover:bg-ink/40 transition">
                <span className="opacity-0 group-hover:opacity-100 btn bg-white text-ink"><Maximize2 className="size-4" /> View full size</span>
              </span>
            </button>
            <figcaption className="p-3 border-t border-line flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" title={s.original_filename}>{s.original_filename}</div>
                <div className="text-xs text-muted">{fmtBytes(s.file_size)} · {s.mime_type.replace("image/", "").toUpperCase()}{s.width ? ` · ${s.width}×${s.height}` : ""} · {fmtDateTime(s.uploaded_at)}</div>
              </div>
              {/* CLIENT-HIDE: restore by removing hideDownloads / hideSubmissionDate */}
              {!hideDownloads && <a href={`${apiBase}/files/${s.id}?dl=1`} className="btn-ghost h-8 px-2.5" title="Download original"><Download className="size-4" /></a>}
            </figcaption>
          </figure>
        ))}
      </div>
      {open !== null && <Lightbox shots={shots} index={open} title={title} apiBase={apiBase} hideDownloads={hideDownloads} onClose={() => setOpen(null)} />}
    </>
  );
}

export function ReviewPanel({ id, submissionId, status, adminRemarks, firstShotId, shotCount }: {
  id: string; submissionId: string; status: string; adminRemarks: string | null; firstShotId: string | null; shotCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [remarks, setRemarks] = useState(adminRemarks ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label); setMsg(null);
    const r = await fetch(`/api/submissions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: "Update failed. Please retry." }); return; }
    setMsg({ ok: true, text: label === "remarks" ? "Remarks saved." : "Status updated." });
    router.refresh();
  }

  async function del() {
    setBusy("delete");
    const r = await fetch(`/api/submissions/${id}`, { method: "DELETE" });
    if (!r.ok) { setBusy(null); setConfirm(false); setMsg({ ok: false, text: "Delete failed." }); return; }
    router.replace("/submissions");
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="font-semibold">Review</div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-success" disabled={!!busy || status === "verified"} onClick={() => patch({ status: "verified", admin_remarks: remarks }, "verified")}>
          {busy === "verified" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
        </button>
        <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={!!busy || status === "rejected"} onClick={() => patch({ status: "rejected", admin_remarks: remarks }, "rejected")}>
          {busy === "rejected" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Reject
        </button>
      </div>
      {status !== "pending" && (
        <button className="btn-ghost w-full mt-2" disabled={!!busy} onClick={() => patch({ status: "pending" }, "pending")}>
          <RotateCcw className="size-4" /> Move back to pending
        </button>
      )}
      <div className="mt-5">
        <label className="label" htmlFor="ar">Admin remarks</label>
        <textarea id="ar" rows={4} maxLength={2000} className="input h-auto py-2 resize-y" placeholder="Reason for rejection, verification notes…" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <button className="btn-ghost mt-2" disabled={!!busy || remarks === (adminRemarks ?? "")} onClick={() => patch({ admin_remarks: remarks }, "remarks")}>
          {busy === "remarks" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save remarks
        </button>
      </div>
      {msg && <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}
      <div className="mt-5 pt-5 border-t border-line grid gap-2">
        {firstShotId && (
          <a href={`/api/files/${firstShotId}?dl=1`} className="btn-primary"><Download className="size-4" /> Download screenshot{shotCount > 1 ? " (first)" : ""}</a>
        )}
        {shotCount > 1 && <a href={`/api/submissions/${id}/download`} className="btn-ghost"><Archive className="size-4" /> Download all {shotCount} (ZIP)</a>}
        <button className="btn-danger" onClick={() => setConfirm(true)} disabled={!!busy}><Trash2 className="size-4" /> Delete submission</button>
      </div>
      <ConfirmDialog open={confirm} busy={busy === "delete"} title="Delete this submission?"
        body={<>This permanently removes <b>{submissionId}</b> and its {shotCount} screenshot(s) from the database and storage. This cannot be undone.</>}
        onConfirm={del} onCancel={() => setConfirm(false)} />
    </div>
  );
}


/** Read-only side panel for client (viewer) accounts: downloads only. */
export function DownloadPanel({ id, firstShotId, shotCount, apiBase = "/api" }: { id: string; firstShotId: string | null; shotCount: number; apiBase?: string }) {
  return (
    <div className="card p-5">
      <div className="font-semibold">Download</div>
      <p className="mt-1 text-xs text-muted">Original, full-resolution screenshots.</p>
      <div className="mt-4 grid gap-2">
        {firstShotId && (
          <a href={`${apiBase}/files/${firstShotId}?dl=1`} className="btn-primary"><Download className="size-4" /> Download screenshot{shotCount > 1 ? " (first)" : ""}</a>
        )}
        {shotCount > 1 && (
          <a href={`${apiBase}/submissions/${id}/download`} className="btn-ghost"><Archive className="size-4" /> Download all {shotCount} (ZIP)</a>
        )}
      </div>
    </div>
  );
}
