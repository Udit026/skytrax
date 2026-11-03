"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, X, CheckCircle2, AlertCircle, Loader2, ImagePlus, RotateCcw, ArrowRight } from "lucide-react";
import { fmtBytes } from "@/lib/format";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT = /\.(jpe?g|png|webp)$/i;
type Item = { key: string; file: File; url: string; error?: string };

export default function UploadForm({ maxMb, maxFiles }: { maxMb: number; maxFiles: number }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState<{ id: string; submission_id: string; screenshots: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list); // snapshot now: a FileList is live and empties when the input is reset
    setErrors((e) => ({ ...e, screenshots: "" }));
    setItems((cur) => {
      const next = [...cur];
      for (const f of incoming) {
        if (next.some((x) => x.file.name === f.name && x.file.size === f.size)) continue;
        let error: string | undefined;
        if (!TYPES.includes(f.type) && !EXT.test(f.name)) error = "Only JPG, PNG or WEBP";
        else if (f.size > maxMb * 1024 * 1024) error = `Exceeds ${maxMb} MB`;
        else if (f.size === 0) error = "Empty file";
        next.push({ key: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`, file: f, url: URL.createObjectURL(f), error });
      }
      return next;
    });
  }, [maxMb]);

  const remove = (key: string) => setItems((cur) => {
    const it = cur.find((x) => x.key === key);
    if (it) URL.revokeObjectURL(it.url);
    return cur.filter((x) => x.key !== key);
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email ID";
    const valid = items.filter((i) => !i.error);
    if (!valid.length) e.screenshots = "Attach at least one valid screenshot";
    else if (items.some((i) => i.error)) e.screenshots = "Remove the files marked in red before uploading";
    else if (valid.length > maxFiles) e.screenshots = `Maximum ${maxFiles} screenshots per submission`;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError("");
    if (!validate()) return;
    const fd = new FormData();
    fd.append("respondent_email", email.trim());
    if (name.trim()) fd.append("passenger_name", name.trim());
    if (remarks.trim()) fd.append("remarks", remarks.trim());
    items.forEach((i) => fd.append("screenshots", i.file, i.file.name));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/submissions");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      xhrRef.current = null;
      let j: { error?: string; field?: string; fileErrors?: { file: string; error: string }[]; id?: string; submission_id?: string; screenshots?: number } = {};
      try { j = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 201 && j.id) {
        setProgress(null);
        setDone({ id: j.id, submission_id: j.submission_id!, screenshots: j.screenshots! });
        return;
      }
      setProgress(null);
      if (xhr.status === 401) { setServerError("Your session has expired. Please sign in again."); return; }
      if (j.fileErrors) setItems((cur) => cur.map((it) => ({ ...it, error: j.fileErrors!.find((f) => f.file === it.file.name)?.error ?? it.error })));
      if (j.field === "respondent_email") setErrors({ email: j.error! });
      setServerError(j.error || `Upload failed (HTTP ${xhr.status}). Nothing was saved — please retry.`);
    };
    xhr.onerror = () => { xhrRef.current = null; setProgress(null); setServerError("Network error — the upload did not complete. Nothing was saved; please retry."); };
    xhr.onabort = () => { xhrRef.current = null; setProgress(null); setServerError("Upload cancelled. Nothing was saved."); };
    setProgress(0);
    xhr.send(fd);
  }

  function reset() {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]); setEmail(""); setName(""); setRemarks(""); setDone(null); setErrors({}); setServerError("");
  }

  if (done) {
    return (
      <div className="card p-10 text-center max-w-xl mx-auto">
        <div className="mx-auto grid place-items-center size-14 rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-7" /></div>
        <h2 className="mt-4 text-lg font-semibold">Submission recorded</h2>
        <p className="mt-1 text-sm text-muted"><span className="font-mono font-medium text-ink">{done.submission_id}</span> saved with {done.screenshots} screenshot{done.screenshots > 1 ? "s" : ""}. Status: pending review.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-ghost" onClick={reset}><RotateCcw className="size-4" /> Upload another</button>
          <Link href={`/submissions/${done.id}`} className="btn-primary">View submission <ArrowRight className="size-4" /></Link>
        </div>
      </div>
    );
  }

  const uploading = progress !== null;
  const totalSize = items.reduce((a, i) => a + i.file.size, 0);

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[380px_1fr] items-start" noValidate>
      <div className="card p-5 space-y-4">
        <div className="font-semibold">Respondent details</div>
        <div>
          <label className="label" htmlFor="email">Respondent email ID <span className="text-red-600">*</span></label>
          <input id="email" type="email" className={`input ${errors.email ? "border-red-400 focus:ring-red-100" : ""}`} placeholder="passenger@example.com"
            value={email} onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: "" })); }} disabled={uploading} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="name">Passenger name <span className="text-faint font-normal">(optional)</span></label>
          <input id="name" className="input" maxLength={150} value={name} onChange={(e) => setName(e.target.value)} disabled={uploading} />
        </div>
        <div>
          <label className="label" htmlFor="remarks">Remarks <span className="text-faint font-normal">(optional)</span></label>
          <textarea id="remarks" rows={4} maxLength={2000} className="input h-auto py-2 resize-y" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={uploading} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Survey screenshots <span className="text-red-600">*</span></div>
          {items.length > 0 && <div className="text-xs text-muted tnum">{items.length} file{items.length > 1 ? "s" : ""} · {fmtBytes(totalSize)}</div>}
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!uploading) addFiles(e.dataTransfer.files); }}
          onClick={() => !uploading && input.current?.click()}
          role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          className={`mt-4 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition ${
            drag ? "border-brand bg-brand-50" : errors.screenshots ? "border-red-300 bg-red-50/40" : "border-line hover:border-brand/50 hover:bg-page"}`}>
          <div className="mx-auto grid place-items-center size-12 rounded-full bg-brand-50 text-brand"><UploadCloud className="size-6" /></div>
          <div className="mt-3 text-sm"><span className="font-semibold text-brand">Click to choose</span> or drag & drop screenshots</div>
          <div className="mt-1 text-xs text-muted">JPG, JPEG, PNG or WEBP · up to {maxMb} MB each · max {maxFiles} files</div>
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {errors.screenshots && <p className="mt-2 text-xs text-red-600">{errors.screenshots}</p>}

        {items.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.key} className={`flex items-center gap-3 rounded-lg border p-2 ${it.error ? "border-red-200 bg-red-50/50" : "border-line"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {!it.error ? <img src={it.url} alt="" className="size-12 rounded-md object-contain bg-page border border-line" />
                  : <div className="grid place-items-center size-12 rounded-md bg-red-100 text-red-600"><AlertCircle className="size-5" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" title={it.file.name}>{it.file.name}</div>
                  <div className={`text-xs ${it.error ? "text-red-600" : "text-muted"}`}>{it.error ?? fmtBytes(it.file.size)}</div>
                </div>
                {!uploading && <button type="button" onClick={() => remove(it.key)} className="text-faint hover:text-ink p-1" aria-label={`Remove ${it.file.name}`}><X className="size-4" /></button>}
              </li>
            ))}
            {!uploading && (
              <li><button type="button" onClick={() => input.current?.click()} className="w-full h-full min-h-[66px] rounded-lg border border-dashed border-line text-sm text-muted hover:bg-page inline-flex items-center justify-center gap-2"><ImagePlus className="size-4" /> Add more</button></li>
            )}
          </ul>
        )}

        {uploading && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted mb-1.5">
              <span>{progress! < 100 ? "Uploading…" : "Processing & saving…"}</span><span className="tnum">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-page overflow-hidden"><div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {serverError && <div className="mt-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700 flex gap-2"><AlertCircle className="size-4 mt-0.5 shrink-0" />{serverError}</div>}

        <div className="mt-5 flex justify-end gap-2">
          {uploading && progress! < 100 && <button type="button" className="btn-ghost" onClick={() => xhrRef.current?.abort()}>Cancel</button>}
          <button className="btn-primary" disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Save submission
          </button>
        </div>
      </div>
    </form>
  );
}
