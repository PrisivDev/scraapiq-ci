/**
 * OAuth : génération state + PKCE pour Google et Microsoft
 *
 * Note : en mode démo, on n'appelle pas réellement les providers
 * (pas de credentials Google/Microsoft configurés).
 * On fournit néanmoins les URLs et le flow complet.
 *
 * En production : remplir GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET dans .env
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
const MICROSOFT_USERINFO_URL = "https://graph.microsoft.com/oidc/userinfo"

const SCOPES = {
  google: ["openid", "email", "profile"].join(" "),
  microsoft: ["openid", "email", "profile", "User.Read"].join(" "),
}

export interface OAuthUserInfo {
  provider: "google" | "microsoft"
  providerAccountId: string
  email: string
  name?: string
  avatarUrl?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
}

/**
 * Génère l'URL d'autorisation Google
 */
export function getGoogleAuthURL(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "demo-client-id",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.google,
    state,
    access_type: "offline",
    prompt: "consent",
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Génère l'URL d'autorisation Microsoft
 */
export function getMicrosoftAuthURL(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || "demo-client-id",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.microsoft,
    state,
    response_mode: "query",
  })
  return `${MICROSOFT_AUTH_URL}?${params.toString()}`
}

/**
 * Échange le code Google contre un access token + récupère le profil
 */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<OAuthUserInfo> {
  // DÉMO : si pas de credentials configurés, on simule
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return simulateOAuthUserInfo("google", code)
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`)
  }

  const tokens = await tokenRes.json()

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userRes.ok) {
    throw new Error(`Google userinfo failed: ${userRes.status}`)
  }

  const user = await userRes.json()

  return {
    provider: "google",
    providerAccountId: user.sub,
    email: user.email,
    name: user.name,
    avatarUrl: user.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
  }
}

/**
 * Échange le code Microsoft
 */
export async function exchangeMicrosoftCode(code: string, redirectUri: string): Promise<OAuthUserInfo> {
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return simulateOAuthUserInfo("microsoft", code)
  }

  const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES.microsoft,
    }),
  })

  if (!tokenRes.ok) {
    throw new Error(`Microsoft token exchange failed: ${tokenRes.status}`)
  }

  const tokens = await tokenRes.json()

  const userRes = await fetch(MICROSOFT_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userRes.ok) {
    throw new Error(`Microsoft userinfo failed: ${userRes.status}`)
  }

  const user = await userRes.json()

  return {
    provider: "microsoft",
    providerAccountId: user.sub,
    email: user.email,
    name: user.name,
    avatarUrl: user.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
  }
}

/**
 * Simule un retour OAuth en mode démo (sans credentials)
 * Génère un utilisateur fake déterministe à partir du code
 */
function simulateOAuthUserInfo(provider: "google" | "microsoft", code: string): OAuthUserInfo {
  // En mode démo, on accepte n'importe quel code comme un identifiant
  const fakeId = code.slice(0, 12) || "demo12345678"
  const fakeEmail = `demo-${fakeId}@${provider === "google" ? "gmail.com" : "outlook.com"}`

  return {
    provider,
    providerAccountId: fakeId,
    email: fakeEmail,
    name: `Utilisateur ${provider === "google" ? "Google" : "Microsoft"} (démo)`,
    avatarUrl: undefined,
    accessToken: "demo-access-token",
    refreshToken: "demo-refresh-token",
    expiresAt: new Date(Date.now() + 3600 * 1000),
  }
}

/**
 * Génère un state aléatoire pour CSRF protection
 */
export function generateOAuthState(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
