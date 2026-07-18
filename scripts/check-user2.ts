import { db } from "@/lib/db"
async function main() {
  const u = await db.user.findFirst({ select: { id: true, email: true, name: true } })
  console.log("User:", JSON.stringify(u, null, 2))
  const o = await db.organization.findFirst({ select: { id: true, name: true, slug: true, plan: true, ownerId: true } })
  console.log("Org:", JSON.stringify(o, null, 2))
  await db.$disconnect()
}
main().catch(console.error)
