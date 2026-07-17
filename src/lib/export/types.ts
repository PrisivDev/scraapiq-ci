/**
 * Types du moteur d'export
 */

export type ExportFormat = "xlsx" | "csv" | "pdf" | "json" | "zip"

export interface ExportColumn {
  key: string
  label: string
  selected: boolean
  width?: number
}

export interface ExportFilters {
  sectors?: string[]
  communes?: string[]
  cities?: string[]
  status?: string[]
  minRating?: number
  minConfidence?: number
  searchQuery?: string
  hasPhone?: boolean
  hasEmail?: boolean
  hasWebsite?: boolean
}

export interface ExportConfig {
  format: ExportFormat
  columns: ExportColumn[]
  filters?: ExportFilters
  /** IDs spécifiques d'entreprises (sélection personnalisée) */
  selectedIds?: string[]
  /** Inclure les colonnes GPS */
  includeGps?: boolean
  /** Inclure les réseaux sociaux */
  includeSocials?: boolean
  /** Inclure les sources */
  includeSources?: boolean
  /** Nom du fichier (sans extension) */
  filename?: string
  /** Pour ZIP : formats multiples à inclure */
  zipFormats?: ExportFormat[]
}

export interface ExportJob {
  id: string
  config: ExportConfig
  status: "queued" | "processing" | "completed" | "failed"
  progress: number
  totalRows: number
  processedRows: number
  fileSizeBytes?: number
  filename: string
  mimeType: string
  dataUrl?: string // base64 data URL pour téléchargement direct
  errors: string[]
  startedAt: string
  completedAt?: string
  createdAt: string
}

export interface ExportStats {
  totalExports: number
  totalRowsExported: number
  byFormat: Record<string, number>
  totalSizeBytes: number
}

// Colonnes disponibles par défaut
export const DEFAULT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Nom", selected: true, width: 30 },
  { key: "sector", label: "Secteur", selected: true, width: 20 },
  { key: "commune", label: "Commune", selected: true, width: 15 },
  { key: "city", label: "Ville", selected: true, width: 15 },
  { key: "address", label: "Adresse", selected: true, width: 30 },
  { key: "phone", label: "Téléphone", selected: true, width: 18 },
  { key: "email", label: "Email", selected: true, width: 25 },
  { key: "website", label: "Site Web", selected: true, width: 25 },
  { key: "rating", label: "Note", selected: false, width: 8 },
  { key: "reviewCount", label: "Nb avis", selected: false, width: 10 },
  { key: "status", label: "Statut", selected: false, width: 12 },
  { key: "employees", label: "Effectif", selected: false, width: 12 },
  { key: "lat", label: "Latitude", selected: false, width: 12 },
  { key: "lng", label: "Longitude", selected: false, width: 12 },
  { key: "rccm", label: "RCCM", selected: false, width: 20 },
  { key: "description", label: "Description", selected: false, width: 50 },
  { key: "sources", label: "Sources", selected: false, width: 30 },
  { key: "facebook", label: "Facebook", selected: false, width: 25 },
  { key: "instagram", label: "Instagram", selected: false, width: 25 },
  { key: "linkedin", label: "LinkedIn", selected: false, width: 25 },
]

export const MIME_TYPES: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pdf: "application/pdf",
  json: "application/json",
  zip: "application/zip",
}

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  pdf: "PDF (.pdf)",
  json: "JSON (.json)",
  zip: "ZIP multi-formats",
}
