// Production: données mock supprimées. Brancher la source réelle (DB/API).
// All arrays are empty by design — components must handle empty states gracefully.
// Types/interfaces are preserved because they are imported by ~27 components.

// ============================================================================
// KPIs AVEC TRENDS
// ============================================================================

export interface KpiData {
  id: string
  label: string
  value: number | string
  formattedValue: string
  delta: number
  deltaLabel: string
  trend: "up" | "down" | "stable"
  sparkline: number[]
  icon: string
  color: string
  hint: string
}

// Production: empty array — wire to real KPI aggregation.
export const dashboardKpis: KpiData[] = []

// ============================================================================
// TIMESERIES — Volume de scraping
// ============================================================================

// Production: empty array — wire to real scraping telemetry.
export const scrapingTimeseries30d: Array<{
  date: string
  dateLabel: string
  google: number
  facebook: number
  linkedin: number
  website: number
  total: number
}> = []

// Production: empty array — wire to real scraping telemetry.
export const scrapingTimeseries7d: Array<{
  time: string
  label: string
  value: number
}> = []

// ============================================================================
// RÉPARTITION PAR SECTEUR
// ============================================================================

// Production: empty array — wire to real analytics.
export const sectorDistribution: Array<{
  name: string
  value: number
  color: string
  percentage: number
}> = []

// ============================================================================
// RÉPARTITION GÉOGRAPHIQUE (communes d'Abidjan)
// ============================================================================

// Production: empty array — wire to real analytics.
// (Commune coordinates live in src/lib/geo-data.ts `abidjanCommunes` as reference data.)
export const communeDistribution: Array<{
  commune: string
  entreprises: number
  growth: number
  lat: number
  lng: number
}> = []

// ============================================================================
// TOP ENTREPRISES (leaderboard)
// ============================================================================

// Production: empty array — wire to real analytics.
export const topCompanies: Array<{
  rank: number
  name: string
  sector: string
  score: number
  jobs: number
  growth: number
}> = []

// ============================================================================
// FIL D'ACTIVITÉ TEMPS RÉEL
// ============================================================================

export type ActivityType =
  | "job_started" | "job_completed" | "job_failed"
  | "company_added" | "company_enriched" | "company_merged"
  | "export_created" | "export_downloaded"
  | "alert_triggered" | "alert_resolved"
  | "source_synced" | "source_degraded"
  | "user_login" | "user_invited"
  | "ai_dedup" | "ai_enrich"

export interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  user: string
  timestamp: string
  icon: string
  color: string
  metadata?: Record<string, unknown>
}

// Production: empty array — wire to real activity stream (DB AuditLog / WebSocket).
export const recentActivities: Activity[] = []

// ============================================================================
// ALERTES
// ============================================================================

export type AlertSeverity = "critical" | "warning" | "info"
export type AlertStatus = "active" | "resolved" | "acknowledged"

export interface Alert {
  id: string
  severity: AlertSeverity
  status: AlertStatus
  title: string
  description: string
  source: string
  triggeredAt: string
  acknowledgedBy?: string
  icon: string
}

// Production: empty array — wire to real AlertRule table (notifications/alerts.ts).
export const dashboardAlerts: Alert[] = []

// ============================================================================
// EXPORTS HISTORIQUE
// ============================================================================

export interface ExportRecord {
  id: string
  filename: string
  format: "xlsx" | "csv" | "json" | "pdf"
  rows: number
  size: string
  status: "completed" | "processing" | "failed"
  createdBy: string
  createdAt: string
  filters: string
}

// Production: empty array — wire to real export-store / DB.
export const exportHistory: ExportRecord[] = []

// ============================================================================
// PERFORMANCE DES SOURCES
// ============================================================================

// Production: empty array — wire to real source monitoring.
export const sourcePerformance: Array<{
  source: string
  requests: number
  success: number
  avgTime: number
  records: number
  color: string
}> = []

// ============================================================================
// ÉVOLUTION DES SCORES QUALITÉ
// ============================================================================

// Production: empty array — wire to real quality telemetry.
export const qualityEvolution: Array<{
  month: string
  completeness: number
  contactValidity: number
  geoAccuracy: number
  sourceReliability: number
  onlinePresence: number
  overall: number
}> = []

// ============================================================================
// RADAR — Qualité par dimension (mois courant vs précédent)
// ============================================================================

// Production: empty array — wire to real quality telemetry.
export const qualityRadar: Array<{
  dimension: string
  current: number
  previous: number
  fullMark: number
}> = []

// ============================================================================
// RECHERCHE GLOBALE — Items indexés pour le ⌘K
// ============================================================================

export interface SearchItem {
  id: string
  type: "company" | "job" | "export" | "alert" | "page" | "action"
  label: string
  description?: string
  icon: string
  url?: string
  keywords: string[]
}

// Production: empty array — pages and actions are config (could be re-added as
// static navigational items) but company/job/export/alert results MUST come
// from real DB queries. Left empty so the palette shows "no results" until
// real sources are wired.
export const searchableItems: SearchItem[] = []

// ============================================================================
// STATISTIQUES TEMPS RÉEL (simulées)
// ============================================================================

// Production: zeros — wire to real infrastructure monitoring.
export const realtimeStats = {
  activeUsers: 0,
  requestsPerMinute: 0,
  avgResponseTime: 0,
  uptime: 0,
  lastIncident: "—",
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
}
