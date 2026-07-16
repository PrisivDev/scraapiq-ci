/**
 * GET /api/me
 * Retourne le profil de l'utilisateur courant + organisation + permissions
 */
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { db } from "@/lib/db"

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
    console.error("[me] error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
