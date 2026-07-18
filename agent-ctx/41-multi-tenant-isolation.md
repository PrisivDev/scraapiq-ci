# Task 41 — Multi-Tenant Isolation

**Agent:** Multi-Tenant Isolation
**Task:** Implement org-scoped data isolation (ADMIN and below only see their org) + OWNER-only management tabs

## Summary

- RBAC: 5 nav keys (`api`, `backoffice`, `queue`, `security`, `pwa`) elevated from `ADMIN` → `OWNER`. ADMIN now only manages org-level tabs (team, notifications); platform-management tabs are OWNER-exclusive.
- Schema: `Company.organizationId String?` added (nullable — null = global/shared, visible OWNER only). Relation `Company.organization → Organization.companies` (onDelete: Cascade). Index `@@index([organizationId])`.
- DB: `bun run db:push` applied cleanly. Existing 0 companies preserved (column is nullable). Prisma client regenerated.
- New helper `src/lib/auth/tenant.ts`:
  - `getTenantContextFromRequest(req)` → returns `{ user, isOwner, filter, orgIdForCreate }`
  - `getTenantContext()` → same but via cookies (server components)
  - `buildCompanyFilter(user)` → returns `{}` for OWNER, `{ organizationId }` for others
  - `canAccessOrg(user, orgId)` → true if OWNER or `orgId === user.orgId`
- API endpoints updated:
  - `GET /api/v1/companies` — `where: buildCompanyFilter(auth.user)` spread in (OWNER sees all, non-OWNER sees only their org)
  - `POST /api/v1/companies` — OWNER: honors explicit `organizationId` (null = global, string = that org, undefined = own org). Non-OWNER: forced to `auth.user.orgId` (403 if no org).
  - `GET/PUT/DELETE /api/v1/companies/[id]` — `canAccessOrg()` check, returns 404 (not 403) for cross-tenant access to avoid leaking existence.
  - `GET /api/v1/agents/[id]` — auth added; non-OWNER can only view pipelines started in their own org.
  - `POST /api/v1/agents` — auth added; `config.organizationId` + `config.userId` threaded for future Company persistence.
  - `POST /api/scraper/google-maps` — auth added; `query.organizationId` + `query.userId` threaded into the job state.
- Type extensions (thread-through only — scrapers/orchestrator currently in-memory):
  - `SearchQuery.organizationId`, `SearchQuery.userId` (scraper/types.ts)
  - `PipelineConfig.organizationId`, `PipelineConfig.userId` (ai-agents/orchestrator.ts)
  - `PipelineState.config` mirrors tenant context for consumer-side isolation (GET /api/v1/agents/[id]).
- Stats/quota counts scoped to org:
  - `src/app/api/organization/details/route.ts` — `totalCompanies` now `count({ where: { organizationId } })`
  - `src/lib/saas/saas-engine.ts` — `buildQuota()` counts companies `where: { organizationId: orgId }` (excludes global)
- Prisma cache busting: enhanced `src/lib/db.ts` with `createRequire`-based cache invalidation — purges `node_modules/@prisma/client/*` and `node_modules/.prisma/client/*` from `require.cache` when `schema.prisma` mtime changes, forcing Turbopack to reload the freshly-generated client. Without this, the dev server kept the stale PrismaClient in memory and reported new fields as "Unknown argument".

## curl verification (cross-tenant isolation)

OWNER (admin@prisiv.biz):
- GET /api/v1/companies → sees all 3 test companies (1 own-org, 1 global null, 1 admin's org) ✓
- POST with `organizationId: null` → creates global company ✓
- POST without `organizationId` → defaults to own org ✓
- GET any company ID → 200 ✓

ADMIN (test user, separate org):
- GET /api/v1/companies → sees only their 1 company (cannot see OWNER's global or own-org) ✓
- POST with `organizationId: null` → forced to their orgId (cannot create global) ✓
- GET OWNER's company ID → 404 "Company not found" (no leak) ✓
- GET global company ID → 404 ✓
- DELETE global company ID → 404 ✓
- GET own company ID → 200 ✓

## Agent Browser verification

OWNER sidebar (sidebar-owner.png, 147 KB): 19 nav items including API REST, Back Office, Architecture distribuée, Sécurité, PWA, SaaS Enterprise, Base de données.

ADMIN sidebar (sidebar-admin.png, 147 KB): 13 nav items — the 7 platform-management tabs (API REST, Back Office, Architecture distribuée, Sécurité, PWA, SaaS Enterprise, Base de données) are HIDDEN.

`agent-browser errors` → empty (no JS errors, no parsing errors).
`agent-browser console` → clean (only HMR + React DevTools info messages).

## Lint

`bun run lint` → exit 0, 0 errors, 0 warnings.

## DB integrity

After cleanup: User 1, Organization 1, Member 1, Session 25, RefreshToken 25, AuditLog 60, RestApiLog 23. (Sessions grew due to curl + agent-browser logins; companies cleaned up to 0.)
