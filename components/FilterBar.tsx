"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X, Download, Loader2, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";

export default function FilterBar({ total, apiBase = "/api" }: { total: number; apiBase?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [text, setText] = useState(sp.get("q") ?? "");

  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    if (!("page" in patch)) n.delete("page");
    start(() => router.push(`${path}?${n.toString()}`, { scroll: false }));
  };

  // debounce search typing
  useEffect(() => {
    if (text === (sp.get("q") ?? "")) return;
    const t = setTimeout(() => set({ q: text.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const exportHref = `${apiBase}/export?${(() => { const n = new URLSearchParams(sp.toString()); n.delete("page"); n.delete("pageSize"); return n.toString(); })()}`;
  const hasFilters = ["q", "status", "from", "to"].some((k) => sp.get(k));
  const sortAsc = sp.get("sort") === "asc";

  return (
    <div className="card p-4">
      <div className="flex flex-col xl:flex-row gap-3">
        <div className="flex flex-1 gap-2 min-w-0">
          <select className="input w-[140px] shrink-0" value={sp.get("field") ?? "all"} onChange={(e) => set({ field: e.target.value === "all" ? null : e.target.value })} aria-label="Search in">
            <option value="all">All fields</option>
            <option value="email">Email ID</option>
            <option value="name">Passenger name</option>
            <option value="filename">Filename</option>
          </select>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <input className="input pl-9 pr-9" placeholder="Search email, name, ID, file…" value={text} onChange={(e) => setText(e.target.value)} />
            {pending ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-faint" />
              : text && <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink" onClick={() => setText("")} aria-label="Clear"><X className="size-4" /></button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-[140px]" value={sp.get("status") ?? ""} onChange={(e) => set({ status: e.target.value || null })} aria-label="Status">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="flex items-center gap-1.5">
            <input type="date" className="input w-[150px]" value={sp.get("from") ?? ""} max={sp.get("to") ?? undefined} onChange={(e) => set({ from: e.target.value || null })} aria-label="From date" />
            <span className="text-faint text-sm">to</span>
            <input type="date" className="input w-[150px]" value={sp.get("to") ?? ""} min={sp.get("from") ?? undefined} onChange={(e) => set({ to: e.target.value || null })} aria-label="To date" />
          </div>
          <button className="btn-ghost" onClick={() => set({ sort: sortAsc ? null : "asc" })} title="Sort by submission date">
            {sortAsc ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}{sortAsc ? "Oldest" : "Newest"}
          </button>
          {hasFilters && <button className="btn-ghost" onClick={() => { setText(""); set({ q: null, status: null, from: null, to: null, field: null }); }}><X className="size-4" /> Reset</button>}
          {/* <a href={exportHref} className="btn-primary" title="Excel-compatible CSV of all rows matching the current filters">
            <Download className="size-4" /> Export CSV
          </a> */}
        </div>
      </div>
      <div className="mt-3 text-xs text-muted">{total.toLocaleString("en-IN")} {total === 1 ? "submission" : "submissions"} match{total === 1 ? "es" : ""}{hasFilters ? " the current filters" : ""}</div>
    </div>
  );
}
