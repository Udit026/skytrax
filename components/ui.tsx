import type { LucideIcon } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "brand" }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon: LucideIcon;
  tone?: "brand" | "sky" | "emerald" | "amber" | "violet" | "slate";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand", sky: "bg-sky-50 text-sky-600", emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", violet: "bg-violet-50 text-violet-600", slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium text-muted">{label}</div>
        <div className={`grid place-items-center size-9 rounded-lg ${tones[tone]}`}><Icon className="size-[18px]" /></div>
      </div>
      <div className="mt-2 text-[28px] leading-none font-semibold tracking-tight tnum">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", dot: "bg-emerald-500" },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 ring-amber-600/15", dot: "bg-amber-500" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 ring-red-600/15", dot: "bg-red-500" },
};
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="py-16 px-6 text-center">
      <div className="mx-auto grid place-items-center size-12 rounded-full bg-page text-faint"><Icon className="size-6" /></div>
      <div className="mt-4 font-semibold">{title}</div>
      {body && <p className="mt-1 text-sm text-muted max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
