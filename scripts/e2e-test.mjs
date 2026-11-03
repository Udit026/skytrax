// End-to-end API test against a running server.
// Usage: BASE=http://localhost:3000 ADMIN_EMAIL=.. ADMIN_PASSWORD=.. node scripts/e2e-test.mjs
import sharp from "sharp";

const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
let cookie = "";
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) process.exitCode = 1; };
const req = (path, opts = {}) => fetch(BASE + path, { redirect: "manual", ...opts, headers: { ...(opts.headers || {}), cookie } });

const img = (w, h, fmt, color) => sharp({ create: { width: w, height: h, channels: 3, background: color } })[fmt]().toBuffer();

// --- auth
ok((await req("/")).status === 307, "unauthenticated page redirects to /login");
ok((await req("/api/submissions")).status === 401, "unauthenticated API returns 401");
ok((await req("/api/files/00000000-0000-0000-0000-000000000000")).status === 401, "unauthenticated file access returns 401");
let r = await req("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: "wrong-password" }) });
ok(r.status === 401, "wrong password rejected");
r = await req("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL.toUpperCase(), password: PASSWORD }) });
cookie = (r.headers.get("set-cookie") || "").split(";")[0];
ok(r.status === 200 && cookie.startsWith("sky_session="), "login succeeds (case-insensitive email) and sets httpOnly cookie");
ok((r.headers.get("set-cookie") || "").toLowerCase().includes("httponly"), "session cookie is HttpOnly");
ok((await req("/")).status === 200, "dashboard loads when signed in");

// --- upload: valid multi-file (tall phone screenshot + PNG + WEBP)
const tall = await img(1170, 2532, "jpeg", "#3366cc");
const png = await img(800, 600, "png", "#22aa66");
const webp = await img(600, 900, "webp", "#cc3344");
let fd = new FormData();
fd.append("respondent_email", "  Passenger.One@Example.com ");
fd.append("passenger_name", "Aarav Mehta");
fd.append("remarks", "Gate 34, T3");
fd.append("screenshots", new Blob([tall], { type: "image/jpeg" }), "skytrax_form_1.jpg");
fd.append("screenshots", new Blob([png], { type: "image/png" }), "confirmation.png");
fd.append("screenshots", new Blob([webp], { type: "image/webp" }), "thanks page.webp");
r = await req("/api/submissions", { method: "POST", body: fd });
const up = await r.json();
ok(r.status === 201 && up.screenshots === 3 && /^SKY-\d{6}$/.test(up.submission_id), `multi-file upload saved (${up.submission_id})`);

// second submission, same email (repeat respondent) + one different
for (const [em, nm, fname] of [["passenger.one@example.com", "", "repeat.png"], ["riya.k@gmail.com", "Riya Kapoor", "riya_survey.png"]]) {
  fd = new FormData(); fd.append("respondent_email", em); if (nm) fd.append("passenger_name", nm);
  fd.append("screenshots", new Blob([png], { type: "image/png" }), fname);
  r = await req("/api/submissions", { method: "POST", body: fd });
  ok(r.status === 201, `upload for ${em}`);
}

// --- upload validation
fd = new FormData(); fd.append("respondent_email", "x@y.com");
fd.append("screenshots", new Blob([Buffer.from("<?php echo 1; ?>")], { type: "image/jpeg" }), "evil.jpg");
r = await req("/api/submissions", { method: "POST", body: fd });
let j = await r.json();
ok(r.status === 422 && j.fileErrors?.[0]?.file === "evil.jpg", "fake .jpg (wrong magic bytes) rejected, nothing saved");
fd = new FormData(); fd.append("respondent_email", "x@y.com");
fd.append("screenshots", new Blob([Buffer.from("GIF89a....")], { type: "image/gif" }), "a.gif");
ok((await req("/api/submissions", { method: "POST", body: fd })).status === 422, "GIF rejected");
fd = new FormData(); fd.append("respondent_email", "not-an-email");
fd.append("screenshots", new Blob([png], { type: "image/png" }), "a.png");
ok((await req("/api/submissions", { method: "POST", body: fd })).status === 400, "invalid email rejected");
fd = new FormData(); fd.append("respondent_email", "x@y.com");
ok((await req("/api/submissions", { method: "POST", body: fd })).status === 400, "missing screenshot rejected");
const big = Buffer.alloc(11 * 1024 * 1024); png.copy(big);
fd = new FormData(); fd.append("respondent_email", "x@y.com");
fd.append("screenshots", new Blob([big], { type: "image/png" }), "huge.png");
ok((await req("/api/submissions", { method: "POST", body: fd })).status === 422, "file over 10 MB rejected");
fd = new FormData(); fd.append("respondent_email", "x@y.com");
fd.append("screenshots", new Blob([png], { type: "image/png" }), "ok.png");
ok((await fetch(BASE + "/api/submissions", { method: "POST", body: fd, headers: { cookie, origin: "https://evil.example" } })).status === 403, "cross-origin POST blocked");

// --- list / search / filter
const list = async (qs) => (await (await req("/api/submissions?" + qs)).json());
j = await list("");
ok(j.total === 3, `list total = 3 (got ${j.total})`);
ok(j.rows[0].respondent_email === "riya.k@gmail.com", "default sort newest first");
ok((await list("sort=asc")).rows[0].submission_id === up.submission_id, "sort oldest first");
ok((await list("q=passenger.one&field=email")).total === 2, "search by email");
ok((await list("q=aarav&field=name")).total === 1, "search by passenger name (case-insensitive)");
ok((await list("q=thanks%20page&field=filename")).total === 1, "search by filename (any screenshot, not just first)");
ok((await list(`q=${up.submission_id}`)).total === 1, "search by submission ID");
ok((await list("q=100%25")).total === 0, "LIKE wildcards escaped");
ok((await list("status=pending")).total === 3 && (await list("status=verified")).total === 0, "status filter");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
ok((await list(`from=${today}&to=${today}`)).total === 3, "date filter (today, IST)");
ok((await list(`from=2020-01-01&to=2020-01-31`)).total === 0, "date filter (empty range)");
ok((await list("pageSize=10&page=2")).rows.length === 0, "pagination page 2 empty");
const first = (await list("sort=asc")).rows[0];
ok(first.screenshot_count === 3 && first.first_shot_name === "skytrax_form_1.jpg" && first.first_shot_size === tall.length, "row shows first screenshot name + exact size");

// --- details + files
r = await req(`/api/submissions/${up.id}`); const det = await r.json();
ok(det.respondent_email === "passenger.one@example.com" && det.screenshots.length === 3, "details: email normalised, 3 screenshots");
const s0 = det.screenshots[0];
ok(s0.original_filename === "skytrax_form_1.jpg" && s0.stored_filename !== s0.original_filename && /^originals\/\d{4}\/\d{2}\/.+\.jpg$/.test(s0.stored_filename), "unique stored filename, original kept separately");
ok(s0.width === 1170 && s0.height === 2532, "original dimensions recorded");
r = await req(`/api/files/${s0.id}`); const orig = Buffer.from(await r.arrayBuffer());
ok(r.status === 200 && orig.equals(tall), "original returned byte-for-byte");
r = await req(`/api/files/${s0.id}?v=thumb`); const th = Buffer.from(await r.arrayBuffer()); const tm = await sharp(th).metadata();
ok(r.headers.get("content-type") === "image/webp" && tm.height === 480 && Math.abs(tm.width / tm.height - 1170 / 2532) < 0.01, `thumbnail is WEBP, aspect preserved (${tm.width}x${tm.height}, ${th.length} B vs ${tall.length} B)`);
r = await req(`/api/files/${s0.id}?dl=1`);
ok((r.headers.get("content-disposition") || "").includes("skytrax_form_1.jpg"), "download uses original filename");

// --- review
r = await req(`/api/submissions/${up.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "verified", admin_remarks: "Matches Skytrax confirmation" }) });
ok(r.status === 200, "approve");
const det2 = await (await req(`/api/submissions/${up.id}`)).json();
ok(det2.status === "verified" && det2.admin_remarks === "Matches Skytrax confirmation" && !!det2.reviewed_by_name, "status, remarks and reviewer saved");
ok((await list("status=verified")).total === 1, "verified filter reflects change");
ok((await req(`/api/submissions/${up.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "approved-ish" }) })).status === 400, "invalid status rejected");

// --- analytics
j = await (await req("/api/analytics")).json();
ok(j.totals.total === 3 && j.totals.unique === 2 && j.totals.screenshots === 5 && j.totals.verified === 1, "analytics totals (3 subs, 2 unique, 5 shots, 1 verified)");
ok(j.daily.length === 30 && j.daily.at(-1).total === 3, "daily series: 30 buckets, today = 3");
ok(j.weekly.length >= 12 && j.monthly.length >= 12, "weekly + monthly series");

// --- export
r = await req("/api/export?status=pending");
const csvBuf = Buffer.from(await r.arrayBuffer()); const csv = csvBuf.toString("utf8");
const lines = csv.trim().split("\r\n");
ok(r.status === 200 && csv.startsWith("﻿") && lines.length === 3, `CSV export respects filters (${lines.length - 1} rows)`);
ok(csv.includes("riya_survey.png"), "CSV contains filenames");

// --- client (viewer) role: read-only + downloads
r = await req("/api/admins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "DIAL Client", email: "client@example.com", password: "ClientPass2026!", role: "viewer" }) });
const viewerUser = await r.json();
ok(r.status === 201 && viewerUser.role === "viewer", "admin creates a viewer (client) account");
const vl = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "client@example.com", password: "ClientPass2026!" }) });
const vCookie = (vl.headers.get("set-cookie") || "").split(";")[0];
ok(vl.status === 200 && vCookie.startsWith("sky_session="), "viewer can sign in");
const vreq = (path, opts = {}) => fetch(BASE + path, { redirect: "manual", ...opts, headers: { ...(opts.headers || {}), cookie: vCookie } });
const jh = { "content-type": "application/json" };
ok((await vreq("/api/submissions")).status === 200, "viewer: list submissions allowed");
ok((await vreq(`/api/submissions/${up.id}`)).status === 200, "viewer: submission detail allowed");
ok((await vreq("/api/analytics")).status === 200, "viewer: analytics allowed");
j = await (await vreq(`/api/submissions/${up.id}`)).json();
ok(j.admin_remarks === null && j.created_by_name === null && j.reviewed_by_name === null, "viewer: internal remarks and staff names are hidden");
const vShot = (await (await vreq(`/api/submissions/${up.id}`)).json()).screenshots[0];
r = await vreq(`/api/files/${vShot.id}?dl=1`);
ok(r.status === 200 && (r.headers.get("content-disposition") || "").includes("attachment"), "viewer: can download original screenshot");
r = await vreq("/api/export");
ok(r.status === 200 && (r.headers.get("content-type") || "").includes("text/csv"), "viewer: can export CSV");
r = await vreq(`/api/submissions/${up.id}/download`);
const zipBuf = Buffer.from(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("content-type") === "application/zip" && zipBuf.subarray(0, 2).toString() === "PK", "viewer: ZIP download of all screenshots");
const zipText = zipBuf.toString("latin1");
ok(["skytrax_form_1.jpg", "confirmation.png", "thanks page.webp"].every((n) => zipText.includes(n)) && zipText.includes(up.submission_id + "/"), "ZIP contains all 3 original files");
ok((await req(`/api/submissions/${up.id}/download`)).status === 200, "admin: ZIP download also works");
ok((await fetch(BASE + `/api/submissions/${up.id}/download`)).status === 401, "ZIP download needs sign-in");
// every write / management endpoint must refuse a viewer (server-side, not just hidden buttons)
const vfd = new FormData(); vfd.append("respondent_email", "hack@example.com"); vfd.append("screenshots", new Blob([png], { type: "image/png" }), "x.png");
ok((await vreq("/api/submissions", { method: "POST", body: vfd })).status === 403, "viewer: cannot upload (403)");
ok((await vreq(`/api/submissions/${up.id}`, { method: "PATCH", headers: jh, body: JSON.stringify({ status: "rejected" }) })).status === 403, "viewer: cannot change status (403)");
ok((await vreq(`/api/submissions/${up.id}`, { method: "DELETE" })).status === 403, "viewer: cannot delete (403)");
ok((await vreq("/api/admins")).status === 403, "viewer: cannot list users (403)");
ok((await vreq("/api/admins", { method: "POST", headers: jh, body: JSON.stringify({ name: "Evil", email: "evil@example.com", password: "EvilPass2026!!", role: "admin" }) })).status === 403, "viewer: cannot create users (403)");
ok((await vreq(`/api/admins/${viewerUser.id}`, { method: "DELETE" })).status === 403, "viewer: cannot delete users (403)");
ok((await req(`/api/submissions/${up.id}`)).status === 200, "writes by viewer did not alter data");
j = await (await req(`/api/submissions/${up.id}`)).json();
ok(j.status === "verified", "submission status unchanged by viewer attempt");
// pages
ok((await vreq("/upload")).status === 307, "viewer: /upload redirects away");
ok((await vreq("/settings")).status === 307, "viewer: /settings redirects away");
let page = await (await vreq("/")).text();
ok(page.includes("View-only access") && !page.includes("Upload submission"), "viewer: overview shows view-only ribbon, no upload button");
page = await (await vreq(`/submissions/${up.id}`)).text();
ok(page.includes("Original, full-resolution") && page.includes(`/api/submissions/${up.id}/download`) && !page.includes("Approve") && !page.includes(">Reject<"), "viewer: detail page has downloads, no Approve/Reject");
page = await (await req("/")).text();
ok(!page.includes("View-only access") && page.includes("Upload submission"), "admin: normal overview unchanged");
ok((await vreq("/api/admins/password", { method: "POST", headers: jh, body: JSON.stringify({ current: "nope", next: "AnotherPass2026" }) })).status === 400, "viewer can reach own change-password (wrong current → 400)");
ok((await req(`/api/admins/${viewerUser.id}`, { method: "DELETE" })).status === 200, "admin removes the viewer");
ok((await vreq("/api/submissions")).status === 401, "removed viewer's session is revoked immediately");

// --- public client view (no login, no cookie, read-only)
// Set CLIENT_VIEW_SLUG for the server AND this script if you changed it; default is "delhiairportclient".
const SLUG = process.env.CLIENT_VIEW_SLUG || "delhiairportclient";
const pub = (path, opts = {}) => fetch(BASE + path, { redirect: "manual", ...opts }); // never sends a cookie
const loc = (res) => res.headers.get("location") || "";
const C = "/api/client";

r = await pub(`/${SLUG}`);
page = await r.text();
ok(r.status === 200 && page.includes("Campaign overview") && page.includes("SKY-") && page.includes("passenger.one@example.com"), `client: /${SLUG} opens with no login and shows data`);
ok(!r.headers.get("set-cookie"), "client: page sets no cookie");
ok(page.includes("View-only") && page.includes(`href="/${SLUG}/submissions"`) && page.includes(`href="/${SLUG}/analytics"`), "client: top nav + View-only ribbon, links under the slug");
ok(!/Logout|Sign in|Upload submission|Users &amp; Settings|Approve|Delete/.test(page), "client: no login/logout/upload/settings/approve/delete anywhere");
ok((r.headers.get("x-robots-tag") || "").includes("noindex") && (r.headers.get("x-robots-tag") || "").includes("noarchive"), "client: page sends X-Robots-Tag noindex, nofollow, noarchive");
ok(/<meta name="robots" content="noindex, ?nofollow/.test(page), "client: page has <meta name=robots noindex,nofollow>");
ok((r.headers.get("cache-control") || "").includes("no-store"), "client: page is not cacheable");
r = await pub(`/${SLUG}/`);
ok(r.status === 200 || r.status === 308, "client: trailing slash tolerated");

r = await pub(`/${SLUG}/submissions`);
page = await r.text();
ok(r.status === 200 && page.includes("All submissions") && page.includes("riya.k@gmail.com") && page.includes(`/${SLUG}/submissions/${up.id}`), "client: All Submissions page lists rows with slug-based links");
ok(page.includes("/api/client/files/") && !page.includes("/api/files/") && !page.includes("/api/submissions"), "client: thumbnails/export use /api/client only, never the admin API");
ok(page.includes("/api/client/export") || page.includes("Export CSV"), "client: CSV export button present");
r = await pub(`/${SLUG}/submissions?q=riya&field=name&status=pending`);
page = await r.text();
ok(r.status === 200 && page.includes("riya.k@gmail.com") && !page.includes("passenger.one@example.com"), "client: search + status filter work server-side");

r = await pub(`/${SLUG}/submissions/${up.id}`);
page = await r.text();
ok(r.status === 200 && page.includes(up.submission_id) && page.includes("Original, full-resolution") && page.includes(`${C}/submissions/${up.id}/download`), "client: detail page with screenshots + ZIP download");
ok(!page.includes("Matches Skytrax confirmation") && !page.includes("E2E Admin") && !page.includes("admin_remarks") && !page.includes("stored_filename") && !page.includes("originals/") && !page.includes("Admin remarks"), "client: detail HTML (incl. embedded RSC data) leaks no admin remarks, staff names or storage keys");
ok(!/Approve|Reject|Delete submission|Save remarks/.test(page), "client: detail page has no review controls");
r = await pub(`/${SLUG}/analytics`);
page = await r.text();
ok(r.status === 200 && page.includes("Analytics") && page.includes("Submission trend"), "client: analytics page");
r = await pub(`/${SLUG}/submissions/00000000-0000-0000-0000-000000000000`);
ok(r.status === 404, "client: unknown submission page is 404");

// API: list / detail / analytics
r = await pub(`${C}/submissions`);
const cl = await r.json();
ok(r.status === 200 && cl.total === 3 && cl.rows.length === 3, "client API: list returns data without a cookie");
ok((r.headers.get("cache-control") || "").includes("no-store") && (r.headers.get("x-robots-tag") || "").includes("noindex"), "client API: Cache-Control private,no-store + X-Robots-Tag");
ok(!/admin_remarks|created_by|reviewed_by|E2E Admin|Matches Skytrax/.test(JSON.stringify(cl)), "client API: list has no admin fields");
j = await (await pub(`${C}/submissions?q=passenger.one&field=email&sort=asc&pageSize=10`)).json();
ok(j.total === 2 && j.rows[0].created_at <= j.rows[1].created_at, "client API: search/sort/pageSize params work");
r = await pub(`${C}/submissions/${up.id}`);
const cd = await r.json();
ok(r.status === 200 && cd.submission_id === up.submission_id && cd.screenshots.length === 3 && cd.status === "verified", "client API: detail");
ok(!("admin_remarks" in cd) && !("created_by" in cd) && !("reviewed_by" in cd) && !("created_by_name" in cd) && !("reviewed_by_name" in cd), "client API: detail has no admin_remarks / created_by / reviewed_by / staff names (keys absent)");
ok(!/Matches Skytrax|E2E Admin|stored_filename|thumb_filename|file_url|originals\//.test(JSON.stringify(cd)), "client API: detail has no admin text, staff names or storage keys anywhere");
ok((await pub(`${C}/submissions/not-a-uuid`)).status === 404 && (await pub(`${C}/submissions/00000000-0000-0000-0000-000000000000`)).status === 404, "client API: bad/unknown id → 404");
r = await pub(`${C}/analytics`);
j = await r.json();
ok(r.status === 200 && j.totals.total === 3 && j.daily.length === 30, "client API: analytics");

// API: files
const cs = cd.screenshots[0];
r = await pub(`${C}/files/${cs.id}`);
ok(r.status === 200 && Buffer.from(await r.arrayBuffer()).equals(tall) && (r.headers.get("x-robots-tag") || "").includes("noindex"), "client API: original served byte-for-byte");
r = await pub(`${C}/files/${cs.id}?v=thumb`);
ok(r.status === 200 && r.headers.get("content-type") === "image/webp", "client API: thumbnail");
r = await pub(`${C}/files/${cs.id}?dl=1`);
ok(r.status === 200 && (r.headers.get("content-disposition") || "").includes("skytrax_form_1.jpg"), "client API: ?dl=1 downloads with original filename");
ok((await pub(`${C}/files/${up.id}`)).status === 404, "client API: submission id (not a screenshot id) is not served");
ok((await pub(`${C}/files/${viewerUser.id}`)).status === 404, "client API: admin/user id is not served");
ok((await pub(`${C}/files/..%2F..%2F.env`)).status === 404 && (await pub(`${C}/files/not-a-uuid`)).status === 404, "client API: non-uuid / traversal → 404");

// API: ZIP + CSV
r = await pub(`${C}/submissions/${up.id}/download`);
const czip = Buffer.from(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("content-type") === "application/zip" && czip.subarray(0, 2).toString() === "PK", "client API: ZIP of all screenshots");
ok(["skytrax_form_1.jpg", "confirmation.png", "thanks page.webp"].every((n) => czip.toString("latin1").includes(n)), "client API: ZIP contains all 3 originals");
r = await pub(`${C}/export?status=pending`);
const ccsv = Buffer.from(await r.arrayBuffer()).toString("utf8"); // not .text(): that would strip the BOM
ok(r.status === 200 && (r.headers.get("content-type") || "").includes("text/csv") && ccsv.startsWith("﻿") && ccsv.includes("riya_survey.png"), "client API: CSV export respects filters");
ok(!ccsv.includes("Admin Remarks") && !ccsv.includes("Matches Skytrax") && ccsv.includes("/api/client/files/") && !ccsv.includes("/api/files/"), "client API: CSV has no admin column and links to the public files route");

// write methods are refused with 405 (and change nothing)
for (const p of [`${C}/submissions`, `${C}/submissions/${up.id}`, `${C}/submissions/${up.id}/download`, `${C}/analytics`, `${C}/export`, `${C}/files/${cs.id}`]) {
  const codes = [];
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) codes.push((await pub(p, { method: m, headers: jh, body: m === "DELETE" ? undefined : "{}" })).status);
  ok(codes.every((c) => c === 405), `client API: POST/PUT/PATCH/DELETE ${p.replace(up.id, ":id").replace(cs.id, ":id")} → 405`);
}
ok((await req(`/api/submissions/${up.id}`)).status === 200 && (await list("")).total === 3, "client API: write attempts changed nothing");

// the admin side is untouched
ok((await pub("/api/submissions")).status === 401 && (await pub(`/api/submissions/${up.id}`)).status === 401, "admin API still 401 without a session");
ok((await pub(`/api/files/${cs.id}`)).status === 401 && (await pub(`/api/files/${cs.id}?v=thumb`)).status === 401, "admin file route still 401 without a session");
ok((await pub("/api/export")).status === 401 && (await pub("/api/analytics")).status === 401 && (await pub(`/api/submissions/${up.id}/download`)).status === 401, "admin export/analytics/ZIP still 401 without a session");
ok((await pub("/api/admins")).status === 401, "admin user-management API still 401 without a session");
for (const p of ["/", "/upload", "/settings", "/submissions", "/analytics", `/submissions/${up.id}`]) {
  r = await pub(p);
  ok(r.status === 307 && loc(r).includes("/login"), `admin page ${p} still redirects to /login`);
}
r = await pub("/login");
ok(r.status === 200, "/login still renders");

// unknown paths never expose data
for (const p of [`/${SLUG}x`, `/x${SLUG}`, "/wrong-slug", "/wrong-slug/submissions", `/wrong-slug/submissions/${up.id}`, `/${SLUG.toUpperCase()}x`]) {
  r = await pub(p);
  ok(r.status === 307 && loc(r).includes("/login"), `unknown path ${p} → /login, no data`);
}
r = await pub("/client-view");
ok(r.status === 404, "internal /client-view path is not reachable directly");
r = await pub(`/client-view/submissions/${up.id}`);
ok(r.status === 404 && !(await r.text()).includes(up.submission_id), "internal /client-view/submissions/:id is not reachable directly");

// robots
r = await pub("/robots.txt");
const robots = await r.text();
ok(r.status === 200 && /Disallow:\s*\/\s*$/m.test(robots), "robots.txt: Disallow: /");
ok(!robots.includes(SLUG), "robots.txt does not reveal the client slug");

// --- delete
const toDel =(await list("q=riya")).rows[0];
const shotId = toDel.first_shot_id;
ok((await req(`/api/submissions/${toDel.id}`, { method: "DELETE" })).status === 200, "delete submission");
ok((await req(`/api/submissions/${toDel.id}`)).status === 404, "deleted submission gone");
ok((await req(`/api/files/${shotId}`)).status === 404, "deleted screenshot gone");

// --- admins
r = await req("/api/admins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Ops Desk", email: "ops@example.com", password: "short" }) });
ok(r.status === 400, "weak admin password rejected");
r = await req("/api/admins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Ops Desk", email: "ops@example.com", password: "OpsDeskPass2026" }) });
const newAdmin = await r.json();
ok(r.status === 201, "add admin");
ok((await req("/api/admins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Dup", email: "ops@example.com", password: "OpsDeskPass2026" }) })).status === 409, "duplicate admin rejected");
const opsLogin = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "ops@example.com", password: "OpsDeskPass2026" }) });
const opsCookie = (opsLogin.headers.get("set-cookie") || "").split(";")[0];
ok(opsLogin.status === 200, "new admin can sign in");
ok((await req(`/api/admins/${newAdmin.id}`, { method: "DELETE" })).status === 200, "remove admin");
ok((await fetch(BASE + "/api/submissions", { headers: { cookie: opsCookie } })).status === 401, "removed admin's existing session is revoked immediately");

// --- logout
r = await req("/api/auth/logout", { method: "POST" });
ok(r.status === 303 && (r.headers.get("set-cookie") || "").includes("Max-Age=0"), "logout clears cookie");

// --- rate limiting (last: it exhausts this IP's ZIP/CSV allowance for a minute)
{
  const codes = [];
  for (let i = 0; i < 14; i++) codes.push((await pub(`${C}/export?status=rejected`)).status);
  const limited = await pub(`${C}/export`);
  ok(codes.includes(200) && codes.includes(429) && limited.status === 429, `client API: CSV/ZIP limited to 10/min per IP (statuses: ${[...new Set(codes)].join(",")})`);
  ok(!!limited.headers.get("retry-after") && (await limited.json()).error.includes("Too many"), "client API: 429 carries Retry-After and a JSON error");
  ok((await pub(`${C}/submissions`)).status === 200, "client API: normal browsing bucket is independent of the heavy one");
}

console.log(`\n${pass} passed, ${fail} failed`);
