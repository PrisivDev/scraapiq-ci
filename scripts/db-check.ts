import { db } from "@/lib/db"
async function main() {
  const tables = ["User","Organization","Member","Company","Contact","Session","RefreshToken","AuditLog","License","Subscription","Invoice","QuotaUsage","ApiKey","RestApiLog","Notification","Alert","Webhook","ScrapeJob","ExportRecord"]
  console.log("=== Contenu actuel de la DB ===")
  for (const t of tables) {
    try {
      // @ts-expect-error dynamic model access
      const count = await db[t].count()
      if (count > 0) console.log(`  ${t}: ${count} lignes`)
    } catch {}
  }
  await db.$disconnect()
}
main().catch(console.error)
