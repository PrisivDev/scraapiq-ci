import { db } from "@/lib/db"
async function main() {
  const users = await db.user.findMany({ select: { email: true, name: true } })
  console.log("Users:", JSON.stringify(users, null, 2))
  const orgs = await db.organization.findMany({ select: { name: true, slug: true } })
  console.log("Orgs:", JSON.stringify(orgs, null, 2))
  await db.$disconnect()
}
main().catch(console.error)
