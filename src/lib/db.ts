import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

// createRequire lets us imperatively require() in an ESM context (so we can
// bust the @prisma/client cache at runtime when the schema changes) without
// tripping the @typescript-eslint/no-require-imports rule.
const require_ = createRequire(import.meta.url)

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

/**
 * Bust Turbopack's module cache for @prisma/client + .prisma/client so the
 * latest generated client (with the new schema fields) is loaded after
 * `bun run db:push` regenerates it. Without this, Turbopack keeps the OLD
 * PrismaClient class in memory and reports new fields as "Unknown argument"
 * at runtime — even though the file on disk has been regenerated.
 *
 * We compare the schema mtime against the cached hash; if they differ, we
 * purge every @prisma/client / .prisma/client entry from require.cache and
 * force a fresh `require()` on the next access.
 */
function bustPrismaCacheIfStale(): void {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaSchemaHash === schemaHash
  ) {
    return // same schema — nothing to do
  }
  // Schema changed: purge all @prisma/client + .prisma/client entries from cache.
  for (const key of Object.keys(require_.cache)) {
    if (
      key.includes("/node_modules/@prisma/client/") ||
      key.includes("/node_modules/.prisma/client/")
    ) {
      delete require_.cache[key]
    }
  }
}

bustPrismaCacheIfStale()

function createPrismaClient() {
  // Re-import after cache bust (if it happened) so we get the freshest class.
  const mod = require_("@prisma/client") as {
    PrismaClient: typeof PrismaClient
  }
  return new mod.PrismaClient({
    log: ["warn", "error"],
  })
}

let db: PrismaClient

if (process.env.NODE_ENV === "production") {
  db = globalForPrisma.prisma ?? createPrismaClient()
  if (!globalForPrisma.prisma) globalForPrisma.prisma = db
} else {
  // Dev: invalidate the cached client if the schema has changed since it was created.
  // Touch the schema file (or run db:push) to force a fresh client on the next HMR reload.
  if (globalForPrisma.prisma && globalForPrisma.prismaSchemaHash === schemaHash) {
    db = globalForPrisma.prisma
  } else {
    if (globalForPrisma.prisma) {
      globalForPrisma.prisma.$disconnect().catch(() => {})
    }
    db = createPrismaClient()
    globalForPrisma.prisma = db
    globalForPrisma.prismaSchemaHash = schemaHash
  }
}

export { db }
