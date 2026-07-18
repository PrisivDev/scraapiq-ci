/**
 * seed-prod.ts — Production bootstrap script.
 *
 * Seeds the MINIMUM legitimate production data:
 *   1. One OWNER user         (email from ADMIN_EMAIL,        password from ADMIN_PASSWORD)
 *   2. One Organization       (owned by that user, Starter plan)
 *   3. One Workspace          (default workspace inside the org)
 *   4. One Member             (links OWNER ↔ Organization, role OWNER)
 *   5. One License            (Starter plan, active, attached to the org)
 *   6. One QuotaUsage         (current month counters at 0)
 *
 * DOES NOT seed any companies, jobs, sources, alerts, or reports — those must
 * come from real scraping / configuration. Pair with
 * `src/lib/notifications/seed.ts` (auto-runs on first /api/v1/alerts GET) if
 * you also want the default alert rules + scheduled reports.
 *
 * USAGE
 *   # 1. Make sure your .env contains ADMIN_EMAIL and ADMIN_PASSWORD
 *   #    (ADMIN_PASSWORD must satisfy the password-strength policy:
 *   #     ≥8 chars + 1 upper + 1 lower + 1 digit + 1 special)
 *   # 2. Run:
 *   bun run scripts/seed-prod.ts
 *
 *   # 3. (Optional) Override the org name and/or owner display name:
 *   ADMIN_ORG_NAME="My Company" ADMIN_NAME="Adama Koné" \
 *     bun run scripts/seed-prod.ts
 *
 * IDEMPOTENT
 *   Re-running will detect the existing user (by email) and abort with a clear
 *   message — no duplicate rows created. To force a re-seed, first run
 *   `bun run scripts/truncate-db.ts`.
 */
import { db } from "@/lib/db"
import { hashPassword, isPasswordStrong } from "@/lib/auth/password"

async function main() {
  console.log("=== seed-prod.ts — production bootstrap ===\n")

  // ---------------------------------------------------------------------------
  // 0. Read config from env (with safe fallbacks)
  // ---------------------------------------------------------------------------
  const email = (process.env.ADMIN_EMAIL || "admin@scraapiq.ci").toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ""
  const name = process.env.ADMIN_NAME || "Administrateur"
  const orgName = process.env.ADMIN_ORG_NAME || "ScrapIQ CI — Organisation"

  if (!password) {
    console.error(
      "✗ ADMIN_PASSWORD is not set.\n" +
        "  Set it in your .env file before running this script.\n" +
        "  It must be ≥8 chars with 1 upper + 1 lower + 1 digit + 1 special."
    )
    process.exit(1)
  }

  const strength = isPasswordStrong(password)
  if (!strength.ok) {
    console.error("✗ ADMIN_PASSWORD is too weak. Required checks:")
    console.error("    length≥8:", strength.checks.length)
    console.error("    upper:   ", strength.checks.upper)
    console.error("    lower:   ", strength.checks.lower)
    console.error("    digit:   ", strength.checks.digit)
    console.error("    special: ", strength.checks.special)
    process.exit(1)
  }

  console.log(`  Email    : ${email}`)
  console.log(`  Name     : ${name}`)
  console.log(`  Org      : ${orgName}`)
  console.log(`  Plan     : starter`)
  console.log()

  // ---------------------------------------------------------------------------
  // 1. Idempotency check
  // ---------------------------------------------------------------------------
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.error(
      `✗ A user with email "${email}" already exists (id=${existing.id}).\n` +
        `  To force a re-seed, first run: bun run scripts/truncate-db.ts`
    )
    process.exit(1)
  }

  // ---------------------------------------------------------------------------
  // 2. Hash password
  // ---------------------------------------------------------------------------
  console.log("  • Hashing password (bcrypt, 12 rounds)…")
  const passwordHash = await hashPassword(password)

  // ---------------------------------------------------------------------------
  // 3. Create User + Organization + Workspace + Member (atomic transaction)
  // ---------------------------------------------------------------------------
  console.log("  • Creating user + org + workspace + member…")
  const slugBase = orgName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        emailVerified: new Date(),
        status: "active",
      },
    })

    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        ownerId: user.id,
        plan: "starter",
      },
    })

    const workspace = await tx.workspace.create({
      data: {
        name: "Workspace principal",
        slug: "main",
        organizationId: org.id,
      },
    })

    const member = await tx.member.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        workspaceId: workspace.id,
        role: "OWNER",
        status: "active",
        acceptedAt: new Date(),
      },
    })

    return { user, org, workspace, member }
  })

  console.log(`    ✓ user.id        = ${result.user.id}`)
  console.log(`    ✓ org.id         = ${result.org.id}`)
  console.log(`    ✓ workspace.id   = ${result.workspace.id}`)
  console.log(`    ✓ member.id      = ${result.member.id}`)

  // ---------------------------------------------------------------------------
  // 4. Create License (Starter plan, active, attached to org)
  // ---------------------------------------------------------------------------
  console.log("  • Creating License (Starter plan, active)…")
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 1-year license

  const license = await db.license.create({
    data: {
      plan: "starter",
      name: "Starter",
      maxUsers: 5,
      maxCompanies: 10000,
      maxApiCalls: 100000,
      maxExports: 100,
      maxSources: 3,
      maxWorkspaces: 1,
      features: JSON.stringify([
        "google-maps",
        "facebook",
        "website",
        "ai-cleaner",
        "api-keys",
      ]),
      status: "active",
      activatedAt: now,
      expiresAt,
      organizationId: result.org.id,
    },
  })
  console.log(`    ✓ license.id     = ${license.id} (expires ${expiresAt.toISOString().slice(0, 10)})`)

  // ---------------------------------------------------------------------------
  // 5. Create QuotaUsage (current month, all counters at 0)
  // ---------------------------------------------------------------------------
  console.log("  • Creating QuotaUsage (current month, zeros)…")
  const periodYear = now.getFullYear()
  const periodMonth = now.getMonth() + 1 // JS months are 0-indexed

  const quota = await db.quotaUsage.create({
    data: {
      organizationId: result.org.id,
      periodYear,
      periodMonth,
      apiCalls: 0,
      companiesStored: 0,
      exportsCount: 0,
      scrapeJobs: 0,
      usersCount: 1,
    },
  })
  console.log(`    ✓ quotaUsage.id = ${quota.id} (${periodYear}-${String(periodMonth).padStart(2, "0")})`)

  // ---------------------------------------------------------------------------
  // 6. Summary
  // ---------------------------------------------------------------------------
  console.log("\n=== SEEDED SUCCESSFULLY ===")
  console.log("  • 1 User        (OWNER)")
  console.log("  • 1 Organization")
  console.log("  • 1 Workspace")
  console.log("  • 1 Member      (OWNER role, active)")
  console.log("  • 1 License     (Starter, active, 1 year)")
  console.log("  • 1 QuotaUsage  (current month, zeros)")
  console.log()
  console.log("Next steps:")
  console.log(`  1. Login at /auth/login with ${email}`)
  console.log("  2. The default alert rules + scheduled reports will auto-seed")
  console.log("     on the first GET /api/v1/alerts (legitimate config, not mock).")
  console.log("  3. Run real scraping jobs to populate the Company table.")

  await db.$disconnect()
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
