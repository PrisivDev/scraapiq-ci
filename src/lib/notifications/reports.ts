/**
 * Scheduled reports engine — génération automatique de rapports périodiques
 *
 * - generateReport()   : génère un export via le moteur existant, crée un ReportExecution,
 *                        envoie le lien/fichier via les canaux configurés
 * - checkDueReports()  : trouve les rapports où nextRunAt <= now() et les génère
 * - calculateNextRun() : parse "daily:08:00", "weekly:mon:08:00", "monthly:01:08:00"
 * - createScheduledReport() : crée avec nextRunAt calculé
 */

import { db } from "@/lib/db"
import type { ScheduledReport, ReportExecution } from "@prisma/client"
import { generateExport } from "@/lib/export/generators"
import { DEFAULT_COLUMNS, type ExportFormat } from "@/lib/export/types"
import { sendMultiChannel, type NotificationChannel } from "./engine"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportType = "daily" | "weekly" | "monthly" | "custom"

export interface CreateReportParams {
  name: string
  description?: string
  type: ReportType
  schedule: string // "daily:08:00" | "weekly:mon:08:00" | "monthly:01:08:00"
  channels?: NotificationChannel[]
  recipients?: string[]
  filters?: Record<string, unknown>
  format?: ExportFormat
  isActive?: boolean
}

export interface GenerateResult {
  execution: ReportExecution
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Parsing des plannings et calcul du prochain run
// ---------------------------------------------------------------------------

const DAY_NAMES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const MONTH_DAYS_MAX = 28 // pour éviter février

/**
 * Calcule la prochaine occurrence d'un planning.
 *
 * Formats supportés :
 *  - "daily:08:00"          → tous les jours à 08:00
 *  - "weekly:mon:08:00"     → tous les lundis à 08:00
 *  - "monthly:01:08:00"     → le 1er de chaque mois à 08:00
 *  - "custom:08:00"         → comme daily (alias)
 *
 * @param schedule  Le planning à parser
 * @param from      Date de référence (défaut: maintenant)
 */
export function calculateNextRun(
  schedule: string,
  from: Date = new Date()
): Date {
  const parts = schedule.split(":").map((s) => s.trim().toLowerCase())
  if (parts.length < 2) {
    // Fallback : demain à 08:00
    const d = new Date(from)
    d.setDate(d.getDate() + 1)
    d.setHours(8, 0, 0, 0)
    return d
  }

  const kind = parts[0] // daily | weekly | monthly | custom
  // time peut être "08:00" (donc parts[1] = "08", parts[2] = "00")
  let hour = 8
  let minute = 0
  if (parts.length >= 3) {
    hour = parseInt(parts[1], 10) || 8
    minute = parseInt(parts[2], 10) || 0
  } else if (parts.length === 2) {
    // "daily:08:00" → ["daily", "08", "00"] mais si on a "daily:08" → heure seulement
    hour = parseInt(parts[1], 10) || 8
  }

  const next = new Date(from)
  next.setSeconds(0, 0)

  switch (kind) {
    case "daily":
    case "custom": {
      next.setHours(hour, minute, 0, 0)
      if (next <= from) {
        next.setDate(next.getDate() + 1)
      }
      return next
    }

    case "weekly": {
      // Format: weekly:mon:08:00 → parts = ["weekly", "mon", "08", "00"]
      const dayKey = parts[1] || "mon"
      const targetDay = DAY_NAMES[dayKey] ?? 1
      const dayName = parts[1] // pour le calcul de l'heure on shift vers la fin
      // Reparse l'heure : si 4 parts, heure = parts[2], minute = parts[3]
      if (parts.length >= 4) {
        hour = parseInt(parts[2], 10) || 8
        minute = parseInt(parts[3], 10) || 0
      } else {
        hour = 8
        minute = 0
      }
      next.setHours(hour, minute, 0, 0)
      const currentDay = next.getDay()
      let daysUntil = (targetDay - currentDay + 7) % 7
      if (daysUntil === 0 && next <= from) {
        daysUntil = 7
      }
      next.setDate(next.getDate() + daysUntil)
      return next
    }

    case "monthly": {
      // Format: monthly:01:08:00 → parts = ["monthly", "01", "08", "00"]
      const dayOfMonth = parseInt(parts[1], 10) || 1
      const dom = Math.min(dayOfMonth, MONTH_DAYS_MAX)
      if (parts.length >= 4) {
        hour = parseInt(parts[2], 10) || 8
        minute = parseInt(parts[3], 10) || 0
      } else {
        hour = 8
        minute = 0
      }
      next.setHours(hour, minute, 0, 0)
      next.setDate(dom)
      if (next <= from) {
        next.setMonth(next.getMonth() + 1)
        next.setDate(dom)
      }
      return next
    }

    default: {
      // Inconnu → demain à 08:00
      next.setHours(8, 0, 0, 0)
      if (next <= from) {
        next.setDate(next.getDate() + 1)
      }
      return next
    }
  }
}

// ---------------------------------------------------------------------------
// Création d'un rapport planifié
// ---------------------------------------------------------------------------

export async function createScheduledReport(
  params: CreateReportParams
): Promise<ScheduledReport> {
  const channels = params.channels || (["email"] as NotificationChannel[])
  const recipients = params.recipients || []
  const filters = params.filters || {}
  const format = params.format || "pdf"
  const nextRunAt = calculateNextRun(params.schedule)

  return db.scheduledReport.create({
    data: {
      name: params.name,
      description: params.description || null,
      type: params.type,
      schedule: params.schedule,
      channels: JSON.stringify(channels),
      recipients: JSON.stringify(recipients),
      filters: JSON.stringify(filters),
      format,
      isActive: params.isActive !== false,
      nextRunAt,
    },
  })
}

// ---------------------------------------------------------------------------
// Génération d'un rapport : utilise le moteur d'export existant
// ---------------------------------------------------------------------------

/**
 * Charge toutes les entreprises (depuis l'export-store) et applique les filtres
 * du rapport.
 */
async function loadReportData(filters: Record<string, unknown>) {
  // On réutilise la logique du store d'export (geoCompanies + mock)
  const geoModule = await import("@/lib/geo-data")
  const mockModule = await import("@/lib/mock-data")
  const geoCompanies = geoModule.geoCompanies
  const mockCompanies = mockModule.companies

  const all: Array<Record<string, unknown>> = []
  for (const c of geoCompanies) {
    all.push({
      id: `geo-${c.id}`,
      name: c.name,
      sector: c.sector,
      commune: c.commune,
      city: c.city,
      address: c.address,
      phone: c.phone,
      email: "",
      website: "",
      rating: c.rating,
      reviewCount: c.reviewCount,
      status: c.status,
      employees: c.employees,
      lat: c.lat,
      lng: c.lng,
      rccm: "",
      description: `${c.name} — ${c.sector} à ${c.commune}, ${c.city}`,
      sources: ["Google Maps"],
      facebook: "",
      instagram: "",
      linkedin: "",
    })
  }
  for (const c of mockCompanies) {
    all.push({
      id: `mock-${c.id}`,
      name: c.name,
      sector: c.sector,
      commune: c.commune,
      city: c.city,
      address: c.address || "",
      phone: c.phone,
      email: c.email,
      website: c.website,
      rating: undefined,
      reviewCount: undefined,
      status: c.status,
      employees: c.employees,
      lat: c.lat,
      lng: c.lng,
      rccm: c.rccm,
      description: `${c.name} — ${c.sector}`,
      sources: c.sources,
      facebook: "",
      instagram: "",
      linkedin: "",
    })
  }

  // Apply filters
  let result = all
  const sectors = filters.sectors as string[] | undefined
  const cities = filters.cities as string[] | undefined
  const communes = filters.communes as string[] | undefined
  const status = filters.status as string[] | undefined
  const searchQuery = filters.searchQuery as string | undefined

  if (sectors && sectors.length > 0) {
    result = result.filter((c) => sectors.includes(c.sector as string))
  }
  if (cities && cities.length > 0) {
    result = result.filter((c) => cities.includes(c.city as string))
  }
  if (communes && communes.length > 0) {
    result = result.filter((c) => communes.includes(c.commune as string))
  }
  if (status && status.length > 0) {
    result = result.filter((c) => status.includes(c.status as string))
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    result = result.filter(
      (c) =>
        (c.name as string).toLowerCase().includes(q) ||
        (c.sector as string).toLowerCase().includes(q)
    )
  }

  return result
}

export async function generateReport(
  report: ScheduledReport
): Promise<GenerateResult> {
  // Création du ReportExecution
  const execution = await db.reportExecution.create({
    data: {
      reportId: report.id,
      status: "processing",
      format: report.format,
      startedAt: new Date(),
    },
  })

  try {
    let filters: Record<string, unknown> = {}
    try {
      filters = JSON.parse(report.filters || "{}")
    } catch {
      filters = {}
    }

    const rows = await loadReportData(filters)
    const filename = `${report.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}`

    const exportFormat = report.format as ExportFormat
    const result = await generateExport(
      rows,
      [...DEFAULT_COLUMNS],
      filename,
      exportFormat
    )

    // Stockage en data URL (base64)
    const dataUrl = `data:${result.mimeType};base64,${result.buffer.toString(
      "base64"
    )}`

    const updated = await db.reportExecution.update({
      where: { id: execution.id },
      data: {
        status: "completed",
        fileSizeBytes: result.buffer.length,
        filename: result.filename,
        dataUrl,
        completedAt: new Date(),
      },
    })

    // Mettre à jour le rapport
    const nextRunAt = calculateNextRun(report.schedule)
    await db.scheduledReport.update({
      where: { id: report.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
        runCount: { increment: 1 },
      },
    })

    // Envoi de notification sur les canaux configurés
    let channels: NotificationChannel[] = ["email"]
    try {
      channels = JSON.parse(report.channels) as NotificationChannel[]
    } catch {
      channels = ["email"]
    }
    let recipients: string[] = []
    try {
      recipients = JSON.parse(report.recipients) as string[]
    } catch {
      recipients = []
    }

    if (channels.length > 0) {
      await sendMultiChannel({
        channels,
        title: `📊 Rapport disponible : ${report.name}`,
        body:
          `Le rapport "${report.name}" a été généré avec succès.\n` +
          `Format: ${report.format.toUpperCase()}\n` +
          `Lignes: ${rows.length}\n` +
          `Taille: ${(result.buffer.length / 1024).toFixed(1)} Ko\n` +
          `Fichier: ${result.filename}`,
        priority: "normal",
        payload: {
          reportId: report.id,
          executionId: execution.id,
          format: report.format,
          filename: result.filename,
          rows: rows.length,
          sizeBytes: result.buffer.length,
        },
        eventName: `report.${report.type}.generated`,
        recipients: recipients.length
          ? (Object.fromEntries(
              channels.map((c) => [
                c,
                c === "email" ? recipients[0] : recipients[0] || "",
              ])
            ) as Record<NotificationChannel, string>)
          : undefined,
      })
    }

    return { execution: updated, success: true }
  } catch (e) {
    const err = e instanceof Error ? e.message : "Unknown error"
    const updated = await db.reportExecution.update({
      where: { id: execution.id },
      data: {
        status: "failed",
        error: err,
        completedAt: new Date(),
      },
    })
    return { execution: updated, success: false, error: err }
  }
}

// ---------------------------------------------------------------------------
// Vérifie et génère tous les rapports dus
// ---------------------------------------------------------------------------

export async function checkDueReports(): Promise<{
  checked: number
  generated: number
  failed: number
  results: Array<{ reportId: string; reportName: string; success: boolean; error?: string }>
}> {
  const now = new Date()
  const due = await db.scheduledReport.findMany({
    where: {
      isActive: true,
      OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
    },
  })

  const results: Array<{
    reportId: string
    reportName: string
    success: boolean
    error?: string
  }> = []
  let generated = 0
  let failed = 0

  for (const report of due) {
    try {
      const res = await generateReport(report)
      results.push({
        reportId: report.id,
        reportName: report.name,
        success: res.success,
        error: res.error,
      })
      if (res.success) generated++
      else failed++
    } catch (e) {
      failed++
      results.push({
        reportId: report.id,
        reportName: report.name,
        success: false,
        error: e instanceof Error ? e.message : "Unknown",
      })
    }
  }

  return {
    checked: due.length,
    generated,
    failed,
    results,
  }
}

// ---------------------------------------------------------------------------
// Lister les exécutions d'un rapport
// ---------------------------------------------------------------------------

export async function listExecutions(reportId: string, limit = 20) {
  return db.reportExecution.findMany({
    where: { reportId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}
