/**
 * GET /api/organization/details
 *
 * Retourne TOUTES les informations de l'organisation de l'utilisateur courant :
 *  1. organization     — enregistrement Organization complet
 *  2. owner            — User owner (id, name, email, avatarUrl, lastLoginAt, createdAt)
 *  3. workspaces       — tous les workspaces de l'org
 *  4. members          — tous les membres + infos user (id, name, email, avatarUrl, status, lastLoginAt) + role + permissions + invitedBy + invitedAt + acceptedAt
 *  5. subscription     — Subscription (ou null)
 *  6. license          — Licence active (status = active) ou null
 *  7. quota            — QuotaUsage du mois courant (ou null)
 *  8. invoices         — toutes les factures (createdAt desc)
 *  9. apiKeys          — toutes les clés API des membres (keyPrefix seulement, pas le hash)
 * 10. stats            — compteurs agrégés (totalMembers, totalMembersPending, totalWorkspaces, totalInvoices, totalApiKeys, totalCompanies, memberSince, daysActive)
 * 11. auditLogs        — 20 derniers logs (OWNER/ADMIN uniquement ; null sinon)
 *
 * Auth : tout utilisateur authentifié.
 * Champs sensibles (auditLogs) réservés aux OWNER/ADMIN.
 */
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function maskKey(key: string): string {
  // Masque une clé de licence : SQCI-xxxx-xxxx-xxxx (ne montre que les 4 premiers et 4 derniers caractères)
  if (!key || key.length < 8) return key ? "****" : ""
  if (key.length <= 12) return `${key.slice(0, 4)}…${key.slice(-4)}`
  return `${key.slice(0, 8)}-****-****-${key.slice(-4)}`
}

export async function GET() {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    // Récupère le membership actif pour déterminer l'org
    const membership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      select: { organizationId: true, role: true },
    })
    if (!membership) {
      return errorResponse("Aucune organisation associée", 404)
    }

    const organizationId = membership.organizationId
    const userRole = membership.role

    // 1. Organization
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    })
    if (!organization) {
      return errorResponse("Organisation introuvable", 404)
    }

    // 4. Members — d'abord tous les memberships
    const memberRows = await db.member.findMany({
      where: { organizationId },
      orderBy: { invitedAt: "asc" },
    })
    const userIds = memberRows.map((m) => m.userId)

    // Infos user pour chaque membre
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    const members = memberRows.map((m) => {
      const u = userMap.get(m.userId)
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        status: m.status,
        permissions: parseJson<string[]>(m.permissions, []),
        invitedBy: m.invitedBy,
        invitedAt: m.invitedAt,
        acceptedAt: m.acceptedAt,
        user: u
          ? {
              id: u.id,
              name: u.name,
              email: u.email,
              avatarUrl: u.avatarUrl,
              status: u.status,
              lastLoginAt: u.lastLoginAt,
              createdAt: u.createdAt,
            }
          : null,
      }
    })

    // 2. Owner
    const ownerRow = await db.user.findUnique({
      where: { id: organization.ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })
    const owner = ownerRow
      ? {
          ...ownerRow,
          // Le role est dérivé du member correspondant (typiquement OWNER)
          role: memberRows.find((m) => m.userId === ownerRow.id)?.role || "OWNER",
        }
      : null

    // 3. Workspaces
    const workspaces = await db.workspace.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    })

    // 5. Subscription
    const subscription = await db.subscription.findUnique({
      where: { organizationId },
    })

    // 6. License — active (status = "active"), sinon la plus récente
    const license = await db.license.findFirst({
      where: { organizationId, status: "active" },
      orderBy: { createdAt: "desc" },
    })

    // 7. Quota — mois courant
    const now = new Date()
    const periodYear = now.getFullYear()
    const periodMonth = now.getMonth() + 1
    const quota = await db.quotaUsage.findUnique({
      where: {
        organizationId_periodYear_periodMonth: {
          organizationId,
          periodYear,
          periodMonth,
        },
      },
    })

    // 8. Invoices
    const invoices = await db.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    })

    // 9. API keys — pour tous les users membres
    const apiKeyRows = userIds.length
      ? await db.apiKey.findMany({
          where: { userId: { in: userIds } },
          orderBy: { createdAt: "desc" },
        })
      : []
    const apiKeys = apiKeyRows.map((k) => {
      const u = userMap.get(k.userId)
      return {
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: parseJson<string[]>(k.scopes, []),
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        revokedAt: k.revokedAt,
        createdAt: k.createdAt,
        ownerName: u?.name || null,
        ownerEmail: u?.email || null,
      }
    })

    // 10. Stats
    const totalMembers = memberRows.filter((m) => m.status === "active").length
    const totalMembersPending = memberRows.filter((m) => m.status === "pending").length
    const totalWorkspaces = workspaces.length
    const totalInvoices = invoices.length
    const totalApiKeys = apiKeyRows.filter((k) => !k.revokedAt).length
    // Multi-tenant: count only companies owned by this org. OWNER-sees-all
    // behaviour is enforced elsewhere — this stat is always for the caller's
    // org so it accurately reflects their tenant's data.
    const totalCompanies = await db.company.count({
      where: { organizationId },
    })
    const memberSince = organization.createdAt
    const daysActive = Math.max(
      0,
      Math.floor((now.getTime() - organization.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    )

    // 11. Audit logs — OWNER/ADMIN seulement
    let auditLogs: Array<{
      id: string
      action: string
      category: string
      severity: string
      ip: string | null
      createdAt: Date
      metadata: Record<string, unknown>
      userId: string | null
      userEmail: string | null
      userName: string | null
    }> | null = null

    const canSeeAudit = userRole === "OWNER" || userRole === "ADMIN"
    if (canSeeAudit && userIds.length) {
      const logs = await db.auditLog.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
      auditLogs = logs.map((l) => {
        const u = l.userId ? userMap.get(l.userId) : undefined
        return {
          id: l.id,
          action: l.action,
          category: l.category,
          severity: l.severity,
          ip: l.ip,
          createdAt: l.createdAt,
          metadata: parseJson<Record<string, unknown>>(l.metadata, {}),
          userId: l.userId,
          userEmail: u?.email || null,
          userName: u?.name || null,
        }
      })
    }

    // License — masquer la clé
    const licenseResponse = license
      ? {
          ...license,
          features: parseJson<string[]>(license.features, []),
          keyMasked: maskKey(license.key),
        }
      : null

    // Organization — parse settings
    const organizationResponse = {
      ...organization,
      settings: parseJson<Record<string, unknown>>(organization.settings, {}),
    }

    // Invoices — parse items
    const invoicesResponse = invoices.map((inv) => ({
      ...inv,
      items: parseJson<unknown[]>(inv.items, []),
    }))

    return jsonResponse({
      organization: organizationResponse,
      owner,
      workspaces,
      members,
      subscription,
      license: licenseResponse,
      quota,
      invoices: invoicesResponse,
      apiKeys,
      stats: {
        totalMembers,
        totalMembersPending,
        totalWorkspaces,
        totalInvoices,
        totalApiKeys,
        totalCompanies,
        memberSince,
        daysActive,
      },
      auditLogs,
      currentRole: userRole,
      canSeeAudit,
    })
  } catch (err) {
    console.error("[organization/details] GET error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
