/**
 * GET    /api/v1/companies/[id]  — Get a single company
 * PUT    /api/v1/companies/[id]  — Update a company
 * DELETE /api/v1/companies/[id]  — Delete a company
 *
 * Multi-tenant isolation:
 *  - OWNER  : can GET/PUT/DELETE any company (including global, organizationId = null)
 *  - Others : can only GET/PUT/DELETE companies in their own org
 *             (organizationId === user.orgId). Returns 404 if not in their org
 *             (don't leak existence to other tenants).
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  sendSuccess,
  sendError,
  logApiCall,
  startTimer,
} from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import { canAccessOrg } from "@/lib/auth/tenant"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Returns 404 (not "403 forbidden") when the company exists but belongs to
 * another org — don't leak cross-tenant existence.
 */
function notFoundResponse() {
  return sendError("Company not found", 404, "NOT_FOUND")
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const company = await db.company.findUnique({ where: { id } })

    if (!company || !canAccessOrg(auth.user, company.organizationId)) {
      const err = notFoundResponse()
      await logApiCall({
        req,
        statusCode: 404,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Not found (or outside tenant)",
      })
      return err
    }

    const res = sendSuccess(company)
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[companies] GET by id error:", err)
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing || !canAccessOrg(auth.user, existing.organizationId)) {
      const err = notFoundResponse()
      await logApiCall({
        req,
        statusCode: 404,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Not found (or outside tenant)",
      })
      return err
    }

    // Build update payload — only allow known fields.
    // NOTE: organizationId is intentionally NOT in this list — non-OWNER
    // cannot move companies between orgs; OWNER can use the dedicated admin
    // DB route if needed.
    const allowedFields = [
      "name", "sector", "commune", "city", "address", "phone", "email",
      "website", "rccm", "lat", "lng", "rating", "reviewCount",
      "description", "employees", "status",
    ]

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        const value = body[field]
        if (field === "lat" || field === "lng" || field === "rating" || field === "reviewCount") {
          if (value === null || value === undefined) {
            data[field] = null
          } else if (typeof value === "number") {
            data[field] = value
          }
        } else if (typeof value === "string") {
          data[field] = value.trim() || null
        } else if (value === null) {
          data[field] = null
        }
      }
    }

    if (typeof body.sources !== "undefined") {
      data.sources = JSON.stringify(body.sources)
    }

    const updated = await db.company.update({
      where: { id },
      data,
    })

    const res = sendSuccess(updated, { message: "Company updated" })
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[companies] PUT error:", err)
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const existing = await db.company.findUnique({ where: { id } })
    if (!existing || !canAccessOrg(auth.user, existing.organizationId)) {
      const err = notFoundResponse()
      await logApiCall({
        req,
        statusCode: 404,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Not found (or outside tenant)",
      })
      return err
    }

    await db.company.delete({ where: { id } })

    const res = sendSuccess({ id }, { message: "Company deleted" })
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[companies] DELETE error:", err)
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
