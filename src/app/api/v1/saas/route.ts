/**
 * API SaaS — Licences, Quota, API Keys, Facturation
 *
 * GET  /api/v1/saas              — vue d'ensemble (stats + plans)
 * GET  /api/v1/saas/license      — liste licences
 * POST /api/v1/saas/license      — génère licence (admin)
 * POST /api/v1/saas/license/activate — active licence
 * GET  /api/v1/saas/quota        — quota organisation
 * GET  /api/v1/saas/api-keys     — liste clés API
 * POST /api/v1/saas/api-keys     — crée clé API
 * DELETE /api/v1/saas/api-keys   — révoque clé
 * GET  /api/v1/saas/billing      — factures
 * POST /api/v1/saas/billing      — génère facture
 */
import { NextRequest } from "next/server"
import {
  PLANS, generateLicense, activateLicense, listLicenses, validateLicenseKey,
  getQuota, createApiKey, listApiKeys, revokeApiKey,
  generateInvoice, listInvoices, payInvoice, getSaaSStats,
} from "@/lib/saas/saas-engine"
import { getAuthUser } from "@/lib/auth/context"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { user, error, status } = await getAuthUser()
  if (!user) return errorResponse(error || "Unauthorized", status)

  const { searchParams } = new URL(req.url)
  const view = searchParams.get("view")

  // Vue spécifique : licence
  if (view === "license") {
    const licenses = await listLicenses()
    return jsonResponse({ licenses, total: licenses.length })
  }

  // Vue spécifique : quota
  if (view === "quota") {
    // Récupère l'org de l'utilisateur
    const member = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
    })
    if (!member) return errorResponse("Aucune organisation", 404)
    const quota = await getQuota(member.organizationId)
    return jsonResponse({ quota })
  }

  // Vue spécifique : api-keys
  if (view === "api-keys") {
    const keys = await listApiKeys(user.id)
    return jsonResponse({ keys, total: keys.length })
  }

  // Vue spécifique : billing
  if (view === "billing") {
    const member = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
    })
    if (!member) return errorResponse("Aucune organisation", 404)
    const invoices = await listInvoices(member.organizationId)
    return jsonResponse({ invoices, total: invoices.length })
  }

  // Vue d'ensemble
  const [stats, licenses] = await Promise.all([
    getSaaSStats(),
    listLicenses(),
  ])

  return jsonResponse({
    stats,
    plans: PLANS,
    licenses: licenses.slice(0, 10),
  })
}

export async function POST(req: NextRequest) {
  const { user, error, status } = await getAuthUser()
  if (!user) return errorResponse(error || "Unauthorized", status)

  const body = await req.json()
  const { action } = body

  // Générer une licence
  if (action === "generate_license") {
    const { plan, expiresAt } = body
    if (!plan) return errorResponse("Plan requis", 400)
    const license = await generateLicense(plan, expiresAt ? new Date(expiresAt) : undefined)
    return jsonResponse({ success: true, license }, { status: 201 })
  }

  // Activer une licence
  if (action === "activate_license") {
    const { licenseKey, organizationId } = body
    if (!licenseKey || !organizationId) return errorResponse("licenseKey et organizationId requis", 400)
    const result = await activateLicense(licenseKey, organizationId)
    if (!result.success) return errorResponse(result.error || "Activation échouée", 400)
    return jsonResponse({ success: true, license: result.license })
  }

  // Valider une clé de licence
  if (action === "validate_license") {
    const { licenseKey } = body
    if (!licenseKey) return errorResponse("licenseKey requis", 400)
    const result = await validateLicenseKey(licenseKey)
    return jsonResponse(result)
  }

  // Créer une clé API
  if (action === "create_api_key") {
    const { name, scopes, expiresAt } = body
    if (!name) return errorResponse("name requis", 400)
    const key = await createApiKey(user.id, name, scopes || [], expiresAt ? new Date(expiresAt) : undefined)
    return jsonResponse({ success: true, key }, { status: 201 })
  }

  // Révoquer une clé API
  if (action === "revoke_api_key") {
    const { keyId } = body
    if (!keyId) return errorResponse("keyId requis", 400)
    const revoked = await revokeApiKey(user.id, keyId)
    if (!revoked) return errorResponse("Clé introuvable", 404)
    return jsonResponse({ success: true })
  }

  // Générer une facture
  if (action === "generate_invoice") {
    const { organizationId, subscriptionId, amount, description } = body
    if (!organizationId || !amount) return errorResponse("organizationId et amount requis", 400)
    const invoice = await generateInvoice(organizationId, subscriptionId, amount, description || "Abonnement ScrapIQ CI")
    return jsonResponse({ success: true, invoice }, { status: 201 })
  }

  // Payer une facture
  if (action === "pay_invoice") {
    const { invoiceId, paymentMethod } = body
    if (!invoiceId) return errorResponse("invoiceId requis", 400)
    const invoice = await payInvoice(invoiceId, paymentMethod || "orange_money")
    return jsonResponse({ success: true, invoice })
  }

  return errorResponse("Action invalide", 400)
}

export async function DELETE(req: NextRequest) {
  const { user, error, status } = await getAuthUser()
  if (!user) return errorResponse(error || "Unauthorized", status)

  const { searchParams } = new URL(req.url)
  const keyId = searchParams.get("keyId")

  if (keyId) {
    const revoked = await revokeApiKey(user.id, keyId)
    if (!revoked) return errorResponse("Clé introuvable", 404)
    return jsonResponse({ success: true, message: "Clé API révoquée" })
  }

  return errorResponse("keyId requis", 400)
}
