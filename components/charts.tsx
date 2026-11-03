"use client";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from "recharts";

export const COLORS = { total: "#1d4ed8", verified: "#059669", pending: "#d97706", rejected: "#dc2626", screenshots: "#0ea5e9" };
const axis = { fontSize: 11, fill: "#8a98ab" };
const tooltipStyle = { borderRadius: 10, border: "1px solid #e4e8ee", boxShadow: "0 6px 20px rgba(15,27,45,.08)", fontSize: 12 };

export function fmtBucket(b: string, unit: "day" | "week" | "month") {
  const d = new Date(b + "T00:00:00");
  if (unit === "month") return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

type Row = { bucket: string; [k: string]: number | string };

export function TrendArea({ data, unit = "day", height = 260 }: { data: Row[]; unit?: "day" | "week" | "month"; height?: number }) {
  const d = data.map((r) => ({ ...r, label: (unit === "week" ? "Wk of " : "") + fmtBucket(r.bucket, unit) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.total} stopOpacity={0.22} />
            <stop offset="100%" stopColor={COLORS.total} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eef1f5" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="total" name="Submissions" stroke={COLORS.total} strokeWidth={2} fill="url(#gTotal)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StackedBars({ data, unit, height = 260 }: { data: Row[]; unit: "day" | "week" | "month"; height?: number }) {
  const d = data.map((r) => ({ ...r, label: (unit === "week" ? "Wk of " : "") + fmtBucket(r.bucket, unit) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f5" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3f5f8" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="verified" name="Verified" stackId="s" fill={COLORS.verified} />
        <Bar dataKey="pending" name="Pending" stackId="s" fill={COLORS.pending} />
        <Bar dataKey="rejected" name="Rejected" stackId="s" fill={COLORS.rejected} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, x, y, name, color = COLORS.total, height = 220 }: {
  data: Record<string, number | string>[]; x: string; y: string; name: string; color?: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f5" vertical={false} />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} interval={2} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3f5f8" }} />
        <Bar dataKey={y} name={name} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ verified, pending, rejected, height = 220 }: { verified: number; pending: number; rejected: number; height?: number }) {
  const data = [
    { name: "Verified", value: verified, c: COLORS.verified },
    { name: "Pending", value: pending, c: COLORS.pending },
    { name: "Rejected", value: rejected, c: COLORS.rejected },
  ];
  const total = verified + pending + rejected;
  if (!total) return <div className="h-[220px] grid place-items-center text-sm text-muted">No submissions yet</div>;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.c} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-2xl font-semibold tnum">{total.toLocaleString("en-IN")}</div>
          <div className="text-[11px] text-muted">submissions</div>
        </div>
      </div>
    </div>
  );
}
