/**
 * Générateurs d'export par format
 * - Excel (xlsx) via SheetJS
 * - CSV via json2csv
 * - PDF via PDFKit
 * - JSON natif
 * - ZIP via JSZip (combine plusieurs formats)
 */

import * as XLSX from "xlsx"
import { Parser as Json2csvParser } from "json2csv"
import JSZip from "jszip"
import type { ExportColumn, ExportFormat } from "./types"
import { generatePDF } from "./pdf-generator"

export interface ExportRow {
  [key: string]: unknown
}

export interface ExportResult {
  buffer: Buffer
  mimeType: string
  filename: string
}

/**
 * Filtre les colonnes sélectionnées et prépare les données
 */
function prepareData(
  rows: ExportRow[],
  columns: ExportColumn[]
): { headers: string[]; keys: string[]; data: Record<string, unknown>[] } {
  const selected = columns.filter((c) => c.selected)
  const keys = selected.map((c) => c.key)
  const headers = selected.map((c) => c.label)

  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {}
    for (const col of selected) {
      let value = row[col.key]
      // Transformations
      if (col.key === "sources" && Array.isArray(value)) {
        value = (value as string[]).join(", ")
      }
      if (col.key === "lat" || col.key === "lng") {
        value = typeof value === "number" ? value : ""
      }
      if (value === undefined || value === null) {
        value = ""
      }
      obj[col.label] = value
    }
    return obj
  })

  return { headers, keys, data }
}

// ============================================================================
// EXCEL (.xlsx)
// ============================================================================

export function generateExcel(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string
): ExportResult {
  const { data } = prepareData(rows, columns)

  const ws = XLSX.utils.json_to_sheet(data, {
    header: columns.filter((c) => c.selected).map((c) => c.label),
  })

  // Largeurs de colonnes
  ws["!cols"] = columns.filter((c) => c.selected).map((c) => ({
    wch: c.width || 15,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Entreprises")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

  return {
    buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${filename}.xlsx`,
  }
}

// ============================================================================
// CSV
// ============================================================================

export function generateCSV(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string
): ExportResult {
  const { data, headers } = prepareData(rows, columns)

  const parser = new Json2csvParser({
    fields: headers,
    defaultValue: "",
    header: true,
    eol: "\n",
  })

  const csv = parser.parse(data)
  const buffer = Buffer.from("\ufeff" + csv, "utf-8") // BOM pour Excel

  return {
    buffer,
    mimeType: "text/csv",
    filename: `${filename}.csv`,
  }
}

// ============================================================================
// JSON
// ============================================================================

export function generateJSON(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string
): ExportResult {
  const { data } = prepareData(rows, columns)

  const json = JSON.stringify({
    metadata: {
      exportedAt: new Date().toISOString(),
      count: data.length,
      columns: columns.filter((c) => c.selected).map((c) => c.key),
      source: "ScrapIQ CI",
    },
    companies: data,
  }, null, 2)

  const buffer = Buffer.from(json, "utf-8")

  return {
    buffer,
    mimeType: "application/json",
    filename: `${filename}.json`,
  }
}

// ============================================================================
// PDF — voir pdf-generator.ts (génération native sans PDFKit)
// ============================================================================

// ============================================================================
// DISPATCHER (see generateExport below)
// ============================================================================

/**
 * Génère un export de manière synchrone ou asynchrone selon le format
 * PDF et ZIP sont async (streams)
 */
export async function generateExport(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string,
  format: ExportFormat,
  zipFormats?: ExportFormat[]
): Promise<ExportResult> {
  switch (format) {
    case "xlsx":
      return generateExcel(rows, columns, filename)
    case "csv":
      return generateCSV(rows, columns, filename)
    case "json":
      return generateJSON(rows, columns, filename)
    case "pdf":
      return Promise.resolve(generatePDF(rows, columns, filename))
    case "zip": {
      // ZIP : génère les sous-formats puis compresse
      const zip = new JSZip()
      const subFormats = (zipFormats || ["xlsx", "csv", "json"]).filter((f) => f !== "zip")
      for (const subFormat of subFormats) {
        const subResult = await generateExport(rows, columns, filename, subFormat)
        zip.file(subResult.filename, subResult.buffer)
      }
      zip.file("README.txt",
        `ScrapIQ CI — Export multi-formats\n\n` +
        `Date: ${new Date().toISOString()}\n` +
        `Entreprises: ${rows.length}\n` +
        `Formats inclus: ${subFormats.join(", ")}\n` +
        `\nGenere par ScrapIQ CI - Web Scraping Intelligent\n`
      )
      const buffer = await zip.generateAsync({ type: "nodebuffer" })
      return {
        buffer,
        mimeType: "application/zip",
        filename: `${filename}.zip`,
      }
    }
    default:
      throw new Error(`Format non supporté: ${format}`)
  }
}
