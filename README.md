# Skytrax Survey Campaign – Delhi Airport Admin Dashboard

Next.js 15 (App Router) · PostgreSQL · S3-compatible storage (Supabase Storage / R2 / AWS) · Tailwind 4 · Recharts.

## What's included

| Area | Details |
|---|---|
| **Overview** | Total submissions, unique emails, screenshots, today (IST), this month, last submission, 30-day trend, status split, latest 8 |
| **All Submissions** | Server-side pagination (10/25/50/100), search (all fields / email / name / filename / submission ID), status + date-range filters, newest/oldest sort, thumbnails, full-size lightbox, delete with confirmation, **CSV export of every row matching the current filters** (Excel-ready UTF-8, streamed in batches) |
| **Upload Submission** | Email (required), name, remarks, multiple screenshots, drag & drop, real upload progress bar, cancel, per-file errors |
| **Submission details** | All fields, every screenshot at natural aspect ratio, Approve / Reject / back to Pending, admin remarks, download original, delete |
| **Analytics** | Presets + custom range, daily/weekly/monthly trends, by-date status bars, approved vs pending vs rejected, time-of-day, daily breakdown table |
| **Client (viewer) accounts** | Read-only logins for the client (DIAL/GMR team): Overview, All Submissions, Analytics, screenshot viewer, **download** single screenshot / all screenshots of a submission as **ZIP** / **CSV export**. No upload, review, delete or settings. Internal admin remarks and staff names are hidden. |
| **Public client link** | `https://<domain>/delhiairportclient` opens a **no-login, read-only** view of Overview, All Submissions (search, filters, sort, pagination, thumbnails), submission detail, screenshot viewer and Analytics, with downloads (single screenshot, ZIP per submission, CSV). See [Public client link](#public-client-link-no-login). |
| **Users & settings** | List users, add Admin or Client (view-only) user, remove user (session revoked instantly), change own password |

### How it works
1. The campaign team fills the third-party survey form and takes the screenshot as proof.
2. An **admin** logs in and records it under **Upload Submission** (respondent email + screenshots). **No emails are sent to anyone.**
3. The **client** logs in with a **viewer** account and sees the data immediately: counts, filters, screenshots; they can download screenshots, a ZIP per submission, and the CSV.
Viewer restrictions are enforced on the server (every write/management API returns 403 for viewers), not just hidden in the UI. Create client logins from *Users & settings* or with `npm run admin:create -- "Name" email "password" viewer`.

### Public client link (no login)

Anyone who opens `https://<your-domain>/<CLIENT_VIEW_SLUG>` (default `/delhiairportclient`) gets the client dashboard directly: no login page, no cookie. Sub-pages: `/<slug>/submissions`, `/<slug>/submissions/<id>`, `/<slug>/analytics`. It is strictly read-only: no upload, review, delete, settings, login or logout anywhere.

> ⚠️ **This link is public to anyone who has the URL.** There is no password. The default slug is easy to guess, so **set `CLIENT_VIEW_SLUG` to a long random string in production** (e.g. `openssl rand -hex 16` → `https://<domain>/9f2c…`) and share only that link with the client. Rotating it (change the env var, redeploy) instantly invalidates the old link. If the client needs per-user access, keep using the login-based `viewer` accounts, which still work unchanged.

How it works
- `middleware.ts` rewrites `/<slug>/…` to the internal `app/client-view/…` routes. The slug is read from the environment, so it changes with **no code change**. If `CLIENT_VIEW_SLUG` is empty/unset (or invalid / a reserved path like `login`, `api`), the default `delhiairportclient` is used. Any other unknown path still goes to the normal admin login. The internal `/client-view` path is not reachable directly.
- The pages reuse the admin components and views (`OverviewView`, `SubmissionsListView`, `SubmissionDetailView`, `FilterBar`, `SubmissionsTable`, `Lightbox`, `AnalyticsView`, charts); they take `basePath` (`/<slug>`) and `apiBase` (`/api/client`) props, which default to the admin values (`""`, `/api`).
- Data comes from a **separate read-only API** under `/api/client/*`. The admin `/api/*` routes and their auth are untouched and still return 401 without a session.

| Endpoint (GET only) | Returns |
|---|---|
| `/api/client/submissions` | list (same filters as admin: `q`, `field`, `status`, `from`, `to`, `sort`, `page`, `pageSize`) |
| `/api/client/submissions/:id` | detail (allow-listed fields only) |
| `/api/client/submissions/:id/download` | ZIP of all original screenshots |
| `/api/client/analytics` | analytics (`from`, `to`) |
| `/api/client/export` | CSV of rows matching the filters (no admin-remarks column) |
| `/api/client/files/:screenshotId` | original · `?v=thumb` thumbnail · `?dl=1` download. Only existing submission screenshots are served (looked up by `uploaded_screenshots.id`). |

- POST / PUT / PATCH / DELETE on `/api/client/*` return **405**.
- Responses **never** contain `admin_remarks`, `created_by` / `reviewed_by` (ids or names) or storage keys; the detail response is built from an explicit allow-list (`toPublicSubmission` in `lib/client-api.ts`).
- **Rate limiting** per client IP (in-memory, per server instance → HTTP 429 + `Retry-After`): 120 req/min for list/detail/analytics, **10 req/min for ZIP and CSV**, and 600 req/min for screenshot/thumbnail files (a 100-row page alone loads 100 thumbnails, so the 120/min bucket would break normal browsing). Override with `CLIENT_RATE_API`, `CLIENT_RATE_FILES`, `CLIENT_RATE_HEAVY`. On serverless hosts each instance counts separately, so treat it as abuse protection, not a hard global quota. The IP is taken from `X-Forwarded-For` / `X-Real-IP`, which Vercel and most reverse proxies set for you.
- **Privacy / SEO:** pages and API responses send `X-Robots-Tag: noindex, nofollow, noarchive`; pages have `<meta name="robots" content="noindex, nofollow">`; API JSON is `Cache-Control: private, no-store`. `/robots.txt` is `Disallow: /` for the whole site rather than naming the slug, because robots.txt is public and listing the slug there would reveal it.

### Security
- Passwords hashed with **bcrypt (cost 12)**; never stored or logged in plain text.
- Session = signed JWT in an **HttpOnly, SameSite=Lax, Secure** cookie (12 h default). Every request re-checks the admin still exists.
- All pages gated by middleware; **every API route checks the session itself**.
- Login brute-force guard (8 failures / 15 min per IP+email), constant-time response for unknown emails.
- CSRF: state-changing calls require same Origin.
- Uploads: type detected from **file bytes** (not extension/MIME), decoded with sharp to confirm it's a real image, size + count limits, random storage names, original name stored separately. Whole submission is atomic — if any file fails, nothing is saved and already-written files are cleaned up.
- Screenshots are **private**: served only through `/api/files/:id` after auth (local) or via 5-minute presigned URLs (S3).
- CSV export guards against formula injection.

### Performance (tested with 300,000 submissions)
| Request | Time |
|---|---|
| Submissions page 1 | ~40 ms |
| Last page (page 3,000 of 100) | ~230 ms |
| Email / filename search (trigram index) | ~15 ms |
| Overview page | ~0.6 s |
| Analytics | ~0.5 s |
| Full CSV export, 300k rows | ~5 s, streamed |

Indexes: `(created_at, id)`, `(status, created_at, id)`, `lower(email)`, trigram GIN on email, name and filename. Thumbnails are 480 px WEBP (a 1170×2532 phone screenshot → ~5–20 KB); originals load only on View/Download.

## Setup

```bash
npm install
cp .env.example .env.local      # fill in values (see below)
npm run db:migrate              # creates tables + indexes (safe to re-run)
npm run admin:create -- "Admin Name" admin@example.com "a-strong-password"            # full admin
npm run admin:create -- "DIAL Client" client@example.com "a-strong-password" viewer   # read-only client login
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. On Supabase use the **Session pooler** URI (Project Settings → Database). |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 48` |
| `STORAGE_DRIVER` | ✅ | `s3` (production) or `local` (single VPS only) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` | when `s3` | see below |
| `STORAGE_LOCAL_DIR` | when `local` | default `./storage` |
| `MAX_UPLOAD_MB` / `MAX_FILES_PER_SUBMISSION` | | default 10 / 10 |
| `SESSION_HOURS` | | default 12 |
| `CLIENT_VIEW_SLUG` | | path of the public no-login client view; default `delhiairportclient`. **Use a long random string in production.** |
| `CLIENT_RATE_API` / `CLIENT_RATE_FILES` / `CLIENT_RATE_HEAVY` | | per-IP requests/min for the public API: default 120 / 600 / 10 (heavy = ZIP + CSV) |

### Supabase Storage (S3)
1. Storage → **New bucket** `survey-screenshots` → keep it **Private**.
2. Storage → Settings → **S3 Connection** → enable; copy *Endpoint* and *Region*; create an access key pair.
3. Set `STORAGE_DRIVER=s3` and the five `S3_*` values. (Cloudflare R2 / AWS S3 / Hetzner work the same way.)

## Deploy

**Vercel**: import the repo, add the env vars (including `CLIENT_VIEW_SLUG`: Project → Settings → Environment Variables, then redeploy so the middleware picks it up), use `STORAGE_DRIVER=s3`. Note Vercel caps request bodies at ~4.5 MB, so set `MAX_UPLOAD_MB=4` and keep `MAX_FILES_PER_SUBMISSION` low, or deploy on a VPS for larger batches.

**VPS / Docker (Hetzner etc.)**: `npm run build && npm start` (or use the `.next/standalone` output behind nginx/Caddy with HTTPS). Set nginx `client_max_body_size 110m;`. `local` storage is fine here if the disk is backed up.

## Testing

```bash
BASE=http://localhost:3000 ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='...' node scripts/e2e-test.mjs
```
Runs ~150 checks against a live server (including the public client view: no-cookie access, `/api/client/*` data/ZIP/CSV/files, no admin fields in responses, 405 on writes, admin API still 401, unknown paths exposing nothing, robots headers and rate limiting; set `CLIENT_VIEW_SLUG` for the script too if the server uses a custom one): auth, upload (valid + every rejection path), byte-exact originals, thumbnail aspect ratio, search/filter/sort/pagination, review, analytics, export, delete + storage cleanup, admin management, logout. **Run it on a fresh/empty database** – it creates and deletes test records.
