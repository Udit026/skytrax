import "server-only";
import { NextResponse } from "next/server";
import { q, TZ } from "./db";
import { buildWhere, parseFilters } from "./submissions";

const BATCH = 2000;
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/Excel formula-injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type Opts = {
  /** Include the internal "Admin Remarks" column (signed-in exports only). */
  adminRemarks: boolean;
  /** Where screenshot links point, e.g. "/api" or "/api/client". */
  filesBase: string;
  headers?: Record<string, string>;
};

/** Streams every row matching the current filters as an Excel-compatible UTF-8 CSV, in keyset batches. */
export function csvResponse(req: Request, { adminRemarks, filesBase, headers = {} }: Opts) {
  const f = parseFilters(new URL(req.url).searchParams);
  const { sql, params } = buildWhere(f);
  const origin = new URL(req.url).origin;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode("﻿" + [
        "Submission ID", "Email ID", "Passenger Name", "Status", "Submitted At (IST)",
        "Screenshots", "Original Filenames", "Total Size (bytes)", "Remarks", ...(adminRemarks ? ["Admin Remarks"] : []), "Screenshot Links",
      ].join(",") + "\r\n"));
      let cursor: { at: string; id: string } | null = null;
      try {
        for (;;) {
          const p = [...params];
          const conds = sql ? [sql.replace(/^WHERE /, "")] : [];
          if (cursor) {
            p.push(cursor.at, cursor.id);
            conds.push(`(s.created_at, s.id) < ($${p.length - 1}::timestamptz, $${p.length}::uuid)`);
          }
          const rows = await q<Record<string, string>>(
            `SELECT s.id, s.submission_id, s.respondent_email, s.passenger_name, s.status, s.remarks, ${adminRemarks ? "s.admin_remarks," : ""}
                    s.created_at::text AS cur_at, to_char(s.created_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD HH24:MI:SS') AS at_ist,
                    s.screenshot_count,
                    (SELECT string_agg(u.original_filename, ' | ' ORDER BY u.uploaded_at) FROM uploaded_screenshots u WHERE u.submission_id = s.id) AS files,
                    (SELECT string_agg(u.id::text, ' ' ORDER BY u.uploaded_at) FROM uploaded_screenshots u WHERE u.submission_id = s.id) AS shot_ids,
                    (SELECT sum(u.file_size) FROM uploaded_screenshots u WHERE u.submission_id = s.id) AS total_size
               FROM survey_submissions s
               ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
              ORDER BY s.created_at DESC, s.id DESC LIMIT ${BATCH}`,
            p,
          );
          if (!rows.length) break;
          let out = "";
          for (const r of rows) {
            const links = (r.shot_ids || "").split(" ").filter(Boolean).map((id) => `${origin}${filesBase}/files/${id}`).join(" | ");
            out += [r.submission_id, r.respondent_email, r.passenger_name, r.status, r.at_ist, r.screenshot_count,
              r.files, r.total_size, r.remarks, ...(adminRemarks ? [r.admin_remarks] : []), links].map(cell).join(",") + "\r\n";
          }
          ctrl.enqueue(enc.encode(out));
          const last = rows[rows.length - 1];
          cursor = { at: last.cur_at, id: last.id }; // full µs precision
          if (rows.length < BATCH) break;
        }
        ctrl.close();
      } catch (e) {
        console.error("Export failed", e);
        ctrl.error(e);
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skytrax-submissions-${stamp}.csv"`,
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
