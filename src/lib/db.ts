import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaHash: string | undefined
}

// A simple hash of the schema file mtime — when the schema changes (db:push),
// we invalidate the cached Prisma client so the new models are picked up
// without requiring a full dev server restart.
let schemaHash = "unknown"
try {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")
  if (fs.existsSync(schemaPath)) {
    schemaHash = String(fs.statSync(schemaPath).mtimeMs)
  }
} catch {
  // ignore — fall back to "unknown"
}

function createPrismaClient() {
  return new PrismaClient({
    log: ["warn", "error"],
  })
}

let db: PrismaClient

if (process.env.NODE_ENV === "production") {
  db = globalForPrisma.prisma ?? createPrismaClient()
  if (!globalForPrisma.prisma) globalForPrisma.prisma = db
} else {
  // Dev: invalidate the cached client if the schema has changed since it was created
  if (globalForPrisma.prisma && globalForPrisma.prismaSchemaHash === schemaHash) {
    db = globalForPrisma.prisma
  } else {
    // Safely disconnect the previous client before replacing
    if (globalForPrisma.prisma) {
      globalForPrisma.prisma.$disconnect().catch(() => {})
    }
    db = createPrismaClient()
    globalForPrisma.prisma = db
    globalForPrisma.prismaSchemaHash = schemaHash
  }
}

export { db }