import { db } from "@/lib/db"
async function main() {
  const deleted = await db.scrapeJobRecord.deleteMany({})
  console.log(`Supprimé ${deleted.count} jobs de test`)
  await db.$disconnect()
}
main().catch(console.error)
