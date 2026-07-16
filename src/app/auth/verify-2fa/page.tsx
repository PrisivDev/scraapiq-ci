"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ShieldCheck,
  Loader2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Smartphone,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp"
import { AuthLayout } from "@/components/auth/auth-layout"

function Verify2FAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get("userId") || ""

  const [useBackup, setUseBackup] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [backupCode, setBackupCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [remaining, setRemaining] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!userId) {
      setError("Lien invalide. Identifiant utilisateur manquant.")
    }
  }, [userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setRemaining(null)

    if (!userId) {
      setError("Lien invalide. Veuillez vous reconnecter.")
      return
    }

    const submittedCode = useBackup ? backupCode.trim() : code
    if (!submittedCode) {
      setError(useBackup ? "Veuillez saisir un code de récupération." : "Veuillez saisir le code à 6 chiffres.")
      return
    }
    if (!useBackup && code.length !== 6) {
      setError("Le code doit contenir 6 chiffres.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          code: submittedCode,
          useBackup,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success) {
        toast.success("Connexion réussie", {
          description: `Bienvenue ${data.user?.name || data.user?.email}`,
        })
        router.push("/")
        return
      }

      if (res.status === 429) {
        setError(data.error || "Trop de tentatives 2FA. Réessayez plus tard.")
        return
      }
      if (res.status === 401) {
        setError(data.error || "Code invalide.")
        return
      }
      if (res.status === 400) {
        setError(data.error || "2FA non activé pour ce compte.")
        return
      }
      if (res.status === 404) {
        setError("Utilisateur introuvable. Veuillez vous reconnecter.")
        return
      }

      setError(data.error || "Erreur lors de la vérification.")
    } catch {
      toast.error("Erreur réseau", {
        description: "Impossible de contacter le serveur.",
      })
      setError("Erreur réseau. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      tagline="Vérification en deux étapes"
    >
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Code de sécurité</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {useBackup
              ? "Saisissez l'un de vos codes de récupération à usage unique."
              : "Saisissez le code à 6 chiffres généré par votre application d'authentification."}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {!useBackup ? (
            <div className="space-y-2">
              <Label htmlFor="otp">Code à 6 chiffres</Label>
              <div className="flex justify-center pt-2">
                <InputOTP
                  id="otp"
                  maxLength={6}
                  value={code}
                  onChange={(v) => setCode(v)}
                  disabled={loading}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
                <Smartphone className="h-3.5 w-3.5" />
                Google Authenticator, Authy, 1Password…
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="backup">Code de récupération</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="backup"
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="abcd-efgh"
                  className="pl-9 font-mono"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Les codes de récupération sont à usage unique. Chaque utilisation en supprime un.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loading || !userId}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Vérification…
              </>
            ) : (
              <>
                Vérifier
                <ShieldCheck className="h-4 w-4" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="use-backup" className="text-sm font-medium cursor-pointer">
                Utiliser un code de récupération
              </Label>
              <p className="text-xs text-muted-foreground">
                Plus accès à votre appareil ?
              </p>
            </div>
            <Switch
              id="use-backup"
              checked={useBackup}
              onCheckedChange={setUseBackup}
              disabled={loading}
            />
          </div>

          {remaining !== null && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              Tentatives restantes : {remaining}
            </p>
          )}
        </form>

        <div className="text-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}

export default function Verify2FAPage() {
  return (
    <React.Suspense fallback={null}>
      <Verify2FAContent />
    </React.Suspense>
  )
}
