/**
 * GET /api/me    — Retourne le profil de l'utilisateur courant + organisation + permissions
 * PUT /api/me    — Met à jour le profil de l'utilisateur courant (name, email, locale, timezone, avatarUrl)
 */
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/auth/audit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_LOCALES = new Set(["fr", "en"])
const ALLOWED_TIMEZONES = new Set([
  "Africa/Abidjan",
  "Africa/Casablanca",
  "Africa/Dakar",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "UTC",
])

export async function GET() {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    // Enrichit avec les infos org + memberships
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          include: {
            organization: { select: { id: true, name: true, slug: true, plan: true } },
            workspace: { select: { id: true, name: true, slug: true } },
          },
          where: { status: "active" },
        },
        accounts: {
          select: { provider: true, id: true },
        },
      },
    })

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        locale: fullUser?.locale,
        timezone: fullUser?.timezone,
        twoFactorEnabled: user.twoFactorEnabled,
        role: user.role,
        permissions: user.permissions,
        orgId: user.orgId,
        workspaceId: user.workspaceId,
        memberships: fullUser?.memberships.map((m) => ({
          id: m.id,
          role: m.role,
          organization: m.organization,
          workspace: m.workspace,
        })),
        oauthProviders: fullUser?.accounts.map((a) => a.provider) || [],
        lastLoginAt: fullUser?.lastLoginAt,
        createdAt: fullUser?.createdAt,
      },
    })
  } catch (err) {
    console.error("[me] GET error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}

export async function PUT(req: Request) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return errorResponse("JSON invalide", 400)
    }

    const updates: Record<string, unknown> = {}
    const changedFields: string[] = []

    // name
    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (name.length === 0 || name.length > 100) {
        return errorResponse("Nom invalide (1 à 100 caractères)", 400)
      }
      updates.name = name
      changedFields.push("name")
    }

    // email
    if (body.email !== undefined) {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
      if (!EMAIL_REGEX.test(email)) {
        return errorResponse("Email invalide", 400)
      }
      if (email !== user.email) {
        const existing = await db.user.findUnique({ where: { email } })
        if (existing && existing.id !== user.id) {
          return errorResponse("Email déjà utilisé", 409)
        }
      }
      updates.email = email
      changedFields.push("email")
    }

    // avatarUrl
    if (body.avatarUrl !== undefined) {
      const avatarUrl =
        typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : null
      if (avatarUrl && avatarUrl.length > 500) {
        return errorResponse("Avatar URL trop long", 400)
      }
      updates.avatarUrl = avatarUrl || null
      changedFields.push("avatarUrl")
    }

    // locale
    if (body.locale !== undefined) {
      const locale = typeof body.locale === "string" ? body.locale.trim() : ""
      if (!ALLOWED_LOCALES.has(locale)) {
        return errorResponse(`Locale invalide (autorisé: ${[...ALLOWED_LOCALES].join(", ")})`, 400)
      }
      updates.locale = locale
      changedFields.push("locale")
    }

    // timezone
    if (body.timezone !== undefined) {
      const timezone = typeof body.timezone === "string" ? body.timezone.trim() : ""
      if (!ALLOWED_TIMEZONES.has(timezone)) {
        return errorResponse(
          `Fuseau horaire invalide (autorisé: ${[...ALLOWED_TIMEZONES].slice(0, 6).join(", ")}...)`,
          400
        )
      }
      updates.timezone = timezone
      changedFields.push("timezone")
    }

    if (changedFields.length === 0) {
      return errorResponse("Aucun champ à mettre à jour", 400)
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: updates,
    })

    await logAudit({
      userId: user.id,
      action: "user_profile_update",
      category: "auth",
      severity: "info",
      metadata: { fields: changedFields },
    })

    return jsonResponse({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        locale: updated.locale,
        timezone: updated.timezone,
        twoFactorEnabled: updated.twoFactorEnabled,
      },
      updatedFields: changedFields,
    })
  } catch (err) {
    console.error("[me] PUT error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
