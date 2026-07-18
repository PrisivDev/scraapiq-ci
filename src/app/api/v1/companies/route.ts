/**
 * GET /api/v1/companies
 * List companies with pagination, filters, sort, search.
 *
 * Multi-tenant isolation:
 *  - OWNER  (super-admin global): sees ALL companies (including organizationId = null = global/shared)
 *  - Others: see ONLY companies where organizationId === their orgId
 *
 * POST /api/v1/companies
 * Create a new company.
 *  - Non-OWNER: organizationId is FORCED to their orgId (cannot create global companies)
 *  - OWNER    : can set organizationId explicitly (default = their own org)
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import {
  parsePagination,
  parseFilters,
  parseSort,
  parseSearch,
  buildPaginationMeta,
  sendSuccess,
  sendError,
  logApiCall,
  startTimer,
} from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import { seedCompaniesIfEmpty } from "@/lib/api/seed"
import { buildCompanyFilter } from "@/lib/auth/tenant"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const ALLOWED_FILTERS = ["sector", "city", "commune", "status"]
const ALLOWED_SORT = ["name", "sector", "city", "commune", "rating", "reviewCount", "createdAt", "updatedAt"]

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
    // Seed on first call
    await seedCompaniesIfEmpty()

    const { page, limit } = parsePagination(req)
    const filters = parseFilters(req, ALLOWED_FILTERS)
    const sort = parseSort(req, ALLOWED_SORT)
    const q = parseSearch(req)

    // Build where clause — start with tenant filter (org-scoped for non-OWNER)
    const where: Prisma.CompanyWhereInput = buildCompanyFilter(auth.user)

    if (filters.sector) where.sector = { contains: filters.sector as string }
    if (filters.city) where.city = { contains: filters.city as string }
    if (filters.commune) where.commune = { contains: filters.commune as string }
    if (filters.status) where.status = filters.status as string
    if (typeof filters.minRating === "number") {
      where.rating = { gte: filters.minRating }
    }

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { sector: { contains: q } },
        { address: { contains: q } },
        { description: { contains: q } },
      ]
    }

    const [total, companies] = await Promise.all([
      db.company.count({ where }),
      db.company.findMany({
        where,
        orderBy: sort ? { [sort.field]: sort.order } : { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const meta = buildPaginationMeta(page, limit, total)
    const res = sendSuccess(companies, { meta })
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[companies] GET error:", err)
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

export async function POST(req: NextRequest) {
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
    const body = await req.json().catch(() => ({}))

    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      const err = sendError("Le champ 'name' est requis", 422, "VALIDATION_ERROR")
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Missing name",
      })
      return err
    }

    // Multi-tenant: determine organizationId for the new company.
    // - OWNER  (super-admin): can create global (null) or org-scoped.
    //   * If `organizationId` is explicitly `null` in the body → global company
    //     (visible to OWNER only, not to any org's members).
    //   * If `organizationId` is a non-empty string → that org.
    //   * Otherwise (undefined) → default to OWNER's own org.
    // - Others: forced to their orgId. They CANNOT create global companies
    //   nor companies in another org (cross-tenant isolation).
    let organizationId: string | null
    if (auth.user.role === "OWNER") {
      if (body.organizationId === null) {
        // Explicit null = global/shared company (OWNER-only visibility).
        organizationId = null
      } else if (
        typeof body.organizationId === "string" &&
        body.organizationId.trim().length > 0
      ) {
        organizationId = body.organizationId.trim()
      } else {
        // Undefined or empty → default to OWNER's own org.
        organizationId = auth.user.orgId
      }
    } else {
      // Non-OWNER: force their orgId. If they have no orgId, reject (no active membership).
      if (!auth.user.orgId) {
        const err = sendError(
          "Aucune organisation associée à votre compte — impossible de créer une entreprise",
          403,
          "NO_ORG"
        )
        await logApiCall({
          req,
          statusCode: 403,
          responseMs: timer(),
          userId: auth.user.id,
          error: "No org membership",
        })
        return err
      }
      organizationId = auth.user.orgId
    }

    const created = await db.company.create({
      data: {
        name: body.name.trim(),
        organizationId,
        sector: body.sector?.trim() || null,
        commune: body.commune?.trim() || null,
        city: body.city?.trim() || null,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        website: body.website?.trim() || null,
        rccm: body.rccm?.trim() || null,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
        rating: typeof body.rating === "number" ? body.rating : null,
        reviewCount: typeof body.reviewCount === "number" ? body.reviewCount : null,
        description: body.description?.trim() || null,
        employees: body.employees?.trim() || null,
        status: body.status || "active",
        sources: body.sources ? JSON.stringify(body.sources) : "[]",
      },
    })

    const res = sendSuccess(created, { message: "Company created", status: 201 })
    await logApiCall({
      req,
      statusCode: 201,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[companies] POST error:", err)
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
