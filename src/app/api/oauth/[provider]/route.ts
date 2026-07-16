/**
 * GET /api/oauth/[provider]
 * Redirige vers le consent screen du provider (google | microsoft)
 */
import { NextRequest, NextResponse } from "next/server"
import { generateOAuthState, getGoogleAuthURL, getMicrosoftAuthURL } from "@/lib/auth/oauth"
import { AUTH_CONFIG } from "@/lib/auth/config"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Provider not supported" }, { status: 400 })
  }

  const state = generateOAuthState()
  const redirectUri = `${req.nextUrl.origin}/api/oauth/${provider}/callback`

  const authURL =
    provider === "google"
      ? getGoogleAuthURL(state, redirectUri)
      : getMicrosoftAuthURL(state, redirectUri)

  const response = NextResponse.redirect(authURL)
  response.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: AUTH_CONFIG.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_CONFIG.OAUTH_STATE_TTL_SECONDS,
  })

  return response
}
