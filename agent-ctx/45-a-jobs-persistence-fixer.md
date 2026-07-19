# Task 45-a — Jobs Persistence Fix + Mock Data Audit

**Agent:** Main (Architect)
**Task:** Audit ALL dashboard views for mock data, then fix the Jobs persistence issue (jobs stored in-memory, lost on server restart).

---

## Phase 1 — AUDIT (exhaustive)

For each view in `src/components/dashboard/views/` + key dashboard sub-components, the data source is reported. **MOCK** = hardcoded numbers/arrays in the file. **API** = `fetch()` to a real endpoint. **DB** = direct Prisma call. **EMPTY** = imports from `dashboard-data.ts` / `mock-data.ts` which are now empty arrays (graceful empty state, but the underlying source is still mock-shaped).

| # | File | What it shows | Source | Hardcoded values (if mock) |
|---|------|---------------|--------|----------------------------|
| 1 | `views/business-intel-view.tsx` (898 lines) | KPIs (38 862 entreprises), forecasts, sectors, communes, cities, top companies, growth, quality dimensions, Power BI schema | **MOCK** | `biKpis` (6 entries: "38 862", "+4 283", "78/100", "84.2%", "6/6", "12 communes"), `forecastData`, `sectorData` (10 sectors with counts/growth/quality/revenue), `communeData` (8 communes), `cityData` (8 cities), `topCompanies` (10 companies), `growthData` (random), `qualityDimensions` (7 dims), `powerBISchema` (5 tables with row counts) |
| 2 | `analytics/analytics-dashboard.tsx` (128 lines) | Greeting + KPIs + charts + heatmap + activity + exports + realtime | **WRAPPER** — composes sub-components | "38 862 entreprises" hardcoded in export banner text |
| 3 | `analytics/kpi-cards.tsx` (112 lines) | 6 KPI cards (entreprises, jobs, sources, dédup, enrichissement, appels API) | **EMPTY** — `dashboardKpis` is `[]` | Renders nothing (empty array → no cards) |
| 4 | `analytics/charts.tsx` (307 lines) | Volume scraping 30j (area), secteurs (pie), communes (bar), qualité (radar), évolution qualité (line), perf sources (bar) | **EMPTY** — `scrapingTimeseries30d`, `sectorDistribution`, `communeDistribution`, `qualityRadar`, `qualityEvolution`, `sourcePerformance` all `[]` | Renders empty charts |
| 5 | `analytics/geographic-heatmap.tsx` (196 lines) | Heatmap Abidjan 10 communes | **EMPTY** — `communeDistribution` is `[]` | Shows "0 entreprises" |
| 6 | `analytics/activity-alerts.tsx` (240 lines) | Live activity feed + alerts | **EMPTY** — `recentActivities`, `dashboardAlerts` both `[]` | Empty states |
| 7 | `analytics/exports-leaderboard.tsx` (245 lines) | Exports history + top companies + realtime stats | **EMPTY** — `exportHistory`, `topCompanies`, `realtimeStats` all empty/zeros | All values 0 |
| 8 | `analytics/dashboard-header.tsx` (254 lines) | Header with org name, quota API, notifications, theme toggle | **API** — `/api/me` (org name) + `/api/v1/quota` (real quota: apiCalls/companies/exports/users) + `dashboardAlerts` (empty) | Quota label dynamic ("0 / 25k" when DB empty) ✓ |
| 9 | `analytics/command-palette.tsx` (246 lines) | ⌘K palette | **EMPTY** — `searchableItems` is `[]` | No results |
| 10 | `views/jobs-view.tsx` (575 lines) | Jobs list + detail + events + results + cancel + CSV export | **API** — `/api/scraper/jobs`, `/api/scraper/jobs/[id]`, `DELETE`, `?format=csv` | Real data ✓ |
| 11 | `views/scraper-view.tsx` | Multi-engine scraper (Google Maps, Facebook, Business, Website, AI Cleaner) | **API** — `/api/scraper/google-maps`, `/api/scraper/jobs/[id]`, `/api/scraper/facebook`, `/api/scraper/business`, `/api/scraper/website`, `/api/scraper/ai-cleaner` | Real data ✓ |
| 12 | `views/sources-view.tsx` (143 lines) | 4 KPI cards + sources list | **EMPTY** — `dataSources` is `[]` (from `mock-data.ts`) | Shows "0 sources", "0 actives", "0.0k", "—%" |
| 13 | `views/exports-view.tsx` (147 lines) | 3 KPI cards + exports list | **MOCK** | `mockExports` (5 hardcoded exports: exp-001..exp-005 with filenames, sizes, dates, users). KPIs hardcoded: "68 / 100", "2.7 Go", "12 829" |
| 14 | `views/export-engine-view.tsx` (597 lines) | Export engine with format/columns/filters selection + history | **API** — `/api/export`, `/api/export/bulk`, `/api/export/[id]` | Real data ✓ |
| 15 | `views/team-view.tsx` (217 lines) | Org info + members list + RBAC matrix | **PARTIAL** — `team` is `[]` (empty mock); org name from `/api/me` | Shows "0 membres", empty state. RBAC matrix is hardcoded config (OK — that's reference data) |
| 16 | `views/back-office-view.tsx` (1920 lines) | 9 tabs: users, subscriptions, logs, API, quota, payments, stats, maintenance, audit | **MOSTLY MOCK** — `usersData` is `[]` (cleaned), but `logsData` (15 entries), `apiKeysData` (4 keys), `apiUsageData` (7 days), `quotaData` (4 items with "124 500/100 000", "38 862/50 000", "68/100", "156/200"), `quotaHistory7d`, `quotaBySource`, `paymentsData` (8 payments), `revenue6m`, `stats30d`, `companiesGrowth`, `scrapingBySource`, `topSectors`, `auditData` (15 entries) ALL HARDCODED |
| 17 | `views/security-view.tsx` (534 lines) | Security overview, rate limiting, WAF, DDoS, captcha, events, audit, encryption, RGPD, API protection | **API** — `/api/v1/security` (overview, events, audit, waf, ddos, gdpr) | Real (in-memory counters in security-module) ✓ |
| 18 | `views/queue-monitoring-view.tsx` (459 lines) | Queue metrics, workers, throughput | **API** — `/api/v1/queue` (metrics + workers) | Real ✓ |
| 19 | `views/saas-view.tsx` (575 lines) | Plans, licenses, quota, API keys, billing | **API** — `/api/v1/saas` (overview, quota, api-keys, billing) | Real (DB-backed) ✓ |
| 20 | `views/notifications-view.tsx` (1582 lines) | Notifications, alerts, reports | **API** — `/api/v1/notifications`, `/api/v1/notifications/stats`, `/api/v1/alerts`, `/api/v1/alerts/check`, `/api/v1/reports`, `/api/v1/reports/[id]/run`, `/api/v1/reports/[id]/executions` | Real ✓ |
| 21 | `views/api-docs-view.tsx` (860 lines) | OpenAPI explorer, try-it, Swagger UI iframe | **API** — `/api/v1` (spec), `/api/v1/docs/ui` (Swagger) | Real ✓ |
| 22 | `views/dashboard-home.tsx` (108 lines) | Old dashboard layout (KPI + search + charts + map + jobs + sources + results) | **WRAPPER** — composes old components. Imports `companies` from `mock-data` (empty) but doesn't render it directly | Type-only import |
| 23 | `kpi-cards.tsx` (legacy, 100 lines) | 6 KPI cards | **EMPTY** — `kpis` from `mock-data` is all zeros | Renders "0", "0", "0", "0%", "0%", "0.0k" |
| 24 | `jobs-list.tsx` (legacy, 119 lines) | Jobs list (small card) | **EMPTY** — `scrapingJobs` is `[]` | Renders nothing |
| 25 | `sources-list.tsx` | Sources list | **EMPTY** — `dataSources` is `[]` | Renders nothing |
| 26 | `charts.tsx` (legacy) | Old charts | **EMPTY** — `scrapingTrend`, `sectorDistribution`, `communeDistribution`, `dedupStats` all empty/zeros | Empty charts |
| 27 | `header.tsx` (legacy, dead code — not imported anywhere) | Header with quota | **MOCK** | Hardcoded "68 / 100 k" (NOT used — `page.tsx` uses `analytics/dashboard-header.tsx` instead) |
| 28 | `results-table.tsx` | Companies results table | **EMPTY** — `companies` is `[]` | Empty table |
| 29 | `map-view.tsx` | Abidjan map | **EMPTY** — `companies` is `[]` (only `communes` is reference data) | Empty markers |

### Auxiliary files

| File | Status |
|------|--------|
| `src/lib/dashboard-data.ts` | All arrays EMPTY by design (Task 35 cleaned mocks). Types preserved. Used by ~7 analytics components. |
| `src/lib/mock-data.ts` | All arrays EMPTY by design (Task 35 cleaned mocks). Types + reference data (`communes`, `sectors`, `cities`) preserved. Used by ~15 legacy dashboard components. |
| `src/app/api/v1/quota/route.ts` | **REAL** — DB-backed (QuotaUsage + License + counts). Returns `{ apiCalls: { used, limit, percentage }, companies, exports, users }`. Powers the dynamic quota badge in `dashboard-header.tsx`. |

### Critical findings (the 3 user-reported issues)

1. **Jobs not recorded** → FIXED in Phase 2 (see below). Was caused by `job-store.ts` using `globalThis.__scraperJobs` (in-memory only).
2. **Business Intelligence still has mock data** → CONFIRMED. `business-intel-view.tsx` has 8 hardcoded arrays (`biKpis`, `forecastData`, `sectorData`, `communeData`, `cityData`, `topCompanies`, `growthData`, `qualityDimensions`) + `powerBISchema` with fake row counts (38 862 companies, 4 821 jobs, 12 450 audit logs). Not fixed in this task — would require building aggregation endpoints.
3. **API quota not dynamic** → ALREADY FIXED in active codebase. `analytics/dashboard-header.tsx` (the ACTIVE header used by `page.tsx`) fetches `/api/v1/quota` and renders the real `{used} / {limit}` with color-coded percentage. The legacy `dashboard/header.tsx` still has "68 / 100 k" but is dead code (not imported anywhere). The `back-office-view.tsx` has hardcoded `quotaData` ("124 500/100 000") but that's a separate admin view, not the main header.

---

## Phase 2 — JOBS PERSISTENCE FIX

### Schema added

**File:** `prisma/schema.prisma` (lines 533-570)

```prisma
model ScrapeJobRecord {
  id                 String    @id @default(cuid())
  jobId              String    @unique              // in-memory job ID (scrape-xxxx)
  organizationId     String?                        // null = global/OWNER-only
  userId             String?
  keyword            String
  city               String?
  commune            String?
  neighborhood       String?
  status             String    @default("queued")   // queued|running|completed|failed|cancelled
  progress           Int       @default(0)          // 0-100
  resultsCount       Int       @default(0)
  processedCount     Int       @default(0)
  duplicatesDetected Int       @default(0)
  errors             String    @default("[]")       // JSON array
  duration           Int?                           // ms
  startedAt          DateTime  @default(now())
  completedAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([organizationId])
  @@index([status])
  @@index([userId])
  @@index([createdAt])
}
```

Applied with `bun run db:push` (34ms, 0 errors) + `bun run db:generate` (Prisma client regenerated).

### Files modified

#### 1. `src/lib/scraper/job-store.ts` (rewritten, 625 lines)

**Hybrid store: in-memory (live) + DB (history).**

- In-memory `Map<jobId, JobState>` kept for: Playwright instance, last 50 events, `currentPlace`, live progress. Wiped on restart (intentional — Playwright can't be serialized).
- DB `ScrapeJobRecord` kept for: status, progress, resultsCount, duration, errors, timestamps. **Survives restart.**

New / changed functions:
- `startScrapeJob(jobId, query)` — now **creates a `ScrapeJobRecord`** in DB BEFORE launching Playwright. If DB write fails, the in-memory job still runs (best-effort).
- Event listener — on `start` / `progress` / `place-extracted` / `complete` / `cancelled` / `error` / `block-detected`, updates both in-memory state AND DB record. Progress updates are **debounced** (1s) to avoid saturating the DB.
- On `scraper.scrape()` resolve: updates DB with final `status`, `resultsCount`, `duration`, `completedAt`, `errors`.
- On `scraper.scrape()` reject: marks DB record as `failed` with error message.
- **`listJobsFromDB(filters)`** — reads from DB, returns array with optional `live` field (phase, currentPlace, errors, eventsCount) if the job is still in memory. Multi-tenant filter by `organizationId`.
- **`getJobFromDB(jobId)`** — reads single record from DB, merges with in-memory `events` + `result` if available.
- **`cancelJobInDB(jobId)`** — marks DB record as `cancelled` (used when the in-memory state is gone but DB still says "running").
- `cancelJob(jobId)` — now also updates DB record to `cancelled` (in addition to in-memory).
- `deleteJob(jobId)` — clears debounce timer + removes from in-memory Map. DB history preserved (audit).
- `cleanupOldJobs()` — clears debounce timers for cleaned jobs.

#### 2. `src/app/api/scraper/jobs/route.ts` (rewritten)

- **Auth required** (`requireApiAuth`) — was previously unauthenticated.
- **Multi-tenant**: OWNER sees all jobs; non-OWNER sees only their org's jobs.
- Reads from **DB** via `listJobsFromDB({ organizationId, limit })` — survives restarts.
- Returns `{ jobs: [...], total }` with full DB fields + optional `live` state.

#### 3. `src/app/api/scraper/jobs/[id]/route.ts` (rewritten)

- **Auth required** + **multi-tenant** (404 if cross-tenant, no leak).
- `GET` — reads from DB via `getJobFromDB(id)`, merges with live in-memory `events` + `result` if available. Supports `?format=csv` (export from in-memory live result).
- `DELETE` — cancels via in-memory `cancelJob()` first; if that fails (server restarted), falls back to `cancelJobInDB()`. Supports `?purge=true` (clears in-memory only, DB history preserved).

#### 4. `src/app/api/scraper/google-maps/route.ts` (unchanged — already correct)

- Already calls `startScrapeJob(jobId, query)` which now creates the DB record.
- Already threads `organizationId` + `userId` into the query (Task 41).

### How jobs now persist

```
POST /api/scraper/google-maps
   └─ startScrapeJob(jobId, query)
       ├─ db.scrapeJobRecord.create({ status: "queued" })  ← PERSIST
       ├─ new GoogleMapsScraper(...)
       ├─ scraper.on(event => {
       │     update in-memory state
       │     updateJobRecord() or debouncedProgressUpdate()  ← PERSIST (live)
       │  })
       └─ scraper.scrape()
           .then(result => updateJobRecord({ status: "completed", duration, ... }))  ← PERSIST
           .catch(err => updateJobRecord({ status: "failed", errors: [...] }))  ← PERSIST

GET /api/scraper/jobs
   └─ listJobsFromDB({ organizationId })
       └─ db.scrapeJobRecord.findMany({ orderBy: createdAt desc })
           + merge live in-memory state (phase, currentPlace) if present

GET /api/scraper/jobs/[id]
   └─ getJobFromDB(id)
       └─ db.scrapeJobRecord.findUnique({ where: { jobId } })
           + merge live in-memory events + result if present

DELETE /api/scraper/jobs/[id]
   ├─ cancelJob(id)  (in-memory: scraper.cancel() + status=cancelled)
   └─ updateJobRecord({ status: "cancelled", completedAt })  ← PERSIST
```

---

## Phase 3 — VERIFICATION

### Lint

```bash
$ bun run lint
$ eslint .
# exit 0, 0 errors, 0 warnings ✓
```

### Standalone script verification

`scripts/verify-jobs-persistence.ts` — 7-step end-to-end test (no HTTP server needed):

```
[1/7] Inserting ScrapeJobRecord directly (status=queued)...          ✓
[2/7] Calling listJobsFromDB() — should include the test job...      ✓ (found in list)
[3/7] Calling getJobFromDB() — should return full record...         ✓ (events=0, live=null)
[4/7] Simulating server restart: clearing in-memory Map...           ✓ (Map cleared)
[5/7] Calling listJobsFromDB() again — should STILL return job...   ✓ (survived restart, live=null)
[6/7] Calling getJobFromDB() again — should STILL return record...  ✓ (live=null correct)
[7/7] Calling cancelJobInDB() — should mark as cancelled...         ✓ (status=cancelled)
Bonus: testing multi-tenant filter...                                ✓ (org-1 sees only org-1, org-2 sees only org-2)
✓ ALL CHECKS PASSED
```

### curl verification (live server)

Server started with `bun run dev` (Next.js 16 production mode, port 3000).

**Login as OWNER** (`admin@prisiv.biz / AdminProd2026!`):
```
POST /api/auth/login → 200, role=OWNER, orgId=cmrpp5vgm001qsndx5iaem2rr ✓
```

**Before launching**:
```
GET /api/scraper/jobs → {"jobs":[],"total":0} ✓
```

**Launch a job**:
```
POST /api/scraper/google-maps {"keyword":"restaurant","city":"Abidjan","maxResults":3}
→ 202, jobId="scrape-b878a367", status="queued" ✓
```

**List jobs immediately after launch**:
```
GET /api/scraper/jobs → {"jobs":[{"id":"scrape-b878a367","status":"running","progress":15,
  "live":{"phase":"searching","eventsCount":3}}],"total":1} ✓
```

**Wait 30s for completion**:
```
GET /api/scraper/jobs → {"jobs":[{"id":"scrape-b878a367","status":"completed","progress":100,
  "resultsCount":3,"processedCount":3,"duration":36381,
  "completedAt":"2026-07-19T14:22:53.371Z",
  "live":{"phase":"done","currentPlace":"Parenthèse","eventsCount":15}}],"total":1} ✓
```

**RESTART THE SERVER** (`pkill -9 next-server` + `bun run dev`):
```
HTTP /api/health → 200 (server back up in 556ms) ✓
```

**Verify job survived restart**:
```
GET /api/scraper/jobs → {"jobs":[{"id":"scrape-b878a367","status":"completed","progress":100,
  "resultsCount":3,"duration":36381,"completedAt":"2026-07-19T14:22:53.371Z",
  "live":null}],"total":1} ✓
```
- `live: null` is correct (in-memory state was wiped on restart — Playwright instance is gone)
- All DB fields intact: status, progress, resultsCount, duration, startedAt, completedAt ✓

**Detail endpoint after restart**:
```
GET /api/scraper/jobs/scrape-b878a367 → {"id":"...","status":"completed","progress":100,
  "resultsCount":3,"duration":36381,"errors":[],"events":[],"live":null} ✓
```
- `events: []` is correct (in-memory events wiped on restart — they were never persisted, by design)
- DB-persisted fields all intact ✓

**Cancel flow on a NEW running job**:
```
POST /api/scraper/google-maps {"keyword":"pharmacie","maxResults":2}
→ 202, jobId="scrape-98edb0f3" ✓
GET /api/scraper/jobs/scrape-98edb0f3 → status="running", progress=5, live.phase="init" ✓
DELETE /api/scraper/jobs/scrape-98edb0f3 → {"success":true,"message":"Job annulé"} ✓
GET /api/scraper/jobs/scrape-98edb0f3 → status="cancelled", completedAt set,
  events include {"type":"cancelled"} ✓
```

**Quota endpoint** (issue #3 verification):
```
GET /api/v1/quota → {"success":true,"data":{"plan":"starter","planName":"Starter",
  "apiCalls":{"used":0,"limit":25000,"percentage":0},
  "companies":{"used":0,"limit":5000,"percentage":0},
  "exports":{"used":0,"limit":30,"percentage":0},
  "users":{"used":1,"limit":3,"percentage":33.3}}} ✓
```

**Cleanup**: 2 test jobs deleted from DB; DB back to 0 jobs.

---

## Summary

- **Audit**: 29 views/components reviewed. 3 critical findings: (1) Jobs persistence — FIXED; (2) BI view mock data — REPORTED (not fixed, would require aggregation endpoints); (3) API quota — already dynamic in active header.
- **Jobs fix**: 1 schema added (`ScrapeJobRecord`), 3 files modified (`job-store.ts`, `jobs/route.ts`, `jobs/[id]/route.ts`), 1 file unchanged (`google-maps/route.ts` — already correct). Jobs now persist to DB on launch, update on every event (debounced), and survive server restarts.
- **Lint**: 0 errors, 0 warnings ✓
- **Verification**: standalone script (7/7 checks pass) + curl end-to-end (launch → list → restart → list → detail → cancel — all pass) ✓
- **Work record**: written to `/home/z/my-project/agent-ctx/45-a-jobs-persistence-fixer.md`.
