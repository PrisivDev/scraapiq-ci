import { db } from "@/lib/db"
async function main() {
  // Supprime les users de test (garde admin@prisiv.biz)
  const testEmails = ["testadmin@test.ci", "testadmin2@test.ci", "deputy@test.ci"]
  for (const email of testEmails) {
    const u = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (u) {
      await db.member.deleteMany({ where: { userId: u.id } }).catch(() => {})
      await db.session.deleteMany({ where: { userId: u.id } }).catch(() => {})
      await db.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {})
      await db.user.delete({ where: { id: u.id } }).catch(() => {})
      console.log(`Deleted: ${email}`)
    }
  }
  // Supprime les orgs de test
  const testOrgs = await db.organization.findMany({ where: { name: { contains: "Test Org" } }, select: { id: true, name: true } })
  for (const o of testOrgs) {
    await db.member.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await db.workspace.deleteMany({ where: { organizationId: o.id } }).catch(() => {})
    await db.organization.delete({ where: { id: o.id } }).catch(() => {})
    console.log(`Deleted org: ${o.name}`)
  }
  // Compte final
  const users = await db.user.count()
  const orgs = await db.organization.count()
  console.log(`\nFinal: ${users} user(s), ${orgs} org(s)`)
  await db.$disconnect()
}
main().catch(console.error)
