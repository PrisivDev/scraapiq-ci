/**
 * truncate-db.ts — Production cleanup script.
 *
 * Deletes ALL rows from ALL Prisma models so the SQLite DB is empty.
 * Children are deleted first to respect foreign-key constraints
 * (PRAGMA foreign_keys is also turned OFF for the duration to be safe).
 *
 * Usage:  cd /home/z/my-project && bun run scripts/truncate-db.ts
 *
 * After running, verify with: bun run scripts/db-check.ts
 */
import { db } from "@/lib/db"

// All Prisma models declared in prisma/schema.prisma.
// Listed children-first to respect FK relationships, even though we also
// toggle PRAGMA foreign_keys = OFF for safety.
const MODELS = [
  // Children first (FK references)
  "webhookDelivery",
  "reportExecution",
  "notification",
  "alertRule",
  "scheduledReport",
  "webhook",
  "restApiLog",
  "company",
  "quotaUsage",
  "invoice",
  "subscription",
  "license",
  "apiKey",
  "jwtBlacklist",
  "refreshToken",
  "session",
  "account",
  "auditLog",
  "member",
  "workspace",
  "organization",
  // User last (org owner + everything else references it)
  "user",
] as const

async function main() {
  console.log("=== TRUNCATING ALL TABLES (production cleanup) ===\n")

  // Snapshot before
  const before: Record<string, number> = {}
  for (const m of MODELS) {
    try {
      // @ts-expect-error dynamic model access
      before[m] = await db[m].count()
    } catch {
      before[m] = -1
    }
  }

  // Disable FK checks for the duration of the truncate
  await db.$executeRawUnsafe("PRAGMA foreign_keys = OFF;")
  try {
    let totalDeleted = 0
    for (const m of MODELS) {
      try {
        // @ts-expect-error dynamic model access
        const r = await db[m].deleteMany({})
        const deleted = r.count || 0
        totalDeleted += deleted
        if (deleted > 0) {
          console.log(`  ✓ ${m}: ${deleted} row(s) deleted`)
        }
      } catch (err) {
        console.log(`  ✗ ${m}: error — ${(err as Error).message}`)
      }
    }
    await db.$executeRawUnsafe("PRAGMA foreign_keys = ON;")
    console.log(`\nTotal rows deleted: ${totalDeleted}`)
  } catch (err) {
    // Re-enable FK even on error
    try {
      await db.$executeRawUnsafe("PRAGMA foreign_keys = ON;")
    } catch {}
    throw err
  }

  // Snapshot after
  console.log("\n=== POST-TRUNCATE COUNTS ===")
  let remaining = 0
  for (const m of MODELS) {
    try {
      // @ts-expect-error dynamic model access
      const c = await db[m].count()
      if (c > 0) {
        console.log(`  ⚠ ${m}: ${c} row(s) still present`)
        remaining += c
      }
    } catch {}
  }
  if (remaining === 0) {
    console.log("  All tables are empty. ✓")
  } else {
    console.log(`  Total remaining rows: ${remaining}`)
  }

  // Print before/after summary table
  console.log("\n=== BEFORE / AFTER SUMMARY ===")
  console.log("Model                | Before | After")
  console.log("---------------------|--------|------")
  for (const m of MODELS) {
    const b = before[m] ?? -1
    // @ts-expect-error dynamic model access
    const a = await db[m].count().catch(() => -1)
    console.log(`${m.padEnd(20)} | ${String(b).padStart(6)} | ${String(a).padStart(5)}`)
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
