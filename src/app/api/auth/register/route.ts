/**
 * POST /api/auth/register
 * Inscription email + mot de passe + création org par défaut
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, isPasswordStrong } from "@/lib/auth/password"
import { completeLogin, errorResponse, extractRequestInfo, jsonResponse } from "@/lib/auth/helpers"
import { checkRateLimit, getRateLimitKey } from "@/lib/auth/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const rlKey = getRateLimitKey(req, "register")
    const rl = checkRateLimit(rlKey, { max: 5 })
    if (!rl.allowed) {
      return errorResponse("Trop de tentatives. Réessayez plus tard.", 429, {
        resetAt: new Date(rl.resetAt).toISOString(),
      })
    }

    const body = await req.json()
    const { email, password, name, orgName } = body

    if (!email || !password) {
      return errorResponse("Email et mot de passe requis", 400)
    }

    const strength = isPasswordStrong(password)
    if (!strength.ok) {
      return errorResponse(
        "Mot de passe trop faible. Il doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.",
        400,
        { checks: strength.checks }
      )
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return errorResponse("Un compte existe déjà avec cet email", 409)
    }

    const passwordHash = await hashPassword(password)

    const { ip, userAgent } = extractRequestInfo(req)
    const slugBase = (orgName || `org-${email.split("@")[0]}`)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`

    const user = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name: name || email.split("@")[0],
        },
      })

      const org = await tx.organization.create({
        data: {
          name: orgName || `Organisation de ${name || email}`,
          slug,
          ownerId: newUser.id,
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

      await tx.member.create({
        data: {
          userId: newUser.id,
          organizationId: org.id,
          workspaceId: workspace.id,
          role: "OWNER",
          status: "active",
          acceptedAt: new Date(),
        },
      })

      return { ...newUser, orgId: org.id, workspaceId: workspace.id }
    })

    await completeLogin({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: "OWNER",
      orgId: user.orgId,
      workspaceId: user.workspaceId,
      userAgent,
      ip,
      auditAction: "register",
    })

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: "OWNER",
        orgId: user.orgId,
      },
    })
  } catch (err) {
    console.error("[register] error:", err)
    return errorResponse("Erreur lors de l'inscription", 500)
  }
}
