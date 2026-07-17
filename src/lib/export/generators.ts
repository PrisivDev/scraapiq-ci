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
import PDFDocument from "pdfkit"
import type { ExportColumn, ExportFormat } from "./types"

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
// PDF
// ============================================================================

export function generatePDF(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string
): ExportResult {
  // Utilise PDFKit pour générer un PDF tabulaire
  const doc = new PDFDocument({
    margin: 30,
    size: "A4",
    layout: "landscape",
  })

  const chunks: Buffer[] = []
  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const selected = columns.filter((c) => c.selected)
  const pageWidth = doc.page.width - 60 // margins
  const colWidth = pageWidth / selected.length

  // Titre
  doc.fontSize(16).font("Helvetica-Bold").text("ScrapIQ CI — Export Entreprises", 30, 30)
  doc.fontSize(9).font("Helvetica").text(
    `${rows.length} entreprises · ${new Date().toLocaleDateString("fr-FR")}`,
    30, 50
  )

  // En-têtes
  let y = 70
  doc.fontSize(7).font("Helvetica-Bold")
  selected.forEach((col, i) => {
    const x = 30 + i * colWidth
    doc.text(col.label, x, y, {
      width: colWidth - 4,
      ellipsis: true,
    })
    // Fond gris
    doc.rect(x - 2, y - 2, colWidth, 14).fill("#f0f0f0").opacity(0.3)
    doc.fillColor("black").opacity(1)
    doc.text(col.label, x, y, { width: colWidth - 4, ellipsis: true })
  })
  y += 16

  // Ligne de séparation
  doc.moveTo(28, y - 2).lineTo(doc.page.width - 28, y - 2).strokeColor("#ccc").lineWidth(0.5).stroke()

  // Données
  doc.fontSize(7).font("Helvetica")
  for (const row of rows) {
    if (y > doc.page.height - 40) {
      doc.addPage()
      y = 30
      // Re-dessine les en-têtes
      doc.fontSize(7).font("Helvetica-Bold")
      selected.forEach((col, i) => {
        const x = 30 + i * colWidth
        doc.text(col.label, x, y, { width: colWidth - 4, ellipsis: true })
      })
      y += 16
      doc.fontSize(7).font("Helvetica")
    }

    selected.forEach((col, i) => {
      const x = 30 + i * colWidth
      let value = row[col.key]
      if (Array.isArray(value)) value = (value as string[]).join(", ")
      if (value === undefined || value === null) value = ""
      doc.text(String(value).slice(0, 100), x, y, {
        width: colWidth - 4,
        ellipsis: true,
        height: 14,
      })
    })
    y += 14
  }

  // Footer
  doc.fontSize(7).fillColor("#999").text(
    `Généré par ScrapIQ CI · ${new Date().toISOString()}`,
    30, doc.page.height - 20
  )

  doc.end()

  // Synchronise : attend la fin de la génération
  const buffer = Buffer.concat(chunks)

  return {
    buffer,
    mimeType: "application/pdf",
    filename: `${filename}.pdf`,
  }
}

// ============================================================================
// ZIP (multi-formats)
// ============================================================================

export async function generateZIP(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string,
  formats: ExportFormat[] = ["xlsx", "csv", "json"]
): Promise<ExportResult> {
  const zip = new JSZip()

  // Ajoute chaque format demandé
  for (const format of formats) {
    if (format === "zip") continue // pas de zip dans zip
    const result = generateByFormat(rows, columns, filename, format)
    zip.file(result.filename, result.buffer)
  }

  // Ajoute un fichier README
  zip.file("README.txt", `ScrapIQ CI — Export multi-formats\n\n` +
    `Date: ${new Date().toISOString()}\n` +
    `Entreprises: ${rows.length}\n` +
    `Formats inclus: ${formats.filter((f) => f !== "zip").join(", ")}\n` +
    `\nGénéré par ScrapIQ CI — Web Scraping Intelligent\n`)

  const buffer = await zip.generateAsync({ type: "nodebuffer" })

  return {
    buffer,
    mimeType: "application/zip",
    filename: `${filename}.zip`,
  }
}

// ============================================================================
// DISPATCHER
// ============================================================================

export function generateByFormat(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string,
  format: ExportFormat
): ExportResult {
  switch (format) {
    case "xlsx":
      return generateExcel(rows, columns, filename)
    case "csv":
      return generateCSV(rows, columns, filename)
    case "json":
      return generateJSON(rows, columns, filename)
    case "pdf":
      return generatePDF(rows, columns, filename)
    case "zip":
      // ZIP est async, mais on le gère via le store
      throw new Error("ZIP format must be generated async. Use generateZIP instead.")
    default:
      throw new Error(`Format non supporté: ${format}`)
  }
}

/**
 * Génère un export de manière synchrone ou asynchrone selon le format
 */
export async function generateExport(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string,
  format: ExportFormat,
  zipFormats?: ExportFormat[]
): Promise<ExportResult> {
  if (format === "zip") {
    return generateZIP(rows, columns, filename, zipFormats || ["xlsx", "csv", "json"])
  }
  return generateByFormat(rows, columns, filename, format)
}
