/**
 * GET /api/v1/quota
 *
 * Real-time quota usage for the current user's organization.
 *
 * Returns a compact JSON payload consumed by the dashboard header (the
 * "QUOTA API" pill) and any other UI that needs to display usage vs. limits:
 *
 *   {
 *     "apiCalls":  { "used": 42,  "limit": 100000, "percentage": 0.04 },
 *     "companies": { "used": 0,   "limit": 5000,   "percentage": 0    },
 *     "exports":   { "used": 0,   "limit": 100,    "percentage": 0    },
 *     "users":     { "used": 1,   "limit": 3,      "percentage": 33.3 }
 *   }
 *
 * Sources of truth:
 *   - apiCalls.used  → QuotaUsage.apiCalls for the current month + org
 *                      (the same table that getQuota() in saas-engine.ts
 *                      increments). Falls back to 0 if no row exists.
 *   - apiCalls.limit → License.maxApiCalls for the org's active license, OR
 *                      the Starter plan default (25000) if no license.
 *   - companies.used → db.company.count() filtered by org (tenant-scoped)
 *   - companies.limit → License.maxCompanies, OR Starter default (5000)
 *   - exports.used   → QuotaUsage.exportsCount for the current month
 *   - exports.limit  → License.maxExports, OR Starter default (30)
 *   - users.used     → db.member.count({ where: { organizationId, status: "active" } })
 *   - users.limit    → License.maxUsers, OR Starter default (3)
 *
 * OWNER without an org sees 0 for everything (they manage multiple orgs via
 * the SaaS admin view, not this header).
 *
 * Empty states are valid — `used: 0` is the real value when the DB is empty.
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sendSuccess, sendError, startTimer, logApiCall } from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import { getOrganizationLicense, getPlan } from "@/lib/saas/saas-engine"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

// Starter plan defaults — used when the org has no active license yet.
// Mirrors `PLANS[0]` in src/lib/saas/saas-engine.ts (kept in sync manually
// to avoid pulling the whole SaaS engine into the bundle).
const STARTER_DEFAULTS = {
  maxUsers: 3,
  maxCompanies: 5000,
  maxApiCalls: 25000,
  maxExports: 30,
}

interface QuotaItem {
  used: number
  limit: number
  percentage: number
}

function buildItem(used: number, limit: number): QuotaItem {
  const percentage = limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0
  return { used, limit, percentage }
}

export async function GET(req: NextRequest) {
  const timer = startTimer()
  const auth = await requireApiAuth(req)

  if (!auth.user) {
    const err = sendError(auth.error || "Unauthorized", auth.status, "UNAUTHORIZED")
    await logApiCall({
      req,
      statusCode: auth.status,
      responseMs: timer(),
      userId: null,
      error: auth.error,
    })
    return err
  }

  try {
    const orgId = auth.user.orgId

    // No org → all zeros (OWNER without org, or unauthenticated edge case).
    if (!orgId) {
      const payload = {
        apiCalls: buildItem(0, STARTER_DEFAULTS.maxApiCalls),
        companies: buildItem(0, STARTER_DEFAULTS.maxCompanies),
        exports: buildItem(0, STARTER_DEFAULTS.maxExports),
        users: buildItem(0, STARTER_DEFAULTS.maxUsers),
      }
      const res = sendSuccess(payload)
      await logApiCall({
        req,
        statusCode: 200,
        responseMs: timer(),
        userId: auth.user.id,
        apiKeyId: auth.apiKeyId,
      })
      return res
    }

    // Resolve the org's active license (if any). Falls back to Starter plan
    // defaults via getQuota() semantics — same behaviour as the SaaS engine.
    const license = await getOrganizationLicense(orgId)
    const maxUsers = license?.maxUsers ?? STARTER_DEFAULTS.maxUsers
    const maxCompanies = license?.maxCompanies ?? STARTER_DEFAULTS.maxCompanies
    const maxApiCalls = license?.maxApiCalls ?? STARTER_DEFAULTS.maxApiCalls
    const maxExports = license?.maxExports ?? STARTER_DEFAULTS.maxExports

    // Plan name (for the UI to display "Starter" / "Pro" / etc.)
    const planCode = license?.plan ?? "starter"
    const planName = license?.planName ?? getPlan(planCode)?.name ?? "Starter"

    // Current month quota usage row (best-effort — created on first write
    // by incrementQuota(), might not exist yet for fresh orgs).
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    let quotaUsage = null
    try {
      quotaUsage = await db.quotaUsage.findUnique({
        where: {
          organizationId_periodYear_periodMonth: {
            organizationId: orgId,
            periodYear: year,
            periodMonth: month,
          },
        },
      })
    } catch {
      /* QuotaUsage table missing — default to 0 (best-effort) */
    }

    // Real-time resource counts (tenant-scoped for companies / users)
    const [companyCount, userCount] = await Promise.all([
      db.company.count({ where: { organizationId: orgId } }),
      db.member.count({ where: { organizationId: orgId, status: "active" } }),
    ])

    const apiCallsUsed = quotaUsage?.apiCalls ?? 0
    const exportsUsed = quotaUsage?.exportsCount ?? 0

    const payload = {
      plan: planCode,
      planName,
      apiCalls: buildItem(apiCallsUsed, maxApiCalls),
      companies: buildItem(companyCount, maxCompanies),
      exports: buildItem(exportsUsed, maxExports),
      users: buildItem(userCount, maxUsers),
    }

    const res = sendSuccess(payload)
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[quota] GET error:", err)
    const message = err instanceof Error ? err.message : "Erreur serveur"
    const res = sendError(message, 500, "INTERNAL_ERROR")
    await logApiCall({
      req,
      statusCode: 500,
      responseMs: timer(),
      userId: auth.user?.id,
      error: message,
    })
    return res
  }
}
