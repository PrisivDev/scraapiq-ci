/**
 * POST /api/organization/invite
 *   Invite a new (or existing) user to the current user's organization as AGENT/VIEWER/MANAGER.
 *   - Auth: ADMIN or OWNER only
 *   - ADMIN can only invite AGENT/VIEWER/MANAGER (NOT ADMIN/OWNER — reserved for OWNER)
 *   - OWNER can invite any role (except another OWNER)
 *   - Plan limit check: if an active License exists and current active members >= license.maxUsers -> 403
 *   - If user does not exist: create a pending Member record (status: "pending", invitedBy: current user)
 *       (In a real app we would send an email; here we just create the pending membership.)
 *   - If user exists: create a pending Member linking them to this org
 *   - Audit: action "member_invited"
 *
 * GET /api/organization/invite
 *   List pending invitations for the current org (ADMIN/OWNER only)
 */
import { NextRequest } from "next/server"
import { getAuthUser, errorResponse, jsonResponse, extractRequestInfo } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/auth/audit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Rôles qu'un ADMIN peut inviter
const ADMIN_INVITABLE_ROLES = new Set(["AGENT", "VIEWER", "MANAGER"])
// Rôles qu'un OWNER peut inviter (pas de second OWNER pour éviter la confusion)
const OWNER_INVITABLE_ROLES = new Set(["ADMIN", "MANAGER", "AGENT", "VIEWER"])

export async function POST(req: NextRequest) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    // Auth : ADMIN ou OWNER uniquement
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return errorResponse("Accès refusé (ADMIN ou OWNER requis)", 403)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return errorResponse("JSON invalide", 400)
    }

    const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const roleRaw = typeof body.role === "string" ? body.role.toUpperCase() : "VIEWER"
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined

    if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
      return errorResponse("Email invalide", 400)
    }

    // Validation du rôle selon le rôle de l'inviteur
    const allowedRoles = user.role === "OWNER" ? OWNER_INVITABLE_ROLES : ADMIN_INVITABLE_ROLES
    if (!allowedRoles.has(roleRaw)) {
      return errorResponse(
        `Rôle invalide. ${user.role === "OWNER" ? "OWNER peut inviter des ADMIN/MANAGER/AGENT/VIEWER." : "ADMIN peut inviter uniquement des MANAGER/AGENT/VIEWER."}`,
        400
      )
    }

    // Récupère le membership actif pour déterminer l'org
    const membership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      select: { organizationId: true, role: true, workspaceId: true },
    })
    if (!membership) {
      return errorResponse("Aucune organisation associée", 404)
    }

    const organizationId = membership.organizationId
    const targetWorkspaceId = workspaceId || membership.workspaceId || undefined

    // Vérifie la limite du plan : si une licence active existe, on compare members.count à license.maxUsers
    const activeLicense = await db.license.findFirst({
      where: { organizationId, status: "active" },
      select: { id: true, maxUsers: true, name: true, plan: true },
    })
    if (activeLicense) {
      const activeMembers = await db.member.count({
        where: {
          organizationId,
          status: { in: ["active", "pending"] },
        },
      })
      if (activeMembers >= activeLicense.maxUsers) {
        return errorResponse(
          `Limite du plan atteinte (${activeMembers}/${activeLicense.maxUsers} utilisateurs). Upgraddez votre licence pour inviter plus de membres.`,
          403,
          { limit: activeLicense.maxUsers, current: activeMembers }
        )
      }
    }

    // Vérifie qu'il n'y a pas déjà une invitation active/pending pour cet email dans cette org
    const existingUser = await db.user.findUnique({
      where: { email: emailRaw },
      select: { id: true, name: true, email: true, status: true },
    })

    if (existingUser) {
      const existingMember = await db.member.findFirst({
        where: {
          userId: existingUser.id,
          organizationId,
          status: { in: ["active", "pending"] },
        },
        select: { id: true, status: true, role: true },
      })
      if (existingMember) {
        return errorResponse(
          `${emailRaw} est déjà membre de cette organisation (statut: ${existingMember.status}, rôle: ${existingMember.role})`,
          409
        )
      }
    }

    // Vérifie que le workspaceId (fourni) appartient bien à cette org
    if (targetWorkspaceId) {
      const ws = await db.workspace.findUnique({
        where: { id: targetWorkspaceId },
        select: { id: true, organizationId: true },
      })
      if (!ws || ws.organizationId !== organizationId) {
        return errorResponse("Workspace invalide", 400)
      }
    }

    // Cas 1 : utilisateur existe déjà -> on crée juste le Member pending
    // Cas 2 : utilisateur n'existe pas -> on le crée (status: "pending") puis on crée le Member pending
    // Note: dans une vraie app, on enverrait un email d'activation. Ici on crée juste le User sans passwordHash.
    const { ip, userAgent } = extractRequestInfo(req)

    let invitedUserId: string = ""
    let newUserCreated = false
    let memberId: string = ""

    // Transaction courte : crée le User (si nécessaire) + le Member pending
    memberId = await db.$transaction(async (tx) => {
      if (existingUser) {
        invitedUserId = existingUser.id
      } else {
        const created = await tx.user.create({
          data: {
            email: emailRaw,
            name: emailRaw.split("@")[0],
            status: "pending", // pending activation (user must complete signup)
            // passwordHash: null — l'utilisateur devra définir son mot de passe via un token d'invitation
          },
        })
        invitedUserId = created.id
        newUserCreated = true
      }

      const member = await tx.member.create({
        data: {
          userId: invitedUserId,
          organizationId,
          workspaceId: targetWorkspaceId || null,
          role: roleRaw as "AGENT" | "VIEWER" | "MANAGER" | "ADMIN",
          status: "pending",
          invitedBy: user.id,
          invitedAt: new Date(),
          // acceptedAt: null — sera set quand l'utilisateur acceptera
        },
      })

      return member.id
    })

    // Audit log hors transaction pour éviter le timeout Prisma
    await logAudit({
      userId: user.id,
      action: "member_invited",
      category: "admin",
      severity: "info",
      ip,
      userAgent,
      metadata: {
        organizationId,
        invitedEmail: emailRaw,
        invitedUserId,
        role: roleRaw,
        newUserCreated,
        memberId,
        workspaceId: targetWorkspaceId || null,
      },
    })

    return jsonResponse({
      success: true,
      invited: true,
      memberId,
      email: emailRaw,
      role: roleRaw,
      newUserCreated,
    })
  } catch (err) {
    console.error("[organization/invite] POST error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}

export async function GET() {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    // Auth : ADMIN ou OWNER uniquement
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return errorResponse("Accès refusé (ADMIN ou OWNER requis)", 403)
    }

    const membership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      select: { organizationId: true },
    })
    if (!membership) {
      return errorResponse("Aucune organisation associée", 404)
    }

    const pendingMembers = await db.member.findMany({
      where: { organizationId: membership.organizationId, status: "pending" },
      orderBy: { invitedAt: "desc" },
    })

    const userIds = pendingMembers.map((m) => m.userId)
    const users =
      userIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, avatarUrl: true },
          })
        : []

    const inviterIds = pendingMembers.map((m) => m.invitedBy).filter(Boolean) as string[]
    const inviters =
      inviterIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: inviterIds } },
            select: { id: true, name: true, email: true },
          })
        : []

    const userMap = new Map(users.map((u) => [u.id, u]))
    const inviterMap = new Map(inviters.map((u) => [u.id, u]))

    const invitations = pendingMembers.map((m) => {
      const u = userMap.get(m.userId)
      const inviter = m.invitedBy ? inviterMap.get(m.invitedBy) : null
      return {
        id: m.id,
        email: u?.email || "(utilisateur supprimé)",
        name: u?.name || null,
        avatarUrl: u?.avatarUrl || null,
        role: m.role,
        status: m.status,
        invitedAt: m.invitedAt,
        invitedBy: m.invitedBy
          ? {
              id: m.invitedBy,
              name: inviter?.name || null,
              email: inviter?.email || null,
            }
          : null,
      }
    })

    return jsonResponse({ invitations, total: invitations.length })
  } catch (err) {
    console.error("[organization/invite] GET error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
