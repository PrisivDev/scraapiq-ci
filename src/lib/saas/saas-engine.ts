/**
 * Moteur SaaS Enterprise
 *
 * Gère :
 *  - Licences (génération, activation, validation)
 *  - Abonnements (création, upgrade, cancel)
 *  - Facturation (génération factures, paiement)
 *  - Quota (tracking, vérification, reset)
 *  - Plans (définitions starter/pro/enterprise/custom)
 *  - API Keys (génération, validation, révocation)
 */

import { db } from "@/lib/db"
import { createHash, randomBytes } from "crypto"

// ============================================================================
// DÉFINITION DES PLANS
// ============================================================================

export interface PlanDefinition {
  code: string
  name: string
  priceMonthlyXOF: number
  priceYearlyXOF: number
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  maxExports: number
  maxSources: number
  maxWorkspaces: number
  features: string[]
  popular?: boolean
}

export const PLANS: PlanDefinition[] = [
  {
    code: "starter",
    name: "Starter",
    priceMonthlyXOF: 25000,
    priceYearlyXOF: 270000,
    maxUsers: 3,
    maxCompanies: 5000,
    maxApiCalls: 25000,
    maxExports: 30,
    maxSources: 3,
    maxWorkspaces: 1,
    features: ["Recherche multicritère", "Scraping Google Maps", "Export Excel/CSV", "1 workspace", "Support email"],
  },
  {
    code: "pro",
    name: "Pro",
    priceMonthlyXOF: 85000,
    priceYearlyXOF: 918000,
    maxUsers: 20,
    maxCompanies: 50000,
    maxApiCalls: 100000,
    maxExports: 100,
    maxSources: 6,
    maxWorkspaces: 5,
    features: [
      "Tout Starter +",
      "Scraping multi-sources (FB, LinkedIn, Web)",
      "IA Cleaner (dédup + enrichissement)",
      "Cartographie OpenStreetMap",
      "API REST + Webhooks",
      "Notifications multi-canal",
      "Rapports automatiques",
      "5 workspaces",
      "Support prioritaire",
    ],
    popular: true,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    priceMonthlyXOF: 250000,
    priceYearlyXOF: 2700000,
    maxUsers: 100,
    maxCompanies: 500000,
    maxApiCalls: 1000000,
    maxExports: 1000,
    maxSources: 10,
    maxWorkspaces: 20,
    features: [
      "Tout Pro +",
      "Architecture distribuée (Redis/BullMQ)",
      "SSO/SAML",
      "Power BI Ready",
      "PWA offline",
      "Audit & conformité APIPD",
      "SLA 99.9%",
      "20 workspaces",
      "Support dédié 24/7",
    ],
  },
  {
    code: "custom",
    name: "Custom",
    priceMonthlyXOF: 0,
    priceYearlyXOF: 0,
    maxUsers: 999,
    maxCompanies: 999999,
    maxApiCalls: 9999999,
    maxExports: 9999,
    maxSources: 99,
    maxWorkspaces: 99,
    features: ["Personnalisable", "On-premise option", "Integration sur-mesure", "Contactez-nous"],
  },
]

export function getPlan(code: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.code === code)
}

// ============================================================================
// LICENCES
// ============================================================================

export interface LicenseInfo {
  id: string
  key: string
  plan: string
  planName: string
  status: string
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  maxExports: number
  maxSources: number
  maxWorkspaces: number
  features: string[]
  activatedAt: string | null
  expiresAt: string | null
  organizationId: string | null
}

/**
 * Génère une nouvelle licence (admin only)
 */
export async function generateLicense(planCode: string, expiresAt?: Date): Promise<LicenseInfo> {
  const plan = getPlan(planCode)
  if (!plan) throw new Error(`Plan "${planCode}" invalide`)

  const license = await db.license.create({
    data: {
      key: `SQCI-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`,
      plan: planCode,
      name: plan.name,
      maxUsers: plan.maxUsers,
      maxCompanies: plan.maxCompanies,
      maxApiCalls: plan.maxApiCalls,
      maxExports: plan.maxExports,
      maxSources: plan.maxSources,
      maxWorkspaces: plan.maxWorkspaces,
      features: JSON.stringify(plan.features),
      status: "inactive",
      expiresAt: expiresAt || null,
    },
  })

  return formatLicense(license)
}

/**
 * Active une licence pour une organisation
 */
export async function activateLicense(licenseKey: string, organizationId: string): Promise<{
  success: boolean
  license?: LicenseInfo
  subscription?: unknown
  error?: string
}> {
  const license = await db.license.findUnique({ where: { key: licenseKey } })
  if (!license) return { success: false, error: "Licence introuvable" }
  if (license.status === "active") return { success: false, error: "Licence déjà activée" }
  if (license.status === "expired") return { success: false, error: "Licence expirée" }
  if (license.expiresAt && license.expiresAt < new Date()) {
    await db.license.update({ where: { id: license.id }, data: { status: "expired" } })
    return { success: false, error: "Licence expirée" }
  }

  // Active la licence
  const updated = await db.license.update({
    where: { id: license.id },
    data: {
      status: "active",
      activatedAt: new Date(),
      organizationId,
    },
  })

  // Crée ou met à jour l'abonnement
  const plan = getPlan(license.plan)
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const subscription = await db.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      licenseId: license.id,
      plan: license.plan,
      status: "active",
      billingCycle: "monthly",
      amountXOF: plan?.priceMonthlyXOF || 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      licenseId: license.id,
      plan: license.plan,
      status: "active",
      amountXOF: plan?.priceMonthlyXOF || 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  })

  // Met à jour le plan de l'organisation
  await db.organization.update({
    where: { id: organizationId },
    data: { plan: license.plan },
  })

  return { success: true, license: formatLicense(updated), subscription }
}

/**
 * Récupère la licence active d'une organisation
 */
export async function getOrganizationLicense(organizationId: string): Promise<LicenseInfo | null> {
  const license = await db.license.findFirst({
    where: { organizationId, status: "active" },
    orderBy: { activatedAt: "desc" },
  })
  if (!license) return null
  return formatLicense(license)
}

/**
 * Valide une clé de licence sans l'activer
 */
export async function validateLicenseKey(licenseKey: string): Promise<{
  valid: boolean
  license?: LicenseInfo
  error?: string
}> {
  const license = await db.license.findUnique({ where: { key: licenseKey } })
  if (!license) return { valid: false, error: "Clé introuvable" }
  if (license.status === "active") return { valid: false, error: "Licence déjà activée" }
  if (license.status === "expired" || (license.expiresAt && license.expiresAt < new Date())) {
    return { valid: false, error: "Licence expirée" }
  }
  return { valid: true, license: formatLicense(license) }
}

/**
 * Liste toutes les licences (admin)
 */
export async function listLicenses(): Promise<LicenseInfo[]> {
  const licenses = await db.license.findMany({ orderBy: { createdAt: "desc" } })
  return licenses.map(formatLicense)
}

function formatLicense(l: Record<string, unknown>): LicenseInfo {
  return {
    id: l.id as string,
    key: l.key as string,
    plan: l.plan as string,
    planName: l.name as string,
    status: l.status as string,
    maxUsers: l.maxUsers as number,
    maxCompanies: l.maxCompanies as number,
    maxApiCalls: l.maxApiCalls as number,
    maxExports: l.maxExports as number,
    maxSources: l.maxSources as number,
    maxWorkspaces: l.maxWorkspaces as number,
    features: JSON.parse((l.features as string) || "[]"),
    activatedAt: (l.activatedAt as string) || null,
    expiresAt: (l.expiresAt as string) || null,
    organizationId: (l.organizationId as string) || null,
  }
}

// ============================================================================
// QUOTA
// ============================================================================

export interface QuotaStatus {
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  maxExports: number
  maxSources: number
  maxWorkspaces: number
  current: {
    users: number
    companies: number
    apiCalls: number
    exports: number
    scrapeJobs: number
  }
  usage: {
    users: number
    companies: number
    apiCalls: number
    exports: number
  }
  exceeded: string[]
}

/**
 * Récupère le quota d'une organisation
 */
export async function getQuota(organizationId: string): Promise<QuotaStatus | null> {
  const license = await getOrganizationLicense(organizationId)
  if (!license) {
    // Fallback: plan starter par défaut
    const plan = getPlan("starter")!
    return buildQuota(organizationId, {
      maxUsers: plan.maxUsers,
      maxCompanies: plan.maxCompanies,
      maxApiCalls: plan.maxApiCalls,
      maxExports: plan.maxExports,
      maxSources: plan.maxSources,
      maxWorkspaces: plan.maxWorkspaces,
    })
  }

  return buildQuota(organizationId, {
    maxUsers: license.maxUsers,
    maxCompanies: license.maxCompanies,
    maxApiCalls: license.maxApiCalls,
    maxExports: license.maxExports,
    maxSources: license.maxSources,
    maxWorkspaces: license.maxWorkspaces,
  })
}

async function buildQuota(orgId: string, max: {
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  maxExports: number
  maxSources: number
  maxWorkspaces: number
}): Promise<QuotaStatus> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Récupère l'usage du mois courant
  let quotaUsage = await db.quotaUsage.findUnique({
    where: { organizationId_periodYear_periodMonth: { organizationId: orgId, periodYear: year, periodMonth: month } },
  })

  if (!quotaUsage) {
    quotaUsage = await db.quotaUsage.create({
      data: { organizationId: orgId, periodYear: year, periodMonth: month },
    })
  }

  // Compte les ressources actuelles
  const userCount = await db.member.count({ where: { organizationId: orgId, status: "active" } })
  // Multi-tenant: count only companies owned by this org (organizationId matches).
  // Companies with organizationId = null are global/shared and excluded from
  // per-org quota counts (they belong to the platform, not the tenant).
  const companyCount = await db.company.count({ where: { organizationId: orgId } })
  const workspaceCount = await db.workspace.count({ where: { organizationId: orgId } })

  const current = {
    users: userCount,
    companies: companyCount,
    apiCalls: quotaUsage.apiCalls,
    exports: quotaUsage.exportsCount,
    scrapeJobs: quotaUsage.scrapeJobs,
  }

  const usage = {
    users: max.maxUsers > 0 ? Math.round((userCount / max.maxUsers) * 100) : 0,
    companies: max.maxCompanies > 0 ? Math.round((companyCount / max.maxCompanies) * 100) : 0,
    apiCalls: max.maxApiCalls > 0 ? Math.round((quotaUsage.apiCalls / max.maxApiCalls) * 100) : 0,
    exports: max.maxExports > 0 ? Math.round((quotaUsage.exportsCount / max.maxExports) * 100) : 0,
  }

  const exceeded: string[] = []
  if (userCount >= max.maxUsers) exceeded.push("users")
  if (companyCount >= max.maxCompanies) exceeded.push("companies")
  if (quotaUsage.apiCalls >= max.maxApiCalls) exceeded.push("apiCalls")
  if (quotaUsage.exportsCount >= max.maxExports) exceeded.push("exports")
  if (workspaceCount >= max.maxWorkspaces) exceeded.push("workspaces")

  return { ...max, current, usage, exceeded }
}

/**
 * Incrémente l'usage du quota
 */
export async function incrementQuota(organizationId: string, field: "apiCalls" | "exportsCount" | "scrapeJobs", amount = 1): Promise<void> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  await db.quotaUsage.upsert({
    where: { organizationId_periodYear_periodMonth: { organizationId, periodYear: year, periodMonth: month } },
    create: { organizationId, periodYear: year, periodMonth: month, [field]: amount },
    update: { [field]: { increment: amount }, updatedAt: new Date() },
  })
}

/**
 * Vérifie si une action est autorisée selon le quota
 */
export async function checkQuota(organizationId: string, field: "users" | "companies" | "apiCalls" | "exports" | "workspaces"): Promise<{ allowed: boolean; reason?: string }> {
  const quota = await getQuota(organizationId)
  if (!quota) return { allowed: true }

  if (field === "users" && quota.current.users >= quota.maxUsers) {
    return { allowed: false, reason: `Quota utilisateurs atteint (${quota.current.users}/${quota.maxUsers})` }
  }
  if (field === "companies" && quota.current.companies >= quota.maxCompanies) {
    return { allowed: false, reason: `Quota entreprises atteint (${quota.current.companies}/${quota.maxCompanies})` }
  }
  if (field === "apiCalls" && quota.current.apiCalls >= quota.maxApiCalls) {
    return { allowed: false, reason: `Quota API atteint (${quota.current.apiCalls}/${quota.maxApiCalls})` }
  }
  if (field === "exports" && quota.current.exports >= quota.maxExports) {
    return { allowed: false, reason: `Quota exports atteint (${quota.current.exports}/${quota.maxExports})` }
  }
  return { allowed: true }
}

// ============================================================================
// API KEYS
// ============================================================================

export interface ApiKeyInfo {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  fullKey?: string // seulement à la création
}

/**
 * Génère une nouvelle clé API
 */
export async function createApiKey(userId: string, name: string, scopes: string[] = [], expiresAt?: Date): Promise<ApiKeyInfo> {
  const rawKey = `sk_live_${randomBytes(24).toString("hex")}`
  const keyHash = createHash("sha256").update(rawKey).digest("hex")
  const keyPrefix = rawKey.slice(0, 12)

  const apiKey = await db.apiKey.create({
    data: {
      userId,
      name,
      keyHash,
      keyPrefix,
      scopes: JSON.stringify(scopes),
      expiresAt: expiresAt || null,
    },
  })

  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: JSON.parse(apiKey.scopes || "[]"),
    lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
    expiresAt: apiKey.expiresAt?.toISOString() || null,
    revokedAt: apiKey.revokedAt?.toISOString() || null,
    createdAt: apiKey.createdAt.toISOString(),
    fullKey: rawKey,
  }
}

/**
 * Liste les clés API d'un utilisateur
 */
export async function listApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  const keys = await db.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: JSON.parse(k.scopes || "[]"),
    lastUsedAt: k.lastUsedAt?.toISOString() || null,
    expiresAt: k.expiresAt?.toISOString() || null,
    revokedAt: k.revokedAt?.toISOString() || null,
    createdAt: k.createdAt.toISOString(),
  }))
}

/**
 * Révoque une clé API
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const key = await db.apiKey.findFirst({ where: { id: keyId, userId } })
  if (!key) return false
  await db.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } })
  return true
}

/**
 * Valide une clé API (lookup par hash)
 */
export async function validateApiKey(rawKey: string): Promise<{ valid: boolean; userId?: string; keyId?: string }> {
  const keyHash = createHash("sha256").update(rawKey).digest("hex")
  const apiKey = await db.apiKey.findUnique({ where: { keyHash } })
  if (!apiKey) return { valid: false }
  if (apiKey.revokedAt) return { valid: false }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return { valid: false }

  // Update last used
  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })

  return { valid: true, userId: apiKey.userId, keyId: apiKey.id }
}

// ============================================================================
// FACTURATION
// ============================================================================

export interface InvoiceInfo {
  id: string
  number: string
  organizationId: string
  amountXOF: number
  taxXOF: number
  totalXOF: number
  status: string
  dueDate: string
  paidAt: string | null
  items: Array<{ description: string; amount: number }>
  createdAt: string
}

/**
 * Génère une facture pour un abonnement
 */
export async function generateInvoice(organizationId: string, subscriptionId: string, amountXOF: number, description: string): Promise<InvoiceInfo> {
  const taxRate = 0.18 // TVA 18% Côte d'Ivoire
  const taxXOF = Math.round(amountXOF * taxRate)
  const totalXOF = amountXOF + taxXOF

  const year = new Date().getFullYear()
  const count = await db.invoice.count()
  const number = `INV-${year}-${String(count + 1).padStart(4, "0")}`

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30) // 30 jours pour payer

  const invoice = await db.invoice.create({
    data: {
      organizationId,
      subscriptionId,
      number,
      amountXOF,
      taxXOF,
      totalXOF,
      status: "pending",
      dueDate,
      items: JSON.stringify([{ description, amount: amountXOF }]),
    },
  })

  return formatInvoice(invoice)
}

/**
 * Liste les factures d'une organisation
 */
export async function listInvoices(organizationId: string): Promise<InvoiceInfo[]> {
  const invoices = await db.invoice.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  })
  return invoices.map(formatInvoice)
}

/**
 * Marque une facture comme payée
 */
export async function payInvoice(invoiceId: string, paymentMethod: string): Promise<InvoiceInfo | null> {
  const invoice = await db.invoice.update({
    where: { id: invoiceId },
    data: { status: "paid", paidAt: new Date() },
  })
  return formatInvoice(invoice)
}

function formatInvoice(i: Record<string, unknown>): InvoiceInfo {
  return {
    id: i.id as string,
    number: i.number as string,
    organizationId: i.organizationId as string,
    amountXOF: i.amountXOF as number,
    taxXOF: i.taxXOF as number,
    totalXOF: i.totalXOF as number,
    status: i.status as string,
    dueDate: (i.dueDate as string),
    paidAt: (i.paidAt as string) || null,
    items: JSON.parse((i.items as string) || "[]"),
    createdAt: (i.createdAt as string),
  }
}

// ============================================================================
// STATISTIQUES SAAS
// ============================================================================

export async function getSaaSStats() {
  const [totalOrgs, totalLicenses, activeLicenses, totalSubscriptions, activeSubs, totalInvoices, paidInvoices, totalApiKeys, activeApiKeys] = await Promise.all([
    db.organization.count(),
    db.license.count(),
    db.license.count({ where: { status: "active" } }),
    db.subscription.count(),
    db.subscription.count({ where: { status: "active" } }),
    db.invoice.count(),
    db.invoice.count({ where: { status: "paid" } }),
    db.apiKey.count(),
    db.apiKey.count({ where: { revokedAt: null } }),
  ])

  const totalRevenue = await db.invoice.aggregate({
    where: { status: "paid" },
    _sum: { totalXOF: true },
  })

  return {
    totalOrgs,
    totalLicenses,
    activeLicenses,
    totalSubscriptions,
    activeSubs,
    totalInvoices,
    paidInvoices,
    totalApiKeys,
    activeApiKeys,
    totalRevenueXOF: totalRevenue._sum.totalXOF || 0,
  }
}
