/**
 * GET /api/organization  — Retourne l'organisation courante de l'utilisateur
 * PUT /api/organization  — Met à jour l'organisation (name) — OWNER/ADMIN uniquement
 */
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/auth/audit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base || "organisation"
  let suffix = 1
  for (;;) {
    const existing = await db.organization.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) return slug
    suffix += 1
    slug = `${base}-${suffix}`.slice(0, 60)
  }
}

export async function GET() {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    const membership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, plan: true, ownerId: true, settings: true, createdAt: true, updatedAt: true },
        },
        workspace: { select: { id: true, name: true, slug: true } },
      },
    })

    if (!membership) {
      return errorResponse("Aucune organisation associée", 404)
    }

    return jsonResponse({
      organization: membership.organization,
      workspace: membership.workspace,
      role: membership.role,
    })
  } catch (err) {
    console.error("[organization] GET error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}

export async function PUT(req: Request) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) {
      return errorResponse(error || "Unauthorized", status)
    }

    // OWNER/ADMIN only
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return errorResponse("Accès refusé (OWNER ou ADMIN requis)", 403)
    }

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return errorResponse("JSON invalide", 400)
    }

    // Get user's active membership (which org they belong to)
    const membership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      select: { organizationId: true, role: true },
    })
    if (!membership) {
      return errorResponse("Aucune organisation associée", 404)
    }

    const updates: Record<string, unknown> = {}
    const changedFields: string[] = []

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (name.length === 0 || name.length > 100) {
        return errorResponse("Nom d'organisation invalide (1 à 100 caractères)", 400)
      }
      updates.name = name
      const base = slugify(name)
      updates.slug = await uniqueSlug(base, membership.organizationId)
      changedFields.push("name", "slug")
    }

    if (changedFields.length === 0) {
      return errorResponse("Aucun champ à mettre à jour", 400)
    }

    const updated = await db.organization.update({
      where: { id: membership.organizationId },
      data: updates,
    })

    await logAudit({
      userId: user.id,
      action: "org_update",
      category: "admin",
      severity: "info",
      metadata: {
        organizationId: membership.organizationId,
        fields: changedFields,
      },
    })

    return jsonResponse({
      organization: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        plan: updated.plan,
        ownerId: updated.ownerId,
      },
      updatedFields: changedFields,
    })
  } catch (err) {
    console.error("[organization] PUT error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
