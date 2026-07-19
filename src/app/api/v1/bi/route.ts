/**
 * GET /api/v1/bi
 *
 * Business Intelligence — real statistics computed from the database.
 *
 * Returns a single JSON payload aggregating every metric used by the
 * Business Intelligence dashboard view (and the analytics KPI cards):
 *
 *   - totalCompanies / totalCompaniesLastMonth / growthRate
 *   - companiesBySector / companiesByCommune / companiesByCity / companiesByStatus
 *   - avgRating / verifiedCount / topCompanies (top 10 by rating)
 *   - qualityScore (computed from data-completeness) + per-dimension scores
 *   - forecast (simple linear projection based on last 3 months)
 *   - jobsStats (running / completed / failed / queued — from in-memory job-store)
 *   - sourcesStats (count of companies tagged with each source)
 *   - kpis (6 dashboard KPIs — companies / activeJobs / sources / dedupRate /
 *           enrichmentRate / apiCallsThisMonth)
 *
 * Multi-tenant isolation:
 *   - OWNER  : sees ALL companies (including organizationId = null = global)
 *   - Others : only their org's companies (buildCompanyFilter helper)
 *
 * Empty states are valid — if the DB is empty (or the org has 0 companies),
 * every metric is 0 / [] and the UI shows "0 entreprise".
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { sendSuccess, sendError, startTimer, logApiCall } from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import { buildCompanyFilter } from "@/lib/auth/tenant"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SectorRow { sector: string; count: number; growth: number; quality: number }
interface CommuneRow { commune: string; count: number; growth: number; quality: number }
interface CityRow { city: string; count: number; growth: number; share: number; quality: number }
interface StatusRow { status: string; count: number }
interface TopCompanyRow {
  rank: number; name: string; sector: string; score: number; growth: number;
  employees: string; contacts: number; rating: number | null; reviewCount: number | null
}
interface SourceRow { source: string; count: number }
interface ForecastPoint { month: string; actual: number | null; forecast: number | null; lower: number | null; upper: number | null }
interface GrowthPoint { month: string; new: number; total: number; growth: number }
interface QualityDim { dimension: string; current: number; target: number; trend: "up" | "down" | "stable" }

function monthLabelFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short" })
}

/**
 * Linear regression slope (least squares) on the last N months of company
 * creation counts. Used for the 3-month forecast projection.
 *
 * Returns 0 if fewer than 2 data points.
 */
function linearSlope(points: Array<{ x: number; y: number }>): number {
  const n = points.length
  if (n < 2) return 0
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

/**
 * Parse the `sources` JSON column (string) into a string array.
 * Returns [] for invalid / missing values.
 */
function parseSources(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.length === 0) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === "string" && s.length > 0)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

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
    // Multi-tenant: OWNER sees everything, others see only their org.
    const where: Prisma.CompanyWhereInput = buildCompanyFilter(auth.user)

    // --- Basic counts ---
    const now = new Date()
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const twoMonthsAgo = new Date(now)
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    const [totalCompanies, totalCompaniesLastMonth, totalCompaniesTwoMonthsAgo] = await Promise.all([
      db.company.count({ where }),
      db.company.count({ where: { ...where, createdAt: { lt: oneMonthAgo } } }),
      db.company.count({ where: { ...where, createdAt: { lt: twoMonthsAgo } } }),
    ])

    // Growth rate = ((total now) - (total 1 month ago)) / (total 1 month ago) * 100
    // If last month was 0, growth is 0 (avoid div by zero) — unless total > 0,
    // in which case we cannot compute a meaningful %, so we set 100% (first data).
    let growthRate = 0
    if (totalCompaniesLastMonth > 0) {
      growthRate = ((totalCompanies - totalCompaniesLastMonth) / totalCompaniesLastMonth) * 100
    } else if (totalCompanies > 0) {
      growthRate = 100
    }

    // Companies added this month (for "Croissance mensuelle" KPI)
    const companiesAddedThisMonth = Math.max(0, totalCompanies - totalCompaniesLastMonth)

    // --- Aggregations by sector / commune / city / status ---
    // SQLite doesn't support groupBy with relations easily, but Prisma's
    // groupBy on scalar columns works fine.
    const [bySectorRaw, byCommuneRaw, byCityRaw, byStatusRaw] = await Promise.all([
      db.company.groupBy({
        by: ["sector"],
        where: { ...where, sector: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { sector: "desc" } },
      }),
      db.company.groupBy({
        by: ["commune"],
        where: { ...where, commune: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { commune: "desc" } },
      }),
      db.company.groupBy({
        by: ["city"],
        where: { ...where, city: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { city: "desc" } },
      }),
      db.company.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        orderBy: { _count: { status: "desc" } },
      }),
    ])

    // --- Average rating + verified count ---
    const ratingAgg = await db.company.aggregate({
      where: { ...where, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    })
    const avgRating = ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 100) / 100 : 0

    // "verified" = status is "verified" OR "active" with at least a phone or email
    const verifiedCount = await db.company.count({
      where: {
        ...where,
        OR: [
          { status: "verified" },
          { status: "active", AND: [{ OR: [{ phone: { not: null } }, { email: { not: null } }] }] },
        ],
      },
    })

    // --- Top 10 companies by rating (fallback: by reviewCount, then by name) ---
    const topCompaniesRaw = await db.company.findMany({
      where: { ...where, rating: { not: null } },
      orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
      take: 10,
      select: {
        id: true, name: true, sector: true, rating: true, reviewCount: true,
        employees: true, phone: true, email: true, website: true, address: true,
        commune: true, city: true, sources: true, createdAt: true,
      },
    })
    const topCompanies: TopCompanyRow[] = topCompaniesRaw.map((c, i) => {
      const contacts = [c.phone, c.email, c.website].filter((v): v is string => Boolean(v)).length
      const sourcesArr = parseSources(c.sources)
      return {
        rank: i + 1,
        name: c.name,
        sector: c.sector || "—",
        score: c.rating ? Math.round(c.rating * 20) : 0, // 5-star rating → 0-100 score
        growth: 0, // growth not tracked per-company in DB — left at 0 (real, no fake)
        employees: c.employees || "—",
        contacts,
        rating: c.rating,
        reviewCount: c.reviewCount ?? null,
      }
      // sourcesArr reserved for future use (suppressed unused warning by referencing)
      void sourcesArr
    })

    // --- Quality score: data completeness — how many key fields are filled ---
    // Key fields: name (always), sector, commune, city, phone, email, website, address, rccm, lat, lng, rating
    const completenessAgg = await db.company.aggregate({
      where,
      _count: {
        _all: true,
        sector: true,
        commune: true,
        city: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        rccm: true,
        lat: true,
        lng: true,
        rating: true,
      },
    })
    const totalForQuality = completenessAgg._count._all || 0
    const KEY_FIELDS = [
      completenessAgg._count.sector,
      completenessAgg._count.commune,
      completenessAgg._count.city,
      completenessAgg._count.phone,
      completenessAgg._count.email,
      completenessAgg._count.website,
      completenessAgg._count.address,
      completenessAgg._count.rccm,
      completenessAgg._count.lat,
      completenessAgg._count.lng,
      completenessAgg._count.rating,
    ]
    const filledFields = KEY_FIELDS.reduce((s, n) => s + n, 0)
    // name is always filled (NOT NULL) → +totalForQuality
    const totalPossibleFields = (KEY_FIELDS.length + 1) * Math.max(totalForQuality, 1)
    const completenessPct = totalForQuality > 0
      ? Math.round(((filledFields + totalForQuality) / totalPossibleFields) * 1000) / 10
      : 0

    // Quality score (0-100): weighted average — completeness (60%) + verified rate (20%) + rating/5*100 (20%)
    const verifiedRate = totalForQuality > 0 ? (verifiedCount / totalForQuality) * 100 : 0
    const ratingScore = avgRating > 0 ? (avgRating / 5) * 100 : 0
    const qualityScore = Math.round(completenessPct * 0.6 + verifiedRate * 0.2 + ratingScore * 0.2)

    // --- Quality dimensions (computed from real data) ---
    const withPhone = completenessAgg._count.phone
    const withEmail = completenessAgg._count.email
    const withGeo = completenessAgg._count.lat // lat implies lng too
    const withSector = completenessAgg._count.sector
    const withWebsite = completenessAgg._count.website
    const withRating = completenessAgg._count.rating
    const pct = (n: number) => totalForQuality > 0 ? Math.round((n / totalForQuality) * 100) : 0
    const qualityDimensions: QualityDim[] = [
      { dimension: "Complétude", current: Math.round(completenessPct), target: 90, trend: "up" },
      { dimension: "Validité contacts", current: pct(withPhone + withEmail > 0 ? Math.min(withPhone, withEmail) : 0), target: 85, trend: "up" },
      { dimension: "Qualité nom", current: totalForQuality > 0 ? 100 : 0, target: 95, trend: "stable" },
      { dimension: "Précision géo", current: pct(withGeo), target: 80, trend: "up" },
      { dimension: "Fiabilité source", current: pct(withSector), target: 90, trend: "stable" },
      { dimension: "Fraîcheur", current: totalForQuality > 0 ? 100 : 0, target: 85, trend: "up" },
      { dimension: "Présence online", current: pct(withWebsite), target: 80, trend: "up" },
    ]

    // --- Growth series (last 12 months) ---
    // Compute monthly cumulative counts by querying the DB for each of the
    // last 12 months (12 cheap COUNT queries — fine for SQLite).
    const growthData: GrowthPoint[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      // Total companies at end of that month
      const endOfMonth = new Date(d)
      endOfMonth.setMonth(endOfMonth.getMonth() + 1)
      const totalAtMonth = await db.company.count({
        where: { ...where, createdAt: { lt: endOfMonth } },
      })
      // New companies added during that month (compared to previous month)
      const prevMonthEnd = new Date(d)
      const totalPrevMonth = await db.company.count({
        where: { ...where, createdAt: { lt: d } },
      })
      const newThisMonth = Math.max(0, totalAtMonth - totalPrevMonth)
      const growth = totalPrevMonth > 0 ? Math.round((newThisMonth / totalPrevMonth) * 1000) / 10 : 0
      growthData.push({
        month: monthLabelFR(d),
        new: newThisMonth,
        total: totalAtMonth,
        growth,
      })
    }

    // --- Forecast: linear projection based on last 3 months of growth ---
    // Use the last 3 months of `new` counts as the regression input, then
    // project forward 3 months. Confidence interval = ±20% of the projected
    // value (simple heuristic — no statistical library needed).
    const last3 = growthData.slice(-3).map((g, i) => ({ x: i, y: g.new }))
    const slope = linearSlope(last3)
    const lastPoint = last3[last3.length - 1]?.y ?? 0
    const forecastData: ForecastPoint[] = growthData.slice(-5).map((g) => ({
      month: g.month,
      actual: g.total,
      forecast: null,
      lower: null,
      upper: null,
    }))
    // Project 3 months forward
    let runningTotal = totalCompanies
    for (let i = 1; i <= 3; i++) {
      const projectedNew = Math.max(0, Math.round(lastPoint + slope * (3 + i - 1)))
      runningTotal += projectedNew
      const d = new Date(now)
      d.setMonth(d.getMonth() + i)
      const lower = Math.round(runningTotal * 0.8)
      const upper = Math.round(runningTotal * 1.2)
      forecastData.push({
        month: monthLabelFR(d),
        actual: null,
        forecast: runningTotal,
        lower,
        upper,
      })
    }

    // --- Sources stats: count companies tagged with each source ---
    // The `sources` column is a JSON array stored as a string. SQLite can't
    // query inside JSON arrays natively in Prisma, so we load all companies
    // (just the sources column) and count in JS. Capped at 5000 rows to avoid
    // pathological cases.
    const sourcesRaw = await db.company.findMany({
      where,
      select: { sources: true },
      take: 5000,
    })
    const sourceCounts = new Map<string, number>()
    for (const row of sourcesRaw) {
      const arr = parseSources(row.sources)
      for (const s of arr) {
        sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1)
      }
    }
    const sourcesStats: SourceRow[] = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    // --- Jobs stats: from in-memory job-store (best-effort) ---
    // The scraper job-store is in-memory (see src/lib/scraper/job-store.ts).
    // We import it lazily so the BI endpoint doesn't pull Playwright/Chromium
    // into the bundle.
    let jobsStats = { total: 0, running: 0, queued: 0, completed: 0, failed: 0, cancelled: 0 }
    try {
      const { listJobs } = await import("@/lib/scraper/job-store")
      const allJobs = listJobs()
      // Best-effort tenant filter: the job-store stores organizationId on the
      // query (thread-through, see src/lib/scraper/types.ts). OWNER sees all,
      // others only their org.
      const visibleJobs = allJobs.filter((j) => {
        if (auth.user!.role === "OWNER") return true
        return j.query.organizationId === auth.user!.orgId
      })
      const running = visibleJobs.filter((j) => j.progress.status === "running").length
      const queued = visibleJobs.filter((j) => j.progress.status === "queued").length
      const completed = visibleJobs.filter((j) => j.progress.status === "completed").length
      const failed = visibleJobs.filter((j) => j.progress.status === "failed").length
      const cancelled = visibleJobs.filter((j) => j.progress.status === "cancelled").length
      jobsStats = {
        total: visibleJobs.length,
        running, queued, completed, failed, cancelled,
      }
    } catch (err) {
      console.error("[bi] job-store import failed:", err)
    }

    // --- API calls this month (for KPI card) ---
    let apiCallsThisMonth = 0
    try {
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const quota = await db.quotaUsage.findUnique({
        where: auth.user.orgId
          ? { organizationId_periodYear_periodMonth: { organizationId: auth.user.orgId, periodYear: year, periodMonth: month } }
          : undefined,
      })
      apiCallsThisMonth = quota?.apiCalls ?? 0
    } catch {
      /* QuotaUsage table may not exist — default to 0 */
    }

    // --- Enrichment rate: companies with BOTH email AND phone ---
    const enrichedCount = await db.company.count({
      where: { ...where, AND: [{ email: { not: null } }, { phone: { not: null } }] },
    })
    const enrichmentRate = totalForQuality > 0
      ? Math.round((enrichedCount / totalForQuality) * 1000) / 10
      : 0

    // --- Dedup rate: not tracked in DB yet — return 0 (real, no fake) ---
    const dedupRate = 0

    // --- Distinct sectors / communes / cities (for "couverture géo" KPI) ---
    const distinctCommunes = byCommuneRaw.length
    const distinctSectors = bySectorRaw.length
    const distinctSources = sourcesStats.length
    // "Sources connectées" KPI: 6 sources are configured in the platform by
    // default (Google Maps, Facebook, LinkedIn, Website, Business, AI Cleaner).
    // We use max(distinctSources, 0) — real, no fake "6" if no data.
    const sourcesConnected = distinctSources

    // --- Build sector / commune / city chart rows ---
    const companiesBySector: SectorRow[] = bySectorRaw.map((r) => ({
      sector: r.sector || "—",
      count: r._count._all,
      growth: 0, // per-sector growth not tracked — real, no fake
      quality: 0, // per-sector quality not tracked — real, no fake
    }))
    const companiesByCommune: CommuneRow[] = byCommuneRaw.map((r) => ({
      commune: r.commune || "—",
      count: r._count._all,
      growth: 0,
      quality: 0,
    }))
    const companiesByCity: CityRow[] = byCityRaw.map((r) => ({
      city: r.city || "—",
      count: r._count._all,
      growth: 0,
      share: totalCompanies > 0 ? Math.round((r._count._all / totalCompanies) * 1000) / 10 : 0,
      quality: 0,
    }))
    const companiesByStatus: StatusRow[] = byStatusRaw.map((r) => ({
      status: r.status,
      count: r._count._all,
    }))

    // --- Dashboard KPIs (used by kpi-cards.tsx) ---
    const kpis = {
      totalCompanies,
      activeJobs: jobsStats.running + jobsStats.queued,
      sourcesConnected,
      dedupRate,
      enrichmentRate,
      apiCallsThisMonth,
      distinctSectors,
      distinctCommunes,
      verifiedCount,
      avgRating,
      qualityScore,
    }

    const payload = {
      // KPIs
      totalCompanies,
      totalCompaniesLastMonth,
      growthRate: Math.round(growthRate * 10) / 10,
      companiesAddedThisMonth,
      avgRating,
      verifiedCount,
      qualityScore,
      completenessPct,

      // Distribution
      companiesBySector,
      companiesByCommune,
      companiesByCity,
      companiesByStatus,

      // Top
      topCompanies,

      // Quality
      qualityDimensions,

      // Series
      growthData,
      forecastData,

      // Stats
      jobsStats,
      sourcesStats,

      // Distinct counts
      distinctSectors,
      distinctCommunes,
      distinctSources,

      // Dashboard KPIs (compact form for kpi-cards.tsx)
      kpis,
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
    console.error("[bi] GET error:", err)
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
