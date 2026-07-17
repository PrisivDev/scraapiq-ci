/**
 * Store de jobs d'export — async avec progression
 */

import { generateExport } from "./generators"
import type { ExportJob, ExportConfig, ExportFormat } from "./types"
import { MIME_TYPES } from "./types"
import { geoCompanies } from "@/lib/geo-data"
import { companies as mockCompanies } from "@/lib/mock-data"

const globalForExport = globalThis as unknown as {
  __exportJobs?: Map<string, ExportJob>
}

const jobs = globalForExport.__exportJobs ?? new Map<string, ExportJob>()

if (process.env.NODE_ENV !== "production") {
  globalForExport.__exportJobs = jobs
}

/**
 * Collecte toutes les entreprises disponibles (geo + mock)
 */
function getAllCompanies(): Array<Record<string, unknown>> {
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

  return all
}

/**
 * Filtre les entreprises selon les critères
 */
function filterCompanies(
  companies: Array<Record<string, unknown>>,
  config: ExportConfig
): Array<Record<string, unknown>> {
  let result = companies

  // Sélection personnalisée par IDs
  if (config.selectedIds && config.selectedIds.length > 0) {
    result = result.filter((c) => config.selectedIds!.includes(c.id as string))
    return result
  }

  // Filtres
  if (config.filters) {
    const f = config.filters

    if (f.sectors && f.sectors.length > 0) {
      result = result.filter((c) => f.sectors!.includes(c.sector as string))
    }
    if (f.communes && f.communes.length > 0) {
      result = result.filter((c) => f.communes!.includes(c.commune as string))
    }
    if (f.cities && f.cities.length > 0) {
      result = result.filter((c) => f.cities!.includes(c.city as string))
    }
    if (f.status && f.status.length > 0) {
      result = result.filter((c) => f.status!.includes(c.status as string))
    }
    if (f.minRating !== undefined) {
      result = result.filter((c) => (c.rating as number) >= f.minRating!)
    }
    if (f.minConfidence !== undefined) {
      result = result.filter((c) => (c.confidence as number) >= f.minConfidence!)
    }
    if (f.searchQuery) {
      const q = f.searchQuery.toLowerCase()
      result = result.filter((c) =>
        (c.name as string).toLowerCase().includes(q) ||
        (c.sector as string).toLowerCase().includes(q)
      )
    }
    if (f.hasPhone) {
      result = result.filter((c) => c.phone && String(c.phone).length > 0)
    }
    if (f.hasEmail) {
      result = result.filter((c) => c.email && String(c.email).length > 0)
    }
    if (f.hasWebsite) {
      result = result.filter((c) => c.website && String(c.website).length > 0)
    }
  }

  return result
}

/**
 * Lance un job d'export asynchrone
 */
export function startExportJob(jobId: string, config: ExportConfig): ExportJob {
  const filename = config.filename || `export_entreprises_${new Date().toISOString().slice(0, 10)}`

  const job: ExportJob = {
    id: jobId,
    config,
    status: "queued",
    progress: 0,
    totalRows: 0,
    processedRows: 0,
    filename,
    mimeType: MIME_TYPES[config.format],
    errors: [],
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  jobs.set(jobId, job)

  // Lance l'export de façon asynchrone
  ;(async () => {
    try {
      job.status = "processing"
      job.progress = 10

      // 1. Collecte les données
      const allCompanies = getAllCompanies()
      job.progress = 30

      // 2. Filtre
      const filtered = filterCompanies(allCompanies, config)
      job.totalRows = filtered.length
      job.progress = 50

      // 3. Ajuste les colonnes selon les options
      const columns = [...config.columns]
      if (config.includeGps) {
        columns.forEach((c) => {
          if (c.key === "lat" || c.key === "lng") c.selected = true
        })
      }
      if (config.includeSocials) {
        columns.forEach((c) => {
          if (["facebook", "instagram", "linkedin"].includes(c.key)) c.selected = true
        })
      }
      if (config.includeSources) {
        columns.forEach((c) => {
          if (c.key === "sources") c.selected = true
        })
      }

      job.progress = 70

      // 4. Génère le fichier
      const result = await generateExport(
        filtered,
        columns,
        filename,
        config.format,
        config.zipFormats
      )

      job.progress = 90
      job.processedRows = filtered.length
      job.fileSizeBytes = result.buffer.length
      job.filename = result.filename
      job.mimeType = result.mimeType

      // Stocke en base64 data URL (pour téléchargement direct via API)
      job.dataUrl = `data:${result.mimeType};base64,${result.buffer.toString("base64")}`

      job.status = "completed"
      job.progress = 100
      job.completedAt = new Date().toISOString()
    } catch (err) {
      job.status = "failed"
      job.errors.push((err as Error).message)
    }
  })()

  return job
}

export function getExportJob(jobId: string): ExportJob | undefined {
  return jobs.get(jobId)
}

export function listExportJobs(): ExportJob[] {
  return Array.from(jobs.values()).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function deleteExportJob(jobId: string): boolean {
  return jobs.delete(jobId)
}

export function getExportStats() {
  const allJobs = Array.from(jobs.values())
  const completed = allJobs.filter((j) => j.status === "completed")
  const byFormat: Record<string, number> = {}
  let totalRows = 0
  let totalSize = 0

  for (const job of completed) {
    byFormat[job.config.format] = (byFormat[job.config.format] || 0) + 1
    totalRows += job.totalRows
    totalSize += job.fileSizeBytes || 0
  }

  return {
    totalExports: completed.length,
    totalRowsExported: totalRows,
    byFormat,
    totalSizeBytes: totalSize,
  }
}
