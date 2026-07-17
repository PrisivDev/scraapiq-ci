/**
 * REST API helpers — standardised responses, pagination, filters, sort, search
 *
 * Used by all v1 REST endpoints to keep payload shapes consistent.
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  meta?: PaginationMeta
}

export type FilterValue = string | number | boolean | null
export type Filters = Record<string, FilterValue>

export interface SortParams {
  field: string
  order: "asc" | "desc"
}

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

/**
 * Extracts `page` (default 1, min 1) and `limit` (default 20, max 100, min 1)
 * from query params.
 */
export function parsePagination(req: NextRequest): { page: number; limit: number } {
  const url = new URL(req.url)
  const rawPage = parseInt(url.searchParams.get("page") || "1", 10)
  const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20

  return { page, limit }
}

/**
 * Extracts filter params from query, limited to the allowed list.
 *
 * Example: `?sector=Restauration&city=Abidjan` → `{ sector: "Restauration", city: "Abidjan" }`
 */
export function parseFilters(
  req: NextRequest,
  allowedFields: string[]
): Filters {
  const url = new URL(req.url)
  const filters: Filters = {}
  for (const field of allowedFields) {
    const value = url.searchParams.get(field)
    if (value !== null && value !== "") {
      filters[field] = value
    }
  }
  // minRating is a special filter that needs numeric parsing
  const minRating = url.searchParams.get("minRating")
  if (minRating) {
    const n = parseFloat(minRating)
    if (!Number.isNaN(n)) filters.minRating = n
  }
  return filters
}

/**
 * Extracts `sort` and `order` from query, limited to the allowed list.
 *
 * Example: `?sort=name&order=desc` → `{ field: "name", order: "desc" }`
 */
export function parseSort(
  req: NextRequest,
  allowedFields: string[]
): SortParams | null {
  const url = new URL(req.url)
  const sort = url.searchParams.get("sort")
  if (!sort || !allowedFields.includes(sort)) return null
  const orderRaw = (url.searchParams.get("order") || "asc").toLowerCase()
  const order: "asc" | "desc" = orderRaw === "desc" ? "desc" : "asc"
  return { field: sort, order }
}

/**
 * Extracts the search query `q` from query params.
 */
export function parseSearch(req: NextRequest): string | null {
  const url = new URL(req.url)
  const q = url.searchParams.get("q")
  if (!q || q.trim().length === 0) return null
  return q.trim()
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Sends a standardised JSON success response.
 */
export function sendSuccess<T>(
  data: T,
  options?: { meta?: PaginationMeta; message?: string; status?: number }
): NextResponse {
  const body: ApiResponse<T> = {
    success: true,
    data,
  }
  if (options?.meta) body.meta = options.meta
  if (options?.message) body.message = options.message
  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Sends a standardised JSON error response.
 */
export function sendError(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  const body: ApiResponse = {
    success: false,
    error: message,
  }
  if (code) body.code = code
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Builds a PaginationMeta object from raw numbers.
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Logs an API call to the RestApiLog table.
 *
 * Best-effort: failures during logging are silently swallowed so they
 * never affect the actual response.
 */
export async function logApiCall(params: {
  req: NextRequest
  statusCode: number
  responseMs: number
  userId?: string | null
  apiKeyId?: string | null
  error?: string | null
}): Promise<void> {
  try {
    const forwarded = params.req.headers.get("x-forwarded-for")
    const ip = forwarded
      ? forwarded.split(",")[0]
      : params.req.headers.get("x-real-ip") || null
    const userAgent = params.req.headers.get("user-agent") || null
    const url = new URL(params.req.url)
    const endpoint = url.pathname

    await db.restApiLog.create({
      data: {
        method: params.req.method || "GET",
        endpoint,
        statusCode: params.statusCode,
        responseMs: params.responseMs,
        ip,
        userAgent,
        apiKeyId: params.apiKeyId || null,
        userId: params.userId || null,
        error: params.error || null,
      },
    })
  } catch (err) {
    // Never fail the actual response because of logging failure
    console.error("[api] logApiCall failed:", err)
  }
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * Wraps a handler and measures how long it takes, returning the duration
 * in milliseconds. Useful to feed `responseMs` to `logApiCall`.
 */
export function startTimer(): () => number {
  const startedAt = process.hrtime.bigint()
  return () => Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000))
}
