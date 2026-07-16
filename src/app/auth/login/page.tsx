"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AuthLayout } from "@/components/auth/auth-layout"
import { OAuthButtons } from "@/components/auth/oauth-buttons"

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_error_access_denied: "Vous avez refusé l'accès au fournisseur OAuth.",
  oauth_missing_params: "Paramètres OAuth manquants. Réessayez.",
  oauth_bad_provider: "Fournisseur OAuth non supporté.",
  oauth_state_mismatch: "Erreur de sécurité OAuth (state mismatch). Réessayez.",
  oauth_internal_error: "Erreur lors de l'authentification OAuth. Réessayez.",
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/"
  const oauthMsg = searchParams.get("msg")

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [rateLimitReset, setRateLimitReset] = React.useState<number | null>(null)

  // Surface OAuth errors as a toast + inline message
  React.useEffect(() => {
    if (oauthMsg) {
      const msg = OAUTH_ERROR_MESSAGES[oauthMsg] || `Erreur OAuth: ${oauthMsg}`
      setError(msg)
      toast.error("Connexion OAuth échouée", { description: msg })
    }
  }, [oauthMsg])

  // Countdown for rate-limit lockout
  React.useEffect(() => {
    if (!rateLimitReset) return
    const id = setInterval(() => {
      const remaining = Math.max(0, rateLimitReset - 1)
      setRateLimitReset(remaining)
      if (remaining === 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [rateLimitReset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setRateLimitReset(null)

    if (!email || !password) {
      setError("Veuillez renseigner votre email et mot de passe.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success) {
        toast.success("Connexion réussie", {
          description: `Bienvenue ${data.user?.name || data.user?.email}`,
        })
        router.push(redirect)
        return
      }

      if (data.requiresTwoFactor) {
        toast.info("Code 2FA requis", {
          description: "Saisissez le code généré par votre application.",
        })
        router.push(`/auth/verify-2fa?userId=${encodeURIComponent(data.userId)}`)
        return
      }

      if (res.status === 429) {
        const resetAt = data.resetAt ? new Date(data.resetAt).getTime() : Date.now() + 15 * 60 * 1000
        const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
        setRateLimitReset(seconds)
        setError(
          data.error ||
            "Trop de tentatives échouées. Réessayez dans quelques minutes."
        )
        return
      }

      if (res.status === 423) {
        setError("Compte temporairement verrouillé. Réessayez plus tard.")
        return
      }

      if (res.status === 401) {
        setError(data.error || "Identifiants invalides.")
        return
      }

      setError(data.error || "Erreur lors de la connexion.")
    } catch {
      toast.error("Erreur réseau", {
        description: "Impossible de contacter le serveur. Vérifiez votre connexion.",
      })
      setError("Erreur réseau. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connexion</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accédez à votre plateforme de scraping intelligent.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {error}
              {rateLimitReset ? (
                <span className="block mt-1 font-medium tabular-nums">
                  Réessayez dans {formatCountdown(rateLimitReset)}
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email professionnel</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="vous@entreprise.ci"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link
                href="/auth/login"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  toast.info("Réinitialisation de mot de passe", {
                    description: "Cette fonctionnalité sera bientôt disponible.",
                  })
                }}
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-9 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connexion…
              </>
            ) : (
              <>
                Se connecter
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <OAuthButtons caption="Continuez avec un compte externe" />

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-primary hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginContent />
    </React.Suspense>
  )
}
