import "server-only";
import { q, TZ } from "./db";

export type Status = "pending" | "verified" | "rejected";
export const STATUSES: Status[] = ["pending", "verified", "rejected"];

export type ListFilters = {
  search?: string;
  searchField?: "all" | "email" | "name" | "filename";
  status?: Status | "";
  from?: string; // YYYY-MM-DD (IST)
  to?: string;   // YYYY-MM-DD (IST), inclusive
  sort?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export function parseFilters(sp: URLSearchParams): ListFilters {
  const size = Number(sp.get("pageSize"));
  const status = sp.get("status") as Status | null;
  const field = sp.get("field");
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    search: (sp.get("q") || "").trim().slice(0, 200) || undefined,
    searchField: (["email", "name", "filename"].includes(field ?? "") ? field : "all") as ListFilters["searchField"],
    status: status && STATUSES.includes(status) ? status : "",
    from: date(sp.get("from")),
    to: date(sp.get("to")),
    sort: sp.get("sort") === "asc" ? "asc" : "desc",
    page: Math.max(1, Math.floor(Number(sp.get("page")) || 1)),
    pageSize: [10, 25, 50, 100].includes(size) ? size : 25,
  };
}

const esc = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

export function buildWhere(f: ListFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);

  if (f.search) {
    const like = p(`%${esc(f.search)}%`);
    const byEmail = `s.respondent_email ILIKE ${like}`;
    const byName = `s.passenger_name ILIKE ${like}`;
    const byFile = `EXISTS (SELECT 1 FROM uploaded_screenshots u WHERE u.submission_id = s.id AND u.original_filename ILIKE ${like})`;
    const bySubId = `s.submission_id ILIKE ${like}`;
    where.push(
      f.searchField === "email" ? byEmail
      : f.searchField === "name" ? byName
      : f.searchField === "filename" ? byFile
      : `(${byEmail} OR ${byName} OR ${bySubId} OR ${byFile})`,
    );
  }
  if (f.status) where.push(`s.status = ${p(f.status)}`);
  if (f.from) where.push(`s.created_at >= (${p(f.from)}::date::timestamp AT TIME ZONE '${TZ}')`);
  if (f.to) where.push(`s.created_at < ((${p(f.to)}::date + 1)::timestamp AT TIME ZONE '${TZ}')`);

  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export type SubmissionRow = {
  id: string;
  submission_id: string;
  respondent_email: string;
  passenger_name: string | null;
  status: Status;
  created_at: string;
  screenshot_count: number;
  first_shot_id: string | null;
  first_shot_name: string | null;
  first_shot_size: number | null;
  total_size: number | null;
};

export async function listSubmissions(f: ListFilters) {
  const { sql, params } = buildWhere(f);
  const pageSize = f.pageSize ?? 25;
  const offset = ((f.page ?? 1) - 1) * pageSize;
  const order = f.sort === "asc" ? "ASC" : "DESC";

  const [rows, count] = await Promise.all([
    // Pick the page of ids first (index-only walk), then enrich just those rows.
    q<SubmissionRow>(
      `WITH page AS (
         SELECT s.id, s.submission_id, s.respondent_email, s.passenger_name, s.status, s.created_at, s.screenshot_count
           FROM survey_submissions s
           ${sql}
          ORDER BY s.created_at ${order}, s.id ${order}
          LIMIT ${pageSize} OFFSET ${offset})
       SELECT p.*, fs.id AS first_shot_id, fs.original_filename AS first_shot_name,
              fs.file_size::int AS first_shot_size, ts.total::float8 AS total_size
         FROM page p
         LEFT JOIN LATERAL (
           SELECT u.id, u.original_filename, u.file_size FROM uploaded_screenshots u
            WHERE u.submission_id = p.id ORDER BY u.uploaded_at, u.id LIMIT 1) fs ON true
         LEFT JOIN LATERAL (
           SELECT sum(u.file_size) AS total FROM uploaded_screenshots u WHERE u.submission_id = p.id) ts ON true
        ORDER BY p.created_at ${order}, p.id ${order}`,
      params,
    ),
    q<{ n: string }>(`SELECT count(*) AS n FROM survey_submissions s ${sql}`, params),
  ]);
  return { rows, total: Number(count[0].n), page: f.page ?? 1, pageSize };
}

export async function getOverviewStats() {
  const [r] = await q<{
    total: string; unique_emails: string; screenshots: string;
    today: string; month: string; last_at: string | null;
    pending: string; verified: string; rejected: string;
  }>(
    `SELECT count(*) AS total,
            count(DISTINCT lower(respondent_email)) AS unique_emails,
            coalesce(sum(screenshot_count), 0) AS screenshots,
            count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}') AS today,
            count(*) FILTER (WHERE created_at >= date_trunc('month', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}') AS month,
            max(created_at) AS last_at,
            count(*) FILTER (WHERE status = 'pending') AS pending,
            count(*) FILTER (WHERE status = 'verified') AS verified,
            count(*) FILTER (WHERE status = 'rejected') AS rejected
       FROM survey_submissions`,
  );
  return {
    total: +r.total, uniqueEmails: +r.unique_emails, screenshots: +r.screenshots,
    today: +r.today, month: +r.month, lastAt: r.last_at,
    pending: +r.pending, verified: +r.verified, rejected: +r.rejected,
  };
}

export async function getSubmission(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [s] = await q<{
    id: string; submission_id: string; respondent_email: string; passenger_name: string | null;
    remarks: string | null; admin_remarks: string | null; status: Status;
    created_at: string; updated_at: string; reviewed_at: string | null;
    reviewed_by_name: string | null; created_by_name: string | null;
  }>(
    `SELECT s.*, r.name AS reviewed_by_name, c.name AS created_by_name
       FROM survey_submissions s
       LEFT JOIN admins r ON r.id = s.reviewed_by
       LEFT JOIN admins c ON c.id = s.created_by
      WHERE s.id = $1`,
    [id],
  );
  if (!s) return null;
  const shots = await q<{
    id: string; original_filename: string; stored_filename: string; file_url: string;
    file_size: string; mime_type: string; width: number | null; height: number | null; uploaded_at: string;
  }>(`SELECT * FROM uploaded_screenshots WHERE submission_id = $1 ORDER BY uploaded_at, id`, [id]);
  return { ...s, screenshots: shots.map((x) => ({ ...x, file_size: Number(x.file_size) })) };
}
