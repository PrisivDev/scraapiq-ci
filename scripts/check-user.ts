import { db } from "@/lib/db"
async function main() {
  const u = await db.user.findFirst({ where: { email: "admin@scraapiq.ci" }, select: { id: true, email: true, role: true } })
  console.log("User in DB:", JSON.stringify(u, null, 2))
  const m = await db.member.findFirst({ where: { userId: u?.id }, select: { id: true, role: true, userId: true, organizationId: true } })
  console.log("Member in DB:", JSON.stringify(m, null, 2))
  await db.$disconnect()
}
main().catch(console.error)
