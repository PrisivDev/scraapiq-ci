/**
 * Données mock enrichies pour le dashboard analytics complet
 */

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

export const dashboardKpis: KpiData[] = [
  {
    id: "companies",
    label: "Entreprises indexées",
    value: 38862,
    formattedValue: "38 862",
    delta: 12.4,
    deltaLabel: "+4 283 ce mois",
    trend: "up",
    sparkline: [28500, 29800, 31200, 32800, 34100, 35900, 37200, 38862],
    icon: "building",
    color: "emerald",
    hint: "Total toutes sources confondues",
  },
  {
    id: "jobs",
    label: "Jobs de scraping actifs",
    value: 12,
    formattedValue: "12",
    delta: 3,
    deltaLabel: "+3 vs hier",
    trend: "up",
    sparkline: [5, 7, 8, 6, 9, 10, 11, 12],
    icon: "activity",
    color: "emerald",
    hint: "2 en cours, 10 en file",
  },
  {
    id: "sources",
    label: "Sources connectées",
    value: 6,
    formattedValue: "6/6",
    delta: 0,
    deltaLabel: "5 OK, 1 maintenance",
    trend: "stable",
    sparkline: [6, 6, 6, 5, 6, 6, 6, 6],
    icon: "database",
    color: "emerald",
    hint: "LinkedIn en maintenance",
  },
  {
    id: "dedup",
    label: "Taux de déduplication",
    value: 17.8,
    formattedValue: "17.8%",
    delta: -1.2,
    deltaLabel: "8 421 doublons fusionnés",
    trend: "down",
    sparkline: [22, 21, 20, 19, 19, 18, 18, 17.8],
    icon: "git-merge",
    color: "orange",
    hint: "Baisse = meilleure qualité source",
  },
  {
    id: "enrichment",
    label: "Taux d'enrichissement IA",
    value: 84.2,
    formattedValue: "84.2%",
    delta: 4.8,
    deltaLabel: "+2 100 fiches enrichies",
    trend: "up",
    sparkline: [72, 75, 78, 79, 81, 82, 83, 84.2],
    icon: "sparkles",
    color: "emerald",
    hint: "Par moteur LLM z-ai",
  },
  {
    id: "api",
    label: "Appels API (30 j)",
    value: 124530,
    formattedValue: "124,5 k",
    delta: 18.9,
    deltaLabel: "+19 700 vs mois prec.",
    trend: "up",
    sparkline: [85000, 92000, 98000, 105000, 112000, 118000, 121000, 124530],
    icon: "zap",
    color: "orange",
    hint: "68% du quota utilisé",
  },
  {
    id: "quality",
    label: "Score qualité moyen",
    value: 78,
    formattedValue: "78/100",
    delta: 5,
    deltaLabel: "+5 pts ce mois",
    trend: "up",
    sparkline: [65, 68, 70, 72, 74, 76, 77, 78],
    icon: "award",
    color: "emerald",
    hint: "Complétude + validité contacts",
  },
  {
    id: "alerts",
    label: "Alertes actives",
    value: 3,
    formattedValue: "3",
    delta: -2,
    deltaLabel: "-2 vs hier",
    trend: "down",
    sparkline: [7, 6, 5, 5, 4, 4, 3, 3],
    icon: "bell",
    color: "orange",
    hint: "1 critique, 2 warnings",
  },
]

// ============================================================================
// TIMESERIES — Volume de scraping 30 jours
// ============================================================================

export const scrapingTimeseries30d = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const base = isWeekend ? 350 : 720
  const variance = Math.sin(i / 3) * 150 + Math.random() * 200
  return {
    date: date.toISOString().slice(0, 10),
    dateLabel: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    google: Math.round(base + variance),
    facebook: Math.round((base + variance) * 0.65),
    linkedin: Math.round((base + variance) * 0.35),
    website: Math.round((base + variance) * 0.45),
    total: 0, // calculé après
  }
}).map((d) => ({
  ...d,
  total: d.google + d.facebook + d.linkedin + d.website,
}))

// Timeseries 7 jours (plus détaillé par heure)
export const scrapingTimeseries7d = Array.from({ length: 7 * 24 }, (_, i) => {
  const dayIdx = Math.floor(i / 24)
  const hour = i % 24
  const date = new Date()
  date.setDate(date.getDate() - (6 - dayIdx))
  date.setHours(hour, 0, 0, 0)
  const isBusinessHours = hour >= 8 && hour <= 19
  const base = isBusinessHours ? 45 : 8
  const variance = Math.random() * 20
  return {
    time: date.toISOString(),
    label: date.toLocaleString("fr-FR", { weekday: "short", hour: "2-digit" }),
    value: Math.max(0, Math.round(base + variance)),
  }
})

// ============================================================================
// RÉPARTITION PAR SECTEUR
// ============================================================================

export const sectorDistribution = [
  { name: "Restauration", value: 8420, color: "var(--chart-1)", percentage: 21.7 },
  { name: "Commerce", value: 7180, color: "var(--chart-2)", percentage: 18.5 },
  { name: "Télécom", value: 5240, color: "var(--chart-3)", percentage: 13.5 },
  { name: "BTP", value: 4620, color: "var(--chart-4)", percentage: 11.9 },
  { name: "Santé", value: 3890, color: "var(--chart-5)", percentage: 10.0 },
  { name: "Banque", value: 3210, color: "oklch(0.65 0.18 280)", percentage: 8.3 },
  { name: "Agro", value: 2840, color: "oklch(0.7 0.15 100)", percentage: 7.3 },
  { name: "Autres", value: 3462, color: "oklch(0.7 0 0)", percentage: 8.8 },
]

// ============================================================================
// RÉPARTITION GÉOGRAPHIQUE (communes d'Abidjan)
// ============================================================================

export const communeDistribution = [
  { commune: "Cocody", entreprises: 8210, growth: 14.2, lat: 5.3461, lng: -3.9986 },
  { commune: "Plateau", entreprises: 6890, growth: 8.5, lat: 5.3181, lng: -4.0181 },
  { commune: "Yopougon", entreprises: 5760, growth: 18.3, lat: 5.3406, lng: -4.0858 },
  { commune: "Marcory", entreprises: 4340, growth: 6.1, lat: 5.2994, lng: -4.0183 },
  { commune: "Treichville", entreprises: 3980, growth: 4.8, lat: 5.2925, lng: -4.0114 },
  { commune: "Koumassi", entreprises: 3620, growth: 9.4, lat: 5.2856, lng: -3.9967 },
  { commune: "Abobo", entreprises: 3450, growth: 22.1, lat: 5.4244, lng: -4.0167 },
  { commune: "Adjamé", entreprises: 3280, growth: 7.2, lat: 5.3619, lng: -4.0178 },
  { commune: "Port-Bouët", entreprises: 2890, growth: 11.5, lat: 5.2656, lng: -3.9919 },
  { commune: "Bingerville", entreprises: 2120, growth: 28.4, lat: 5.3508, lng: -3.8939 },
]

// ============================================================================
// TOP ENTREPRISES (leaderboard)
// ============================================================================

export const topCompanies = [
  { rank: 1, name: "Orange CI", sector: "Télécom", score: 98, jobs: 412, growth: 12.4 },
  { rank: 2, name: "MTN Côte d'Ivoire", sector: "Télécom", score: 96, jobs: 387, growth: 8.9 },
  { rank: 3, name: "BICICI", sector: "Banque", score: 95, jobs: 342, growth: 5.2 },
  { rank: 4, name: "SIFCA Industries", sector: "Agro", score: 94, jobs: 298, growth: 18.3 },
  { rank: 5, name: "CFAO Motors CI", sector: "Commerce", score: 92, jobs: 276, growth: 6.7 },
  { rank: 6, name: "Société Ivoirienne de Cacao", sector: "Agro", score: 91, jobs: 254, growth: 14.8 },
  { rank: 7, name: "Hôtel Ibis Abidjan", sector: "Tourisme", score: 89, jobs: 231, growth: 3.2 },
  { rank: 8, name: "BTP Afrique Construction", sector: "BTP", score: 87, jobs: 208, growth: 22.1 },
]

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

const now = Date.now()
const min = 60 * 1000
const hour = 60 * min

export const recentActivities: Activity[] = [
  {
    id: "a1",
    type: "job_completed",
    title: "Job de scraping terminé",
    description: "142 entreprises extraites (Google Maps · Cocody · restaurants)",
    user: "A. Koné",
    timestamp: new Date(now - 2 * min).toISOString(),
    icon: "check-circle",
    color: "emerald",
    metadata: { jobId: "scrape-0091", results: 142 },
  },
  {
    id: "a2",
    type: "ai_dedup",
    title: "Déduplication IA terminée",
    description: "18 doublons fusionnés (Jaro-Winkler + GPS, score moyen 0.92)",
    user: "Système IA",
    timestamp: new Date(now - 8 * min).toISOString(),
    icon: "git-merge",
    color: "violet",
    metadata: { duplicates: 18, confidence: 0.92 },
  },
  {
    id: "a3",
    type: "alert_triggered",
    title: "Source dégradée détectée",
    description: "Pages Jaunes CI — taux de succès tombé à 78.1%",
    user: "Système",
    timestamp: new Date(now - 15 * min).toISOString(),
    icon: "alert-triangle",
    color: "orange",
    metadata: { source: "Pages Jaunes", successRate: 78.1 },
  },
  {
    id: "a4",
    type: "export_downloaded",
    title: "Export Excel téléchargé",
    description: "entreprises_ci_dec2026.xlsx (12 384 lignes, 2.4 Mo)",
    user: "M. Traoré",
    timestamp: new Date(now - 23 * min).toISOString(),
    icon: "download",
    color: "blue",
    metadata: { format: "xlsx", rows: 12384 },
  },
  {
    id: "a5",
    type: "ai_enrich",
    title: "Enrichissement IA terminé",
    description: "29 champs complétés via LLM z-ai sur 12 entités",
    user: "Système IA",
    timestamp: new Date(now - 35 * min).toISOString(),
    icon: "sparkles",
    color: "violet",
    metadata: { fieldsCompleted: 29, llmCalls: 11 },
  },
  {
    id: "a6",
    type: "company_added",
    title: "Nouvelle entreprise indexée",
    description: "Restaurant Le Wôyô — Cocody, Abidjan (+225 07 08 12 34 56)",
    user: "Système",
    timestamp: new Date(now - 42 * min).toISOString(),
    icon: "building",
    color: "emerald",
    metadata: { sector: "Restauration", commune: "Cocody" },
  },
  {
    id: "a7",
    type: "job_started",
    title: "Nouveau job de scraping lancé",
    description: "Recherche: pharmacies + Plateau (2 sources)",
    user: "A. Koné",
    timestamp: new Date(now - 48 * min).toISOString(),
    icon: "play",
    color: "blue",
    metadata: { jobId: "scrape-0092", sources: 2 },
  },
  {
    id: "a8",
    type: "user_invited",
    title: "Membre invité",
    description: "Yasmine Kone (yasmine@agribusiness.ci) — rôle: Agent",
    user: "M. Traoré",
    timestamp: new Date(now - 1 * hour - 12 * min).toISOString(),
    icon: "user-plus",
    color: "blue",
    metadata: { role: "AGENT" },
  },
  {
    id: "a9",
    type: "source_synced",
    title: "Source synchronisée",
    description: "RCCM Côte d'Ivoire — 24 156 enregistrements (99.4% succès)",
    user: "Système",
    timestamp: new Date(now - 1 * hour - 28 * min).toISOString(),
    icon: "database",
    color: "emerald",
    metadata: { source: "RCCM", records: 24156 },
  },
  {
    id: "a10",
    type: "alert_resolved",
    title: "Alerte résolue",
    description: "Quota API revenu sous 80% — surveillance désactivée",
    user: "Système",
    timestamp: new Date(now - 2 * hour - 5 * min).toISOString(),
    icon: "check-circle",
    color: "emerald",
  },
  {
    id: "a11",
    type: "company_merged",
    title: "Entreprises fusionnées",
    description: "Orange CI (3 variantes) → 1 fiche canonique (confiance 0.94)",
    user: "Système IA",
    timestamp: new Date(now - 2 * hour - 34 * min).toISOString(),
    icon: "git-merge",
    color: "violet",
    metadata: { merged: 3, canonical: "Orange CI" },
  },
  {
    id: "a12",
    type: "job_failed",
    title: "Job échoué",
    description: "hôtellerie + San-Pédro — timeout après 5 min",
    user: "S. Bamba",
    timestamp: new Date(now - 3 * hour - 12 * min).toISOString(),
    icon: "x-circle",
    color: "red",
    metadata: { jobId: "scrape-0086", error: "timeout" },
  },
  {
    id: "a13",
    type: "user_login",
    title: "Connexion utilisateur",
    description: "Adama Koné s'est connecté (Abidjan, CI)",
    user: "A. Koné",
    timestamp: new Date(now - 4 * hour).toISOString(),
    icon: "log-in",
    color: "slate",
  },
]

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

export const dashboardAlerts: Alert[] = [
  {
    id: "al1",
    severity: "critical",
    status: "active",
    title: "Quota API à 68%",
    description: "Vous avez utilisé 68% de votre quota mensuel (124.5k / 100k appels). Pensez à recharger votre forfait Pro.",
    source: "Système de facturation",
    triggeredAt: new Date(now - 1 * hour).toISOString(),
    icon: "zap",
  },
  {
    id: "al2",
    severity: "warning",
    status: "active",
    title: "Source Pages Jaunes dégradée",
    description: "Taux de succès tombé à 78.1% (vs 94% habituel). Possible blocage anti-bot.",
    source: "Monitoring sources",
    triggeredAt: new Date(now - 15 * min).toISOString(),
    icon: "alert-triangle",
  },
  {
    id: "al3",
    severity: "warning",
    status: "active",
    title: "1 entreprise fermée détectée",
    description: "L'IA a identifié 'Ancienne Pharmacie de Plateau' comme fermée définitivement.",
    source: "Moteur IA",
    triggeredAt: new Date(now - 35 * min).toISOString(),
    icon: "lock",
  },
  {
    id: "al4",
    severity: "info",
    status: "resolved",
    title: "Maintenance LinkedIn programmée",
    description: "Le scraping LinkedIn sera indisponible le 18/07 de 02h à 04h GMT.",
    source: "Système",
    triggeredAt: new Date(now - 6 * hour).toISOString(),
    acknowledgedBy: "M. Traoré",
    icon: "info",
  },
  {
    id: "al5",
    severity: "info",
    status: "resolved",
    title: "Nouveau secteur ajouté",
    description: "Le secteur 'Beauté & Bien-être' a été ajouté au référentiel (18 secteurs au total).",
    source: "Moteur IA",
    triggeredAt: new Date(now - 1 * 24 * hour).toISOString(),
    icon: "info",
  },
]

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

export const exportHistory: ExportRecord[] = [
  { id: "exp-001", filename: "entreprises_ci_dec2026.xlsx", format: "xlsx", rows: 12384, size: "2.4 Mo", status: "completed", createdBy: "A. Koné", createdAt: new Date(now - 5 * min).toISOString(), filters: "Tous secteurs · Abidjan" },
  { id: "exp-002", filename: "pharma_cocody.csv", format: "csv", rows: 284, size: "85 Ko", status: "completed", createdBy: "M. Traoré", createdAt: new Date(now - 5 * hour).toISOString(), filters: "Pharmacie · Cocody" },
  { id: "exp-003", filename: "banques_abidjan.json", format: "json", rows: 156, size: "120 Ko", status: "completed", createdBy: "A. Koné", createdAt: new Date(now - 1 * 24 * hour).toISOString(), filters: "Banque · Abidjan" },
  { id: "exp-004", filename: "btp_yopougon.xlsx", format: "xlsx", rows: 89, size: "45 Ko", status: "processing", createdBy: "S. Bamba", createdAt: new Date(now - 10 * min).toISOString(), filters: "BTP · Yopougon" },
  { id: "exp-005", filename: "restos_plateau.pdf", format: "pdf", rows: 412, size: "1.8 Mo", status: "completed", createdBy: "A. Koné", createdAt: new Date(now - 2 * 24 * hour).toISOString(), filters: "Restauration · Plateau" },
  { id: "exp-006", filename: "hotels_sanpedro.xlsx", format: "xlsx", rows: 0, size: "-", status: "failed", createdBy: "S. Bamba", createdAt: new Date(now - 5 * 24 * hour).toISOString(), filters: "Hôtellerie · San-Pédro" },
  { id: "exp-007", filename: "export_complet_ci.xlsx", format: "xlsx", rows: 38862, size: "12.4 Mo", status: "completed", createdBy: "A. Koné", createdAt: new Date(now - 7 * 24 * hour).toISOString(), filters: "Tous · Côte d'Ivoire" },
]

// ============================================================================
// PERFORMANCE DES SOURCES
// ============================================================================

export const sourcePerformance = [
  { source: "Google Maps", requests: 48213, success: 97.8, avgTime: 1.2, records: 48213, color: "var(--chart-1)" },
  { source: "Facebook Pages", requests: 31078, success: 91.5, avgTime: 2.8, records: 31078, color: "var(--chart-2)" },
  { source: "Annuaire.ci", requests: 18902, success: 94.2, avgTime: 0.8, records: 18902, color: "var(--chart-3)" },
  { source: "RCCM CI", requests: 24156, success: 99.4, avgTime: 0.5, records: 24156, color: "var(--chart-4)" },
  { source: "LinkedIn", requests: 8765, success: 88.9, avgTime: 3.5, records: 8765, color: "var(--chart-5)" },
  { source: "Pages Jaunes", requests: 12340, success: 78.1, avgTime: 1.9, records: 12340, color: "oklch(0.7 0 0)" },
]

// ============================================================================
// ÉVOLUTION DES SCORES QUALITÉ
// ============================================================================

export const qualityEvolution = Array.from({ length: 12 }, (_, i) => {
  const date = new Date()
  date.setMonth(date.getMonth() - (11 - i))
  return {
    month: date.toLocaleDateString("fr-FR", { month: "short" }),
    completeness: 60 + i * 2 + Math.random() * 5,
    contactValidity: 55 + i * 2.5 + Math.random() * 5,
    geoAccuracy: 40 + i * 3 + Math.random() * 5,
    sourceReliability: 70 + i * 1 + Math.random() * 5,
    onlinePresence: 45 + i * 3.5 + Math.random() * 5,
    overall: 50 + i * 2.3 + Math.random() * 3,
  }
})

// ============================================================================
// RADAR — Qualité par dimension (mois courant vs précédent)
// ============================================================================

export const qualityRadar = [
  { dimension: "Complétude", current: 85, previous: 78, fullMark: 100 },
  { dimension: "Contacts", current: 78, previous: 72, fullMark: 100 },
  { dimension: "Nom", current: 92, previous: 88, fullMark: 100 },
  { dimension: "Géoloc", current: 68, previous: 55, fullMark: 100 },
  { dimension: "Sources", current: 88, previous: 85, fullMark: 100 },
  { dimension: "Fraîcheur", current: 92, previous: 80, fullMark: 100 },
  { dimension: "Online", current: 72, previous: 60, fullMark: 100 },
]

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

export const searchableItems: SearchItem[] = [
  // Pages
  { id: "p1", type: "page", label: "Tableau de bord", icon: "layout-dashboard", keywords: ["dashboard", "home", "accueil"], url: "#dashboard" },
  { id: "p2", type: "page", label: "Recherche multicritère", icon: "search", keywords: ["search", "recherche", "filtres"], url: "#search" },
  { id: "p3", type: "page", label: "Entreprises", icon: "building", keywords: ["companies", "entreprises", "liste"], url: "#companies" },
  { id: "p4", type: "page", label: "Cartographie", icon: "map", keywords: ["map", "carte", "geo"], url: "#map" },
  { id: "p5", type: "page", label: "Moteur de scraping", icon: "radar", keywords: ["scraper", "google maps", "facebook"], url: "#scraper" },
  { id: "p6", type: "page", label: "Sources de données", icon: "database", keywords: ["sources", "google", "facebook", "rccm"], url: "#sources" },
  { id: "p7", type: "page", label: "Jobs de scraping", icon: "activity", keywords: ["jobs", "scraping", "queue"], url: "#jobs" },
  { id: "p8", type: "page", label: "Exports", icon: "download", keywords: ["export", "excel", "csv", "download"], url: "#exports" },
  { id: "p9", type: "page", label: "Équipe & tenants", icon: "users", keywords: ["team", "membres", "org"], url: "#team" },
  { id: "p10", type: "page", label: "Paramètres", icon: "settings", keywords: ["settings", "config", "profil"], url: "#settings" },
  { id: "p11", type: "page", label: "API REST", icon: "database", keywords: ["api", "rest", "swagger", "webhooks", "documentation", "v1"], url: "#api" },
  { id: "p12", type: "page", label: "Notifications", icon: "bell", keywords: ["notifications", "alertes", "rapports", "email", "sms", "whatsapp", "push", "webhook"], url: "#notifications" },
  { id: "p13", type: "page", label: "Back Office", icon: "shield", keywords: ["backoffice", "admin", "administration", "audit", "logs", "quota", "maintenance", "abonnements", "paiements"], url: "#backoffice" },
  // Actions
  { id: "a1", type: "action", label: "Lancer un job de scraping", icon: "play", keywords: ["lancer", "job", "scraping", "nouveau"] },
  { id: "a2", type: "action", label: "Exporter en Excel", icon: "file-spreadsheet", keywords: ["export", "excel", "xlsx"] },
  { id: "a3", type: "action", label: "Inviter un membre", icon: "user-plus", keywords: ["inviter", "membre", "team"] },
  { id: "a4", type: "action", label: "Basculuer thème", icon: "moon", keywords: ["theme", "dark", "light"] },
  // Entreprises (échantillon)
  { id: "c1", type: "company", label: "Orange CI - Agence Cocody", description: "Télécommunications · Cocody", icon: "building", keywords: ["orange", "telecom", "cocody"] },
  { id: "c2", type: "company", label: "MTN Côte d'Ivoire", description: "Télécommunications · Cocody", icon: "building", keywords: ["mtn", "telecom"] },
  { id: "c3", type: "company", label: "BICICI Succursale Plateau", description: "Banque · Plateau", icon: "building", keywords: ["bicici", "banque", "plateau"] },
  { id: "c4", type: "company", label: "SIFCA Industries", description: "Agro-alimentaire · Plateau", icon: "building", keywords: ["sifca", "agro"] },
  { id: "c5", type: "company", label: "Restaurant Le Wôyô", description: "Restauration · Cocody", icon: "building", keywords: ["woyo", "restaurant", "cocody"] },
  // Jobs
  { id: "j1", type: "job", label: "scrape-0091 — restaurants Cocody", description: "Terminé · 142 résultats", icon: "activity", keywords: ["scrape", "restaurant", "cocody"] },
  { id: "j2", type: "job", label: "scrape-0090 — pharmacies Plateau", description: "En cours · 34%", icon: "activity", keywords: ["scrape", "pharmacie", "plateau"] },
  { id: "j3", type: "job", label: "ai-clean-5770 — nettoyage IA", description: "Terminé · 9 entités nettoyées", icon: "sparkles", keywords: ["ai", "clean", "nettoyage"] },
  // Exports
  { id: "e1", type: "export", label: "entreprises_ci_dec2026.xlsx", description: "12 384 lignes · 2.4 Mo", icon: "file-spreadsheet", keywords: ["export", "excel", "decembre"] },
  // Alertes
  { id: "al1", type: "alert", label: "Quota API à 68%", description: "Critique · Il y a 1h", icon: "zap", keywords: ["quota", "api", "alerte"] },
  { id: "al2", type: "alert", label: "Source Pages Jaunes dégradée", description: "Warning · Il y a 15 min", icon: "alert-triangle", keywords: ["pages jaunes", "degrade", "alerte"] },
]

// ============================================================================
// STATISTIQUES TEMPS RÉEL (simulées)
// ============================================================================

export const realtimeStats = {
  activeUsers: 4,
  requestsPerMinute: 28,
  avgResponseTime: 142,
  uptime: 99.97,
  lastIncident: "il y a 3 jours",
  cpuUsage: 34,
  memoryUsage: 58,
  diskUsage: 41,
}
