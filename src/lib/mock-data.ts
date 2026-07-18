// Production: données mock supprimées. Brancher la source réelle (DB/API).
// All arrays are empty by design — components must handle empty states gracefully.
// Types/interfaces are preserved because they are imported by ~27 components.

export type CompanyStatus = "verified" | "enriched" | "partial" | "duplicate"
export type JobStatus = "running" | "completed" | "queued" | "failed"

export interface Company {
  id: string
  name: string
  sector: string
  commune: string
  city: string
  phone: string
  email: string
  website: string
  rccm: string
  lat: number
  lng: number
  sources: string[]
  confidence: number
  status: CompanyStatus
  employees: string
  createdAt: string
}

export interface ScrapingJob {
  id: string
  keyword: string
  sources: string[]
  status: JobStatus
  progress: number
  results: number
  duration: string
  createdAt: string
  user: string
}

export interface DataSource {
  id: string
  name: string
  type: string
  status: "active" | "degraded" | "maintenance"
  records: number
  successRate: number
  lastSync: string
  icon: string
}

// Communes d'Abidjan — reference data (NOT mock), kept for map coordinates
export const communes = [
  { name: "Cocody", lat: 5.3461, lng: -3.9986 },
  { name: "Plateau", lat: 5.3181, lng: -4.0181 },
  { name: "Yopougon", lat: 5.3406, lng: -4.0858 },
  { name: "Marcory", lat: 5.2994, lng: -4.0183 },
  { name: "Treichville", lat: 5.2925, lng: -4.0114 },
  { name: "Koumassi", lat: 5.2856, lng: -3.9967 },
  { name: "Abobo", lat: 5.4244, lng: -4.0167 },
  { name: "Adjamé", lat: 5.3619, lng: -4.0178 },
  { name: "Port-Bouët", lat: 5.2656, lng: -3.9919 },
  { name: "Bingerville", lat: 5.3508, lng: -3.8939 },
]

// Référentiel secteurs — reference data (NOT mock)
export const sectors = [
  "Restauration",
  "Banque & Finance",
  "Télécommunications",
  "BTP & Construction",
  "Commerce de gros",
  "Santé & Pharmacie",
  "Éducation & Formation",
  "Logistique & Transport",
  "Agro-alimentaire",
  "Technologie & IT",
  "Énergie",
  "Tourisme & Hôtellerie",
]

// Référentiel villes — reference data (NOT mock)
export const cities = [
  "Abidjan",
  "Bouaké",
  "Yamoussoukro",
  "San-Pédro",
  "Korhogo",
  "Daloa",
  "Man",
  "Gagnoa",
  "Divo",
  "Abengourou",
]

// Production: empty array — wire to real DB (Company table) or scraping results.
export const companies: Company[] = []

// Production: empty array — wire to real scraper job-store.
export const scrapingJobs: ScrapingJob[] = []

// Production: empty array — wire to real source registry (DB or config).
export const dataSources: DataSource[] = []

// Production: empty array — wire to real scraping telemetry.
export const scrapingTrend: Array<{ date: string; google: number; annuaire: number; social: number }> = []

// Production: empty array — wire to real analytics.
export const sectorDistribution: Array<{ name: string; value: number; fill: string }> = []

// Production: empty array — wire to real analytics.
export const communeDistribution: Array<{ commune: string; entreprises: number }> = []

// Production: zeros — wire to real dedup metrics.
export const dedupStats = {
  total: 0,
  duplicates: 0,
  merged: 0,
  rate: 0,
}

// Production: zeros — wire to real KPIs from DB / quota engine.
export const kpis = {
  totalCompanies: 0,
  activeJobs: 0,
  activeSources: 0,
  dedupRate: 0,
  enrichmentRate: 0,
  apiCalls: 0,
  quotaUsed: 0,
  quotaTotal: 0,
}
