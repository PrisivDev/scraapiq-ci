/**
 * Multi-tenant helpers — org-scoped Prisma where clauses for tenant isolation.
 *
 * Model:
 *  - OWNER  (super-admin global, e.g. admin@prisiv.biz) sees ALL data, including
 *            companies with organizationId = null (global/shared).
 *  - ADMIN/MANAGER/AGENT/VIEWER only see data where organizationId === their orgId.
 *
 * Two flavours:
 *  - getOrgFilterFromRequest(req)  — for API routes using requireApiAuth(req)
 *  - getOrgFilter()                — for server components / routes using getAuthUser()
 *
 * The returned object is meant to be spread into a Prisma `where` clause:
 *   const where = { ...orgFilter, sector: "Banking" }
 *   const companies = await db.company.findMany({ where })
 *
 * For OWNER, the filter is `{}` (no constraint) — they see everything.
 * For others, the filter is `{ organizationId: user.orgId }`.
 *
 * If the user is not authenticated, the helpers throw a Response 401 so the
 * route handler can let it bubble up.
 */
import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import { getAuthUser, type AuthUser } from "./context"

/**
 * Result returned by the tenant helpers.
 *
 * `filter` is always a valid Prisma.CompanyWhereInput spread-shape:
 *   - OWNER: {}                       (no constraint — sees all)
 *   - non-OWNER with orgId: { organizationId: "<orgId>" }
 *   - non-OWNER without orgId (shouldn't happen, but defensive):
 *       { organizationId: "__NO_ORG__" }  — matches nothing.
 *
 * `user` is the authenticated AuthUser (always non-null — helpers throw on
 * unauthenticated).
 *
 * `isOwner` is a convenience boolean.
 */
export interface TenantContext {
  user: AuthUser
  isOwner: boolean
  /** Spread into Prisma `where` for Company queries. */
  filter: Prisma.CompanyWhereInput
  /** orgId to attach to NEW records. null = global (OWNER-only). */
  orgIdForCreate: string | null
}

const NO_ACCESS_FILTER: Prisma.CompanyWhereInput = { organizationId: "__NO_ORG__" }

/**
 * Build the TenantContext from a NextRequest (API routes).
 *
 * Usage:
 *   export async function GET(req: NextRequest) {
 *     const ctx = await getTenantContextFromRequest(req)
 *     const companies = await db.company.findMany({ where: { ...ctx.filter } })
 *   }
 *
 * Throws a Response (401) if not authenticated — let it propagate, Next.js
 * will return it to the client.
 */
export async function getTenantContextFromRequest(req: NextRequest): Promise<TenantContext> {
  const auth = await requireApiAuth(req)
  if (!auth.user) {
    throw new Response(JSON.stringify({ error: auth.error || "Unauthorized" }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    })
  }
  return buildContext(auth.user)
}

/**
 * Build the TenantContext from cookies (server components, RSC, route handlers
 * that already use getAuthUser()).
 *
 * Throws a Response (401) if not authenticated.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const { user, error, status } = await getAuthUser()
  if (!user) {
    throw new Response(JSON.stringify({ error: error || "Unauthorized" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
  return buildContext(user)
}

/**
 * Returns just the Prisma `where` filter for Company queries (no auth check).
 *
 * Convenience wrapper for routes that have already called requireApiAuth /
 * getAuthUser themselves and just need the filter object.
 */
export function buildCompanyFilter(user: AuthUser): Prisma.CompanyWhereInput {
  return buildContext(user).filter
}

/**
 * Verifies that the current user can access a specific org's data.
 *
 * - OWNER: true (sees all orgs)
 * - non-OWNER: true only if orgId === user.orgId
 */
export function canAccessOrg(user: AuthUser, orgId: string | null | undefined): boolean {
  if (!user) return false
  if (user.role === "OWNER") return true
  if (!orgId) return false // non-OWNER cannot see global records
  return user.orgId === orgId
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function buildContext(user: AuthUser): TenantContext {
  const isOwner = user.role === "OWNER"

  // OWNER sees everything (including null organizationId = global records).
  if (isOwner) {
    return {
      user,
      isOwner: true,
      filter: {}, // no constraint
      orgIdForCreate: user.orgId, // OWNER creating in their own org by default
    }
  }

  // Non-OWNER: scoped to their org. If they somehow have no orgId (shouldn't
  // happen — they always have an active membership), match nothing.
  if (!user.orgId) {
    return {
      user,
      isOwner: false,
      filter: NO_ACCESS_FILTER,
      orgIdForCreate: null,
    }
  }

  return {
    user,
    isOwner: false,
    filter: { organizationId: user.orgId },
    orgIdForCreate: user.orgId,
  }
}
