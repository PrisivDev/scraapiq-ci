/**
 * GET /api/permissions
 * Retourne toutes les permissions disponibles + celles de l'utilisateur courant
 */
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_HIERARCHY } from "@/lib/auth/config"

export async function GET() {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) return errorResponse(error || "Unauthorized", status)

    return jsonResponse({
      permissions: Object.entries(PERMISSIONS).map(([key, value]) => ({
        key,
        value,
        granted: user.permissions.includes(value),
      })),
      role: user.role,
      rolePermissions: ROLE_PERMISSIONS,
      roleHierarchy: ROLE_HIERARCHY,
      userPermissions: user.permissions,
    })
  } catch (err) {
    console.error("[permissions] error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
