import { db } from "@/lib/db"
async function main() {
  const orgs = await db.organization.findMany({ select: { id: true, name: true, slug: true, plan: true, ownerId: true, createdAt: true } })
  console.log("Organizations en DB:")
  for (const o of orgs) console.log(`  - ${o.name} (${o.slug}, plan=${o.plan}, owner=${o.ownerId})`)
  console.log(`Total: ${orgs.length}`)
  await db.$disconnect()
}
main().catch(console.error)
