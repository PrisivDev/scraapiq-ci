import { db } from "@/lib/db"
async function main() {
  const email = "testadmin2@test.ci"
  const u = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (!u) { console.log("not found"); await db.$disconnect(); return }
  // Delete org first
  const org = await db.organization.findFirst({ where: { ownerId: u.id }, select: { id: true, name: true } })
  if (org) {
    await db.member.deleteMany({ where: { organizationId: org.id } }).catch(() => {})
    await db.workspace.deleteMany({ where: { organizationId: org.id } }).catch(() => {})
    await db.organization.delete({ where: { id: org.id } }).catch(() => {})
    console.log("Deleted org:", org.name)
  }
  // Delete user deps
  await db.auditLog.deleteMany({ where: { userId: u.id } }).catch(() => {})
  await db.member.deleteMany({ where: { userId: u.id } }).catch(() => {})
  await db.session.deleteMany({ where: { userId: u.id } }).catch(() => {})
  await db.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {})
  await db.jwtBlacklist.deleteMany({ where: { userId: u.id } }).catch(() => {})
  await db.apiKey.deleteMany({ where: { userId: u.id } }).catch(() => {})
  await db.user.delete({ where: { id: u.id } })
  console.log("Deleted user:", email)
  const users = await db.user.count()
  const orgs = await db.organization.count()
  console.log(`Final: ${users} user(s), ${orgs} org(s)`)
  await db.$disconnect()
}
main().catch(console.error)
