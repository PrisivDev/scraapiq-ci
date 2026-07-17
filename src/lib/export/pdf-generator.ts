/**
 * Générateur PDF simple — sans dépendance externe
 * Construit un PDF valide manuellement (structure minimale)
 * Tableaux avec en-têtes + données, pagination
 */

import type { ExportColumn } from "./types"
import type { ExportRow } from "./generators"

export interface ExportResult {
  buffer: Buffer
  mimeType: string
  filename: string
}

export function generatePDF(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename: string
): ExportResult {
  const selected = columns.filter((c) => c.selected)
  const pageWidth = 842 // A4 landscape
  const pageHeight = 595
  const margin = 30
  const colWidth = (pageWidth - 2 * margin) / Math.max(selected.length, 1)
  const rowHeight = 16
  const headerHeight = 20
  const titleHeight = 50

  // Construit les objets PDF
  const objects: string[] = []
  let objectCount = 0

  function addObj(content: string): number {
    objectCount++
    objects.push(`${objectCount} 0 obj\n${content}\nendobj\n`)
    return objectCount
  }

  // Collecte toutes les pages (chaque page = un stream content)
  const pageContents: string[] = []
  let currentY = pageHeight - margin
  let pageContent = ""

  function startPage() {
    currentY = pageHeight - margin
    pageContent = ""
    // Titre
    pageContent += `BT\n/F1 14 Tf\n${margin} ${currentY} Td\n(ScrapIQ CI - Export Entreprises) Tj\nET\n`
    currentY -= 20
    pageContent += `BT\n/F2 9 Tf\n${margin} ${currentY} Td\n(${rows.length} entreprises - ${new Date().toLocaleDateString("fr-FR")}) Tj\nET\n`
    currentY -= 25

    // En-têtes de colonnes
    pageContent += `BT\n/F2 7 Tf\n`
    selected.forEach((col, i) => {
      const x = margin + i * colWidth
      pageContent += `${x} ${currentY} Td\n(${escapePdf(col.label)}) Tj\n`
      pageContent += `-${colWidth} 0 Td\n` // move back
    })
    pageContent += `ET\n`
    currentY -= headerHeight

    // Ligne de séparation
    pageContent += `${margin} ${currentY} m ${pageWidth - margin} ${currentY} l S\n`
    currentY -= 5
  }

  function endPage() {
    // Footer
    const footerY = margin - 10
    pageContent += `BT\n/F2 6 Tf\n${margin} ${footerY} Td\n(ScrapIQ CI) Tj\nET\n`
    pageContents.push(pageContent)
  }

  startPage()

  // Données
  for (const row of rows) {
    // Nouvelle page si nécessaire
    if (currentY < margin + rowHeight + 20) {
      endPage()
      startPage()
    }

    pageContent += `BT\n/F1 7 Tf\n`
    selected.forEach((col, i) => {
      const x = margin + i * colWidth
      let value = row[col.key]
      if (Array.isArray(value)) value = (value as string[]).join(", ")
      if (value === undefined || value === null) value = ""
      const text = String(value).slice(0, 30)
      pageContent += `${x} ${currentY} Td\n(${escapePdf(text)}) Tj\n`
      pageContent += `-${colWidth} 0 Td\n`
    })
    pageContent += `ET\n`
    currentY -= rowHeight
  }

  endPage()

  // Construit le PDF
  // Object 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`)

  // Object 2: Pages
  const pageRefs: number[] = []
  const contentRefs: number[] = []

  // Pré-alloue les numéros d'objets pour les pages et contents
  const pagesObjNum = 2
  const firstPageObjNum = 3
  const numPages = pageContents.length
  const firstContentObjNum = firstPageObjNum + numPages

  // Pages dictionary
  const kids = Array.from({ length: numPages }, (_, i) => `${firstPageObjNum + i} 0 R`).join(" ")
  addObj(`<< /Type /Pages /Kids [${kids}] /Count ${numPages} >>`)

  // Page objects
  for (let i = 0; i < numPages; i++) {
    addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${firstContentObjNum + numPages} 0 R /F2 ${firstContentObjNum + numPages + 1} 0 R >> >> /Contents ${firstContentObjNum + i} 0 R >>`)
  }

  // Content streams
  for (const content of pageContents) {
    const contentBytes = Buffer.from(content, "latin1")
    addObj(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`)
  }

  // Font objects (F1 = Helvetica, F2 = Helvetica-Bold)
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`)

  // Assemble le PDF
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "latin1"))
    pdf += objects[i]
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1")
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += `0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  const buffer = Buffer.from(pdf, "latin1")

  return {
    buffer,
    mimeType: "application/pdf",
    filename: `${filename}.pdf`,
  }
}

function escapePdf(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/[^\x20-\x7E]/g, "") // retire non-ASCII (PDF standard fonts)
}
