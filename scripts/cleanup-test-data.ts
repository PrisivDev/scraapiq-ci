import { db } from "@/lib/db"
async function main() {
  // Supprime les companies de test
  const deleted = await db.company.deleteMany({})
  console.log(`Companies supprimées: ${deleted.count}`)
  // Supprime les users de test (garde admin@prisiv.biz)
  const testUsers = await db.user.findMany({ where: { email: { contains: "test" } }, select: { id: true, email: true } })
  for (const u of testUsers) {
    const orgs = await db.organization.findMany({ where: { ownerId: u.id }, select: { id: true, name: true } })
    for (const o of orgs) {
      await db.member.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
      await db.workspace.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
      await db.organization.delete({ where: { id: o.id } }).catch(() => {})
    }
    await db.auditLog.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.member.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.session.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.jwtBlacklist.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await db.user.delete({ where: { id: u.id } }).catch(() => {})
    console.log(`Deleted user: ${u.email}`)
  }
  const users = await db.user.count()
  const orgs = await db.organization.count()
  const companies = await db.company.count()
  console.log(`\nFinal: ${users} user(s), ${orgs} org(s), ${companies} companie(s)`)
  await db.$disconnect()
}
main().catch(console.error)
