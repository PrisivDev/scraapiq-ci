/**
 * PUT  /api/organization/members/[id]  — Update a member's role
 *   - Auth: ADMIN or OWNER only
 *   - ADMIN can change AGENT <-> VIEWER <-> MANAGER (cannot promote to ADMIN or OWNER)
 *   - OWNER can change any role (cannot demote themselves from OWNER if they are the org owner)
 *   - Cannot change own role (defensive)
 *   - Audit: action "member_role_changed"
 *
 * DELETE /api/organization/members/[id]  — Remove a member from the org
 *   - Auth: ADMIN or OWNER only
 *   - ADMIN can remove any non-OWNER member (cannot remove themselves, cannot remove OWNER)
 *   - OWNER can remove any member (including themselves only if they're not the org owner)
 *   - Cannot remove the org owner (organization.ownerId)
 *   - Audit: action "member_removed"
 */
import { NextRequest } from "next/server"
import { getAuthUser, errorResponse, jsonResponse, extractRequestInfo } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/auth/audit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Rôles qu'un ADMIN peut assigner (pas ADMIN, pas OWNER)
const ADMIN_ASSIGNABLE_ROLES = new Set(["MANAGER", "AGENT", "VIEWER"])
// Rôles qu'un OWNER peut assigner
const OWNER_ASSIGNABLE_ROLES = new Set(["ADMIN", "MANAGER", "AGENT", "VIEWER"])

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    // Auth : ADMIN ou OWNER uniquement
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return errorResponse("Accès refusé (ADMIN ou OWNER requis)", 403)
    }

    const { id: memberId } = await params

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return errorResponse("JSON invalide", 400)
    }

    const newRole = typeof body.role === "string" ? body.role.toUpperCase() : ""
    if (!newRole) {
      return errorResponse("Champ 'role' requis", 400)
    }

    // Récupère le membership actif de l'appelant
    const callerMembership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      select: { organizationId: true, role: true },
    })
    if (!callerMembership) {
      return errorResponse("Aucune organisation associée", 404)
    }

    // Récupère le membre ciblé dans la même org
    const targetMember = await db.member.findUnique({
      where: { id: memberId },
      select: { id: true, userId: true, organizationId: true, role: true, status: true },
    })

    if (!targetMember || targetMember.organizationId !== callerMembership.organizationId) {
      return errorResponse("Membre introuvable dans votre organisation", 404)
    }

    // Ne peut pas modifier son propre rôle
    if (targetMember.userId === user.id) {
      return errorResponse("Vous ne pouvez pas modifier votre propre rôle", 400)
    }

    // Validation du rôle cible selon l'auteur
    const allowedRoles = user.role === "OWNER" ? OWNER_ASSIGNABLE_ROLES : ADMIN_ASSIGNABLE_ROLES
    if (!allowedRoles.has(newRole)) {
      return errorResponse(
        `Rôle cible invalide. ${user.role === "OWNER" ? "OWNER peut assigner ADMIN/MANAGER/AGENT/VIEWER." : "ADMIN peut assigner uniquement MANAGER/AGENT/VIEWER."}`,
        400
      )
    }

    // Un ADMIN ne peut pas modifier un OWNER ou un autre ADMIN (escalade interdite)
    if (user.role === "ADMIN" && (targetMember.role === "OWNER" || targetMember.role === "ADMIN")) {
      return errorResponse(
        `Un ADMIN ne peut pas modifier un membre ${targetMember.role}`,
        403
      )
    }

    if (targetMember.role === newRole) {
      return errorResponse("Le membre a déjà ce rôle", 400)
    }

    const previousRole = targetMember.role
    const { ip, userAgent } = extractRequestInfo(req)

    await db.member.update({
      where: { id: memberId },
      data: { role: newRole as "ADMIN" | "MANAGER" | "AGENT" | "VIEWER" },
    })

    await logAudit({
      userId: user.id,
      action: "member_role_changed",
      category: "admin",
      severity: "info",
      ip,
      userAgent,
      metadata: {
        organizationId: callerMembership.organizationId,
        memberId,
        targetUserId: targetMember.userId,
        previousRole,
        newRole,
      },
    })

    return jsonResponse({
      success: true,
      memberId,
      previousRole,
      newRole,
    })
  } catch (err) {
    console.error("[organization/members/[id]] PUT error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    // Auth : ADMIN ou OWNER uniquement
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return errorResponse("Accès refusé (ADMIN ou OWNER requis)", 403)
    }

    const { id: memberId } = await params

    // Récupère le membership actif de l'appelant
    const callerMembership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      select: { organizationId: true, role: true },
    })
    if (!callerMembership) {
      return errorResponse("Aucune organisation associée", 404)
    }

    // Récupère le membre ciblé dans la même org
    const targetMember = await db.member.findUnique({
      where: { id: memberId },
      select: { id: true, userId: true, organizationId: true, role: true, status: true },
    })

    if (!targetMember || targetMember.organizationId !== callerMembership.organizationId) {
      return errorResponse("Membre introuvable dans votre organisation", 404)
    }

    // Ne peut pas se supprimer soi-même
    if (targetMember.userId === user.id) {
      return errorResponse("Vous ne pouvez pas vous retirer vous-même de l'organisation", 400)
    }

    // Récupère l'org pour vérifier l'ownerId
    const org = await db.organization.findUnique({
      where: { id: callerMembership.organizationId },
      select: { ownerId: true, name: true },
    })
    if (!org) {
      return errorResponse("Organisation introuvable", 404)
    }

    // Personne ne peut retirer le owner de l'org
    if (targetMember.userId === org.ownerId) {
      return errorResponse("Le propriétaire de l'organisation ne peut pas être retiré", 403)
    }

    // Un ADMIN ne peut pas retirer un OWNER ou un autre ADMIN
    if (user.role === "ADMIN" && (targetMember.role === "OWNER" || targetMember.role === "ADMIN")) {
      return errorResponse(
        `Un ADMIN ne peut pas retirer un membre ${targetMember.role}`,
        403
      )
    }

    const { ip, userAgent } = extractRequestInfo(_req)

    // Soft-delete: on passe le statut à "revoked" plutôt que de supprimer (préserve l'historique)
    await db.member.update({
      where: { id: memberId },
      data: { status: "revoked" },
    })

    await logAudit({
      userId: user.id,
      action: "member_removed",
      category: "admin",
      severity: "warn",
      ip,
      userAgent,
      metadata: {
        organizationId: callerMembership.organizationId,
        memberId,
        targetUserId: targetMember.userId,
        previousRole: targetMember.role,
        previousStatus: targetMember.status,
      },
    })

    return jsonResponse({
      success: true,
      memberId,
      revoked: true,
    })
  } catch (err) {
    console.error("[organization/members/[id]] DELETE error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
