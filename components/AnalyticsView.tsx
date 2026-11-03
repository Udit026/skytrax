"use client";
import { useState } from "react";
import { Inbox, Users, Images, CheckCircle2, Loader2 } from "lucide-react";
import { StatCard } from "./ui";
import { TrendArea, StackedBars, SimpleBars, StatusDonut, COLORS } from "./charts";
import type { Analytics } from "@/lib/analytics";
import { fmtNum } from "@/lib/format";

const PRESETS = [{ d: 7, l: "7 days" }, { d: 30, l: "30 days" }, { d: 90, l: "90 days" }, { d: 365, l: "12 months" }];
const shift = (iso: string, days: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export default function AnalyticsView({ initial, today, apiBase = "/api" }: { initial: Analytics; today: string; apiBase?: string }) {
  const [data, setData] = useState(initial);
  const [from, setFrom] = useState(initial.range.from);
  const [to, setTo] = useState(initial.range.to);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [trendUnit, setTrendUnit] = useState<"day" | "week" | "month">("day");

  async function load(f: string, t: string) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${apiBase}/analytics?from=${f}&to=${t}`);
      if (!r.ok) throw new Error();
      const j: Analytics = await r.json();
      setData(j); setFrom(j.range.from); setTo(j.range.to);
    } catch { setErr("Could not load analytics."); } finally { setBusy(false); }
  }

  const t = data.totals;
  const verifiedPct = t.total ? Math.round((t.verified / t.total) * 100) : 0;
  const trend = trendUnit === "day" ? data.daily : trendUnit === "week" ? data.weekly : data.monthly;
  const activePreset = to === today ? PRESETS.find((p) => shift(today, -(p.d - 1)) === from)?.d : undefined;
  const busiest = [...data.daily].sort((a, b) => b.total - a.total)[0];

  return (
    <>
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-page p-1">
          {PRESETS.map((p) => (
            <button key={p.d} onClick={() => load(shift(today, -(p.d - 1)), today)}
              className={`px-3 h-8 rounded-md text-sm font-medium transition ${activePreset === p.d ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}>{p.l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input type="date" className="input w-[150px]" value={from} max={to} onChange={(e) => e.target.value && load(e.target.value, to)} aria-label="From" />
          <span className="text-sm text-faint">to</span>
          <input type="date" className="input w-[150px]" value={to} min={from} max={today} onChange={(e) => e.target.value && load(from, e.target.value)} aria-label="To" />
        </div>
        {busy && <Loader2 className="size-4 animate-spin text-faint" />}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      <div className={`transition-opacity ${busy ? "opacity-60" : ""}`}>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Submissions in range" value={fmtNum(t.total)} icon={Inbox} hint={busiest?.total ? `Peak: ${fmtNum(busiest.total)} on ${new Date(busiest.bucket).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : undefined} />
          <StatCard label="Unique respondents" value={fmtNum(t.unique)} icon={Users} tone="violet" hint={t.total ? `${(t.total / Math.max(1, t.unique)).toFixed(2)} submissions per email` : undefined} />
          <StatCard label="Screenshots uploaded" value={fmtNum(t.screenshots)} icon={Images} tone="sky" />
          <StatCard label="Verification rate" value={`${verifiedPct}%`} icon={CheckCircle2} tone="emerald" hint={`${fmtNum(t.verified)} verified · ${fmtNum(t.pending)} pending · ${fmtNum(t.rejected)} rejected`} />
        </div>

        <div className="mt-4 card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Submission trend</div>
              <div className="text-xs text-muted">{trendUnit === "day" ? "Selected range, per day" : trendUnit === "week" ? "Last 12 weeks" : "Last 12 months"}</div>
            </div>
            <div className="flex rounded-lg bg-page p-1">
              {(["day", "week", "month"] as const).map((u) => (
                <button key={u} onClick={() => setTrendUnit(u)} className={`px-3 h-7 rounded-md text-xs font-medium capitalize ${trendUnit === u ? "bg-white shadow-sm" : "text-muted"}`}>{u === "day" ? "Daily" : u === "week" ? "Weekly" : "Monthly"}</button>
              ))}
            </div>
          </div>
          <div className="mt-4"><TrendArea data={trend} unit={trendUnit} height={300} /></div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="font-semibold">Submissions by date</div>
            <div className="text-xs text-muted">Split by verification status</div>
            <div className="mt-4"><StackedBars data={data.daily} unit="day" /></div>
          </div>
          <div className="card p-5">
            <div className="font-semibold">Approved vs pending vs rejected</div>
            <div className="text-xs text-muted">Selected range</div>
            <StatusDonut verified={t.verified} pending={t.pending} rejected={t.rejected} />
            <div className="mt-2 grid grid-cols-3 text-center text-xs">
              <div><div className="font-semibold text-sm tnum" style={{ color: COLORS.verified }}>{fmtNum(t.verified)}</div>Verified</div>
              <div><div className="font-semibold text-sm tnum" style={{ color: COLORS.pending }}>{fmtNum(t.pending)}</div>Pending</div>
              <div><div className="font-semibold text-sm tnum" style={{ color: COLORS.rejected }}>{fmtNum(t.rejected)}</div>Rejected</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="font-semibold">Weekly submissions</div>
            <div className="text-xs text-muted">Last 12 weeks (weeks start Monday)</div>
            <div className="mt-4"><StackedBars data={data.weekly} unit="week" height={240} /></div>
          </div>
          <div className="card p-5">
            <div className="font-semibold">Monthly submissions</div>
            <div className="text-xs text-muted">Last 12 months</div>
            <div className="mt-4"><StackedBars data={data.monthly} unit="month" height={240} /></div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="card p-5">
            <div className="font-semibold">Time of day (IST)</div>
            <div className="text-xs text-muted">When submissions are recorded, selected range</div>
            <div className="mt-4"><SimpleBars data={data.byHour.map((h) => ({ hour: `${String(h.hour).padStart(2, "0")}:00`, total: h.total }))} x="hour" y="total" name="Submissions" color={COLORS.screenshots} /></div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-line font-semibold">Daily breakdown</div>
            <div className="max-h-[260px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0"><tr><th className="th">Date</th><th className="th text-right">Total</th><th className="th text-right">Verified</th><th className="th text-right">Shots</th></tr></thead>
                <tbody>
                  {[...data.daily].reverse().map((d) => (
                    <tr key={d.bucket}>
                      <td className="td py-2">{new Date(d.bucket).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="td py-2 text-right tnum font-medium">{fmtNum(d.total)}</td>
                      <td className="td py-2 text-right tnum text-muted">{fmtNum(d.verified)}</td>
                      <td className="td py-2 text-right tnum text-muted">{fmtNum(d.screenshots)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
