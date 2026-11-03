import "server-only";
import { q, TZ } from "./db";

type Point = { bucket: string; total: number; verified: number; pending: number; rejected: number; screenshots: number };

async function series(unit: "day" | "week" | "month", from: string, to: string): Promise<Point[]> {
  const step = unit === "day" ? "1 day" : unit === "week" ? "1 week" : "1 month";
  const rows = await q<Record<string, string>>(
    `WITH b AS (
       SELECT generate_series(date_trunc('${unit}', $1::date), date_trunc('${unit}', $2::date), interval '${step}')::date AS bucket
     ), agg AS (
       SELECT date_trunc('${unit}', created_at AT TIME ZONE '${TZ}')::date AS bucket,
              count(*) AS total,
              count(*) FILTER (WHERE status='verified') AS verified,
              count(*) FILTER (WHERE status='pending')  AS pending,
              count(*) FILTER (WHERE status='rejected') AS rejected,
              sum(screenshot_count) AS screenshots
         FROM survey_submissions
        WHERE created_at >= (date_trunc('${unit}', $1::date)::timestamp AT TIME ZONE '${TZ}')
          AND created_at <  (($2::date + 1)::timestamp AT TIME ZONE '${TZ}')
        GROUP BY 1)
     SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
            coalesce(a.total,0) total, coalesce(a.verified,0) verified, coalesce(a.pending,0) pending,
            coalesce(a.rejected,0) rejected, coalesce(a.screenshots,0) screenshots
       FROM b LEFT JOIN agg a USING (bucket) ORDER BY b.bucket`,
    [from, to],
  );
  return rows.map((r) => ({
    bucket: r.bucket, total: +r.total, verified: +r.verified, pending: +r.pending, rejected: +r.rejected, screenshots: +r.screenshots,
  }));
}

const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function getAnalytics(from?: string, to?: string) {
  const today = istDate(new Date());
  const dTo = to && to <= today ? to : today;
  let dFrom = from && from <= dTo ? from : shift(dTo, -29);
  if (shift(dFrom, 366) < dTo) dFrom = shift(dTo, -366); // cap daily range at ~1 year

  const [daily, weekly, monthly, totals, hourly] = await Promise.all([
    series("day", dFrom, dTo),
    series("week", shift(today, -7 * 11), today),
    series("month", shift(today, -335), today),
    q<Record<string, string>>(
      `SELECT count(*) total, count(DISTINCT lower(respondent_email)) uniq, coalesce(sum(screenshot_count),0) shots,
              count(*) FILTER (WHERE status='verified') verified, count(*) FILTER (WHERE status='pending') pending,
              count(*) FILTER (WHERE status='rejected') rejected
         FROM survey_submissions
        WHERE created_at >= ($1::date::timestamp AT TIME ZONE '${TZ}')
          AND created_at <  (($2::date + 1)::timestamp AT TIME ZONE '${TZ}')`,
      [dFrom, dTo],
    ),
    q<{ h: number; n: string }>(
      `SELECT extract(hour FROM created_at AT TIME ZONE '${TZ}')::int h, count(*) n
         FROM survey_submissions
        WHERE created_at >= ($1::date::timestamp AT TIME ZONE '${TZ}')
          AND created_at <  (($2::date + 1)::timestamp AT TIME ZONE '${TZ}')
        GROUP BY 1 ORDER BY 1`,
      [dFrom, dTo],
    ),
  ]);
  const t = totals[0];
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: Number(hourly.find((x) => x.h === h)?.n ?? 0) }));
  return {
    range: { from: dFrom, to: dTo },
    totals: { total: +t.total, unique: +t.uniq, screenshots: +t.shots, verified: +t.verified, pending: +t.pending, rejected: +t.rejected },
    daily, weekly, monthly, byHour,
  };
}
export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
