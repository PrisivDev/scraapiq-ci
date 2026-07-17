# Task 21-rest-api — REST API Builder

## Task
Build complete REST API with CRUD, Swagger, JWT, pagination, filters, sorting, search, webhooks, versioning in the existing ScrapIQ CI Next.js 16 project.

## Work Log

- Read worklog.md, prisma/schema.prisma, src/lib/auth/*, src/middleware.ts, src/lib/db.ts to understand the existing context (auth system with JWT cookies, Bearer support already half-implemented at the route level, edge middleware blocking unauthenticated API calls).
- Added 4 new Prisma models to `prisma/schema.prisma`: `Company`, `RestApiLog`, `Webhook`, `WebhookDelivery`. Pushed schema with `bun run db:push` (also regenerated Prisma client).
- Created `src/lib/api/helpers.ts` with:
  - Types: `ApiResponse<T>`, `PaginationMeta`, `Filters`, `SortParams`
  - Parsers: `parsePagination` (page default 1, limit default 20 max 100), `parseFilters` (allow-list based + numeric `minRating`), `parseSort` (allow-list + asc/desc), `parseSearch` (q param)
  - Response helpers: `sendSuccess`, `sendError`, `buildPaginationMeta`
  - `logApiCall` — best-effort writes to `RestApiLog` table (swallows logging errors so they never affect the actual response)
  - `startTimer` — wraps `process.hrtime.bigint()` for ms-accurate timing
- Created `src/lib/api/auth-middleware.ts` with `requireApiAuth(req)`:
  - Tries `Authorization: Bearer <token>` first, then `scraapiq_access` cookie, then `X-API-Key` header
  - For JWT: verifies signature with `verifyAccessToken`, checks blacklist, loads user + memberships, computes effective permissions
  - For API keys: SHA-256 hashes the key, looks up in `ApiKey` table (only non-revoked, non-expired), updates `lastUsedAt`, derives the user from the key
  - Returns `{ user, apiKeyId?, error, status }`
- Created `src/lib/api/seed.ts` — `seedCompaniesIfEmpty()` — populates Company table with the 60+ records from `src/lib/geo-data.ts` on first GET (idempotent).
- Created `src/app/api/v1/route.ts` — `GET /api/v1` returns API info (name, version, auth methods, full endpoint list, features). Public.
- Created `src/app/api/v1/companies/route.ts` — `GET` (list with pagination+filters+sort+search, auto-seeds on first call) + `POST` (create with validation, 201 on success).
- Created `src/app/api/v1/companies/[id]/route.ts` — `GET` (404 if missing), `PUT` (partial update, allow-list of fields), `DELETE` (404 if missing, returns `{ id }`).
- Created `src/app/api/v1/webhooks/route.ts` — `GET` (list with `_count` of deliveries) + `POST` (validate URL via `new URL()`, require non-empty events array, auto-generate HMAC secret if not provided).
- Created `src/app/api/v1/webhooks/[id]/route.ts` — `PUT` (partial update, URL validation) + `DELETE`.
- Created `src/app/api/v1/webhooks/[id]/test/route.ts` — sends `test.ping` event with HMAC-SHA256 signature header, 10 s timeout via `AbortController`, records delivery in `WebhookDelivery` table with status code + truncated response body.
- Created `src/app/api/v1/docs/route.ts` — `GET` returns full OpenAPI 3.0.3 JSON spec (8 paths, 12 operations, schemas for Company/Webhook/PaginationMeta/Error, 3 security schemes: bearerAuth/apiKeyAuth/cookieAuth, dynamic base URL from request headers).
- Created `src/app/api/v1/docs/ui/route.ts` — `GET` returns an HTML page with custom ScrapIQ-branded topbar + Swagger UI bundle loaded from CDN (`swagger-ui-dist@5.18.2`).
- Updated `src/middleware.ts`:
  - Added public patterns: `/api/v1` and `/api/v1/docs` (+ `/ui`)
  - Allowed requests with `Authorization: Bearer` header OR `X-API-Key` header to bypass the cookie-only check (so programmatic API access works)
- Updated `src/lib/db.ts` — added a schema-mtime-based cache invalidation so that when the Prisma schema changes (db:push), the cached Prisma client in `globalThis.prisma` is detected as stale and recreated. Without this, the running dev server kept using the old client without the new `Company`/`RestApiLog`/`Webhook` models.
- Created `src/components/dashboard/views/api-docs-view.tsx` — comprehensive API explorer dashboard:
  - Header + 4 stat cards (endpoints, auth methods, rate limit, OpenAPI version)
  - Auth methods card (cookie, Bearer, API key) with examples
  - Two tabs: "Explorateur d'API" and "Swagger UI" (iframe)
  - Explorer: endpoints grouped by tag, expandable rows with method badges (color-coded GET/POST/PUT/DELETE), parameter list, "Try it" + "Path" buttons
  - Try-it panel: path params, query params, JSON body editor, final URL preview, cURL command with copy button, "Exécuter la requête" button → live fetch with cookies, response display with status badge + ms timing + JSON pretty-print
- Updated `src/components/dashboard/sidebar.tsx` — added `api` to `NavKey` type, added nav item `{ key: "api", label: "API REST", icon: Code, badge: "v1", section: "Administration" }`.
- Updated `src/app/page.tsx` — imported `ApiDocsView`, added `api` entry to `navTitles`, added routing block `{activeNav === "api" && <ApiDocsView />}`.
- Updated `src/lib/dashboard-data.ts` — added a `#api` entry to the command palette's `searchableItems` array.
- Encountered a Turbopack cache corruption mid-way ("Failed to write page endpoint /_app", "Unable to open static sorted file 00000319.sst"). Killed the dev server (PID 20318) and re-ran the init script (`curl https://z-cdn.chatglm.cn/fullstack/init-fullstack_1775040338514.sh | bash`) — the system restarted the dev server on a fresh PID and the API routes started returning data correctly.
- Final lint: `bun run lint` → 0 errors, 0 warnings.
- End-to-end curl tests all passed (see worklog Stage Summary for the full table).
- Verified via `agent-browser`: sidebar shows "API REST v1" entry in Administration section → clicking opens the ApiDocsView with all 12 endpoints grouped by tag → expanding an endpoint shows parameters + Try it button → Try it panel opens with URL preview + cURL → "Exécuter la requête" returns a live 200 response → Swagger UI tab loads the iframe from `/api/v1/docs/ui`.

## Stage Summary

### Files created
- `src/lib/api/helpers.ts` (response types + parsers + logApiCall + startTimer)
- `src/lib/api/auth-middleware.ts` (requireApiAuth: JWT cookie / Bearer / X-API-Key)
- `src/lib/api/seed.ts` (seedCompaniesIfEmpty)
- `src/app/api/v1/route.ts` (GET — API info)
- `src/app/api/v1/companies/route.ts` (GET list / POST create)
- `src/app/api/v1/companies/[id]/route.ts` (GET / PUT / DELETE)
- `src/app/api/v1/webhooks/route.ts` (GET list / POST create)
- `src/app/api/v1/webhooks/[id]/route.ts` (PUT / DELETE)
- `src/app/api/v1/webhooks/[id]/test/route.ts` (POST — send test event with HMAC)
- `src/app/api/v1/docs/route.ts` (GET — OpenAPI 3.0.3 JSON spec, dynamic)
- `src/app/api/v1/docs/ui/route.ts` (GET — Swagger UI HTML, CDN)
- `src/components/dashboard/views/api-docs-view.tsx` (full interactive API explorer + Swagger UI tab)

### Files modified
- `prisma/schema.prisma` (+ Company, RestApiLog, Webhook, WebhookDelivery models)
- `src/middleware.ts` (added /api/v1 and /api/v1/docs to public patterns + Bearer/X-API-Key bypass)
- `src/lib/db.ts` (schema-mtime-based Prisma client cache invalidation)
- `src/components/dashboard/sidebar.tsx` (added `api` NavKey + nav item in Administration section)
- `src/app/page.tsx` (imported ApiDocsView + routing)
- `src/lib/dashboard-data.ts` (added #api to command palette searchableItems)

### curl test results (all passed)
| # | Endpoint | Method | Auth | Status | Result |
|---|----------|--------|------|--------|--------|
| 1 | `/api/v1` | GET | public | 200 | API info (12 endpoints, 3 auth methods) |
| 2 | `/api/v1/companies` | GET | cookie | 200 | Paginated list (64 companies seeded, meta.page=1) |
| 3 | `/api/v1/companies` | GET | none | 401 | "Authentication required" (middleware) |
| 4 | `/api/v1/companies?q=orange` | GET | cookie | 200 | 2 matches (Orange CI - Agence Cocody, Orange CI - Agence Yopougon) |
| 5 | `/api/v1/companies?sector=Restauration` | GET | cookie | 200 | 5 matches, all sector=Restauration |
| 6 | `/api/v1/companies?sort=name&order=desc` | GET | cookie | 200 | Sorted desc: Yopougon Pharma, Yamoussoukro Hôtel, Yamoussoukro Commerce |
| 7 | `/api/v1/companies?page=2&limit=5` | GET | cookie | 200 | meta: page=2, limit=5, total=64, totalPages=13, hasNext=true, hasPrev=true |
| 8 | `/api/v1/companies?minRating=4.5` | GET | cookie | 200 | 22 companies with rating ≥ 4.5 |
| 9 | `/api/v1/companies?city=Bouaké` | GET | cookie | 200 | 4 matches, all city=Bouaké |
| 10 | `/api/v1/companies` | POST | cookie | 201 | Created with id=cmroejk48... |
| 11 | `/api/v1/companies/{id}` | GET | cookie | 200 | Returns full company object |
| 12 | `/api/v1/companies/{id}` | PUT | cookie | 200 | Updates rating/reviewCount/description |
| 13 | `/api/v1/companies/{id}` | DELETE | cookie | 200 | `{ id }` returned, message="Company deleted" |
| 14 | `/api/v1/companies/{id}` | GET | cookie | 404 | After delete → 404 NOT_FOUND |
| 15 | `/api/v1/companies/{nonexistent}` | GET | cookie | 404 | NOT_FOUND |
| 16 | `/api/v1/companies` | POST | cookie | 422 | "Le champ 'name' est requis" (empty body) |
| 17 | `/api/v1/companies` | GET | Bearer | 200 | Works with `Authorization: Bearer <jwt>` |
| 18 | `/api/v1/companies` | GET | X-API-Key invalid | 401 | "Invalid API key" |
| 19 | `/api/v1/docs` | GET | public | 200 | OpenAPI 3.0.3 spec, 8 paths |
| 20 | `/api/v1/docs/ui` | GET | public | 200 | HTML page with swagger-ui-bundle CDN |
| 21 | `/api/v1/webhooks` | GET | cookie | 200 | Empty array initially |
| 22 | `/api/v1/webhooks` | POST | cookie | 201 | Created with auto-generated secret |
| 23 | `/api/v1/webhooks/{id}` | PUT | cookie | 200 | isActive toggled to false |
| 24 | `/api/v1/webhooks/{id}/test` | POST | cookie | 200 | HTTP 200 from httpbin.org, delivery recorded |
| 25 | `/api/v1/webhooks/{id}` | DELETE | cookie | 200 | Webhook deleted |
| 26 | `/api/v1/webhooks` | POST | cookie | 422 | "URL invalide" for "not-a-url" |

### Audit log verification
Direct DB check after tests: `RestApiLog` had 28 entries with method/endpoint/statusCode/responseMs/userId correctly recorded (e.g. `GET /api/v1/companies -> 200 (5ms)`, `POST /api/v1/companies -> 422 (4ms)`).

### Lint status
`bun run lint` → **0 errors, 0 warnings**.

### Issues encountered and resolved
1. **Prisma client cache stale in dev**: After `bun run db:push`, the running Next.js dev server kept using the old `globalThis.prisma` instance that didn't have the new `Company`/`RestApiLog`/`Webhook` models. → Fixed by adding a schema-mtime hash check in `src/lib/db.ts` that recreates the client when the schema changes.
2. **Turbopack cache corruption**: Mid-development, the turbopack internal SST files got corrupted ("Unable to open static sorted file 00000319.sst / No such file or directory (os error 2)"). → Killed the dev server (PID 20318) and re-ran the fullstack init script, which restarted the dev server on a fresh PID with a clean cache.
3. **Bearer token requests blocked by edge middleware**: The middleware only checked for cookies, so `Authorization: Bearer` requests were 401'd before reaching the route handler. → Updated `src/middleware.ts` to also allow requests with a Bearer header or X-API-Key header to pass through to the route handler (the route-level `requireApiAuth` then validates the actual token).
