import { db } from "@/lib/db"
async function main() {
  const u = await db.user.findUnique({ where: { email: "testadmin@test.ci" }, select: { id: true } })
  if (u) {
    await db.auditLog.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.member.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.session.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.jwtBlacklist.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.apiKey.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.user.delete({ where: { id: u.id } }).catch((e) => console.log("user delete err:", e.message))
    console.log("Deleted testadmin@test.ci")
  }
  // Supprime org Test Org
  const o = await db.organization.findFirst({ where: { name: { contains: "Test Org" } }, select: { id: true, name: true } })
  if (o) {
    await db.member.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await db.workspace.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await db.organization.delete({ where: { id: o.id } }).catch(() => {})
    console.log("Deleted org:", o.name)
  }
  const users = await db.user.count()
  const orgs = await db.organization.count()
  console.log(`Final: ${users} user(s), ${orgs} org(s)`)
  await db.$disconnect()
}
main().catch(console.error)
