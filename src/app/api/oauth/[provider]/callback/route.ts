/**
 * GET /api/oauth/[provider]/callback
 * Callback OAuth : échange le code, crée/lie l'utilisateur, set les tokens
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  type OAuthUserInfo,
} from "@/lib/auth/oauth"
import {
  completeLogin,
  errorResponse,
  extractRequestInfo,
} from "@/lib/auth/helpers"
import { logAudit } from "@/lib/auth/audit"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const redirectHome = (path: string, msg?: string) => {
    const url = new URL(path, req.nextUrl.origin)
    if (msg) url.searchParams.set("msg", msg)
    return NextResponse.redirect(url)
  }

  if (error) {
    return redirectHome("/auth/login", `oauth_error:${error}`)
  }

  if (!code || !state) {
    return redirectHome("/auth/login", "oauth_missing_params")
  }

  if (provider !== "google" && provider !== "microsoft") {
    return redirectHome("/auth/login", "oauth_bad_provider")
  }

  // Vérifie le state (CSRF)
  const stateCookie = req.cookies.get(`oauth_state_${provider}`)?.value
  if (!stateCookie || stateCookie !== state) {
    return redirectHome("/auth/login", "oauth_state_mismatch")
  }

  const redirectUri = `${req.nextUrl.origin}/api/oauth/${provider}/callback`

  try {
    const oauthUser: OAuthUserInfo =
      provider === "google"
        ? await exchangeGoogleCode(code, redirectUri)
        : await exchangeMicrosoftCode(code, redirectUri)

    const { ip, userAgent } = extractRequestInfo(req)

    // Lookup ou création de l'utilisateur
    let user = await db.user.findUnique({
      where: { email: oauthUser.email.toLowerCase() },
      include: {
        accounts: { where: { provider } },
        memberships: {
          where: { status: "active" },
          include: { organization: true, workspace: true },
          take: 1,
        },
      },
    })

    if (user) {
      // L'utilisateur existe : lie le compte OAuth s'il ne l'est pas déjà
      if (user.accounts.length === 0) {
        await db.account.create({
          data: {
            userId: user.id,
            provider,
            providerAccountId: oauthUser.providerAccountId,
            accessToken: oauthUser.accessToken,
            refreshToken: oauthUser.refreshToken,
            expiresAt: oauthUser.expiresAt,
          },
        })

        await logAudit({
          userId: user.id,
          action: "oauth_link",
          category: "oauth",
          severity: "info",
          ip,
          userAgent,
          metadata: { provider },
        })
      } else {
        // Update tokens
        await db.account.update({
          where: { id: user.accounts[0].id },
          data: {
            accessToken: oauthUser.accessToken,
            refreshToken: oauthUser.refreshToken,
            expiresAt: oauthUser.expiresAt,
          },
        })
      }
    } else {
      // Nouvel utilisateur : crée user + account + org par défaut
      const slugBase = oauthUser.email
        .split("@")[0]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`

      user = await db.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: oauthUser.email.toLowerCase(),
            name: oauthUser.name || oauthUser.email.split("@")[0],
            avatarUrl: oauthUser.avatarUrl,
            emailVerified: new Date(),
            accounts: {
              create: {
                provider,
                providerAccountId: oauthUser.providerAccountId,
                accessToken: oauthUser.accessToken,
                refreshToken: oauthUser.refreshToken,
                expiresAt: oauthUser.expiresAt,
              },
            },
          },
          include: {
            accounts: true,
            memberships: { include: { organization: true, workspace: true } },
          },
        })

        const org = await tx.organization.create({
          data: {
            name: `Organisation de ${newUser.name}`,
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

        // Refetch avec memberships
        return tx.user.findUnique({
          where: { id: newUser.id },
          include: {
            accounts: true,
            memberships: {
              where: { status: "active" },
              include: { organization: true, workspace: true },
              take: 1,
            },
          },
        })
      })

      if (!user) {
        return redirectHome("/auth/login", "oauth_user_creation_failed")
      }
    }

    const membership = user.memberships[0]
    const role = (membership?.role as "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER") || "VIEWER"

    await completeLogin({
      userId: user.id,
      email: user.email,
      name: user.name,
      role,
      orgId: membership?.organizationId,
      workspaceId: membership?.workspaceId ?? undefined,
      userAgent,
      ip,
      auditAction: "oauth_login",
    })

    await logAudit({
      userId: user.id,
      action: "oauth_login",
      category: "oauth",
      severity: "info",
      ip,
      userAgent,
      metadata: { provider },
    })

    return redirectHome("/")
  } catch (err) {
    console.error(`[oauth/${provider}/callback] error:`, err)
    return redirectHome("/auth/login", "oauth_internal_error")
  }
}
