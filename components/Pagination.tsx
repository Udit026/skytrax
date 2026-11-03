"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const go = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => n.set(k, v));
    router.push(`${path}?${n.toString()}`, { scroll: false });
  };
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Show</span>
        <select className="input h-8 w-[76px]" value={pageSize} onChange={(e) => go({ pageSize: e.target.value, page: "1" })}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="tnum">entries · {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}</span>
      </div>
      <div className="flex items-center gap-1">
        <button className="btn-ghost h-8 px-2" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        {nums.map((n, i) => n === "…" ? <span key={`e${i}`} className="px-2 text-faint">…</span> : (
          <button key={n} onClick={() => go({ page: String(n) })}
            className={`btn h-8 min-w-8 px-2 tnum ${n === page ? "bg-brand text-white" : "bg-white border border-line hover:bg-page"}`}>{n}</button>
        ))}
        <button className="btn-ghost h-8 px-2" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })} aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}
