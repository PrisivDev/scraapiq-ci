"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ShieldCheck,
  Loader2,
  AlertCircle,
  Download,
  Copy,
  CheckCircle2,
  Smartphone,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Lock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountLayout } from "@/components/auth/auth-layout"

type Step = "loading" | "init" | "confirm" | "done"

interface InitData {
  secret: string
  qrCode: string
  otpauthUri: string
  backupCodes: string[]
  message?: string
}

export default function Setup2FAPage() {
  const router = useRouter()

  const [step, setStep] = React.useState<Step>("loading")
  const [initData, setInitData] = React.useState<InitData | null>(null)
  const [code, setCode] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [downloaded, setDownloaded] = React.useState(false)
  const [copiedSecret, setCopiedSecret] = React.useState(false)

  // Auth guard + auto-init
  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const me = await fetch("/api/me", { credentials: "include" })
        if (!me.ok) {
          router.replace("/auth/login?redirect=/auth/setup-2fa")
          return
        }
        // Auto-init the wizard
        const res = await fetch("/api/twofa/setup", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "init" }),
        })
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (!res.ok) {
          setError(data.error || "Impossible d'initialiser le 2FA.")
          setStep("init")
          return
        }
        setInitData(data)
        setStep("init")
      } catch {
        if (active) {
          setError("Erreur réseau. Rechargez la page.")
          setStep("init")
        }
      }
    })()
    return () => {
      active = false
    }
  }, [router])

  const handleDownloadBackupCodes = () => {
    if (!initData) return
    const content = [
      "ScrapIQ CI — Codes de récupération 2FA",
      "Conservez ce fichier en lieu sûr. Chaque code est à usage unique.",
      `Généré le : ${new Date().toLocaleString("fr-FR")}`,
      "",
      ...initData.backupCodes.map((c, i) => `${(i + 1).toString().padStart(2, "0")}. ${c}`),
      "",
      "Si vous perdez l'accès à votre application d'authentification,",
      "utilisez un de ces codes pour vous connecter.",
    ].join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "scraapiq-backup-codes.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
    toast.success("Codes de récupération téléchargés")
  }

  const handleCopySecret = async () => {
    if (!initData) return
    try {
      await navigator.clipboard.writeText(initData.secret)
      setCopiedSecret(true)
      toast.success("Clé secrète copiée")
      setTimeout(() => setCopiedSecret(false), 2000)
    } catch {
      toast.error("Impossible de copier la clé")
    }
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (code.length !== 6) {
      setError("Veuillez saisir le code à 6 chiffres complet.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/twofa/setup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success("2FA activé avec succès", {
          description: "Votre compte est désormais protégé.",
        })
        setStep("done")
        return
      }
      if (res.status === 401) {
        setError(data.error || "Code TOTP invalide. Vérifiez l'heure de votre appareil.")
        return
      }
      setError(data.error || "Erreur lors de la confirmation.")
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AccountLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Activer la double authentification
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Renforcez la sécurité de votre compte en quelques étapes.
            </p>
          </div>
          <Link
            href="/account/security"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la sécurité
          </Link>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          {[
            { k: "init", n: "1", label: "QR code" },
            { k: "confirm", n: "2", label: "Confirmation" },
            { k: "done", n: "3", label: "Terminé" },
          ].map((s, i) => {
            const active = step === s.k
            const completed =
              (step === "confirm" && s.k === "init") ||
              (step === "done" && (s.k === "init" || s.k === "confirm"))
            return (
              <React.Fragment key={s.k}>
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 border ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : completed
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-current text-[10px] font-bold text-background">
                    {completed ? "✓" : s.n}
                  </span>
                  {s.label}
                </div>
                {i < 2 && <div className="h-px flex-1 bg-border" />}
              </React.Fragment>
            )
          })}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: QR + backup codes */}
        {step === "loading" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Initialisation du 2FA…</p>
            </CardContent>
          </Card>
        )}

        {step === "init" && initData && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Étape 1 — Scannez le QR code
                </CardTitle>
                <CardDescription>
                  Ouvrez votre application d'authentification (Google Authenticator, Authy,
                  1Password…) et scannez ce QR code, ou saisissez la clé manuellement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    {/* QR code rendered as data URL from the API */}
                    <img
                      src={initData.qrCode}
                      alt="QR code 2FA"
                      width={200}
                      height={200}
                      className="h-[200px] w-[200px]"
                    />
                  </div>
                  <div className="space-y-2 flex-1 w-full">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Clé secrète (saisie manuelle)
                    </Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
                        {initData.secret}
                      </code>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={handleCopySecret}
                        aria-label="Copier la clé"
                      >
                        {copiedSecret ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {initData.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Codes de récupération
                </CardTitle>
                <CardDescription>
                  Conservez précieusement ces codes. Ils vous permettront d'accéder à votre
                  compte si vous perdez votre appareil. Chaque code est à usage unique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {initData.backupCodes.map((c, i) => (
                    <code
                      key={i}
                      className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs font-mono text-center"
                    >
                      {c}
                    </code>
                  ))}
                </div>
                <Button
                  type="button"
                  variant={downloaded ? "secondary" : "outline"}
                  onClick={handleDownloadBackupCodes}
                  className="gap-2"
                >
                  {downloaded ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {downloaded ? "Codes téléchargés" : "Télécharger les codes"}
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setStep("confirm")} className="gap-2">
                Continuer
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Confirm code */}
        {step === "confirm" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary" />
                Étape 2 — Confirmez avec un code
              </CardTitle>
              <CardDescription>
                Saisissez le code à 6 chiffres actuellement affiché dans votre application
                d'authentification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfirm} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="confirm-otp">Code TOTP</Label>
                  <div className="flex justify-center pt-2">
                    <InputOTP
                      id="confirm-otp"
                      maxLength={6}
                      value={code}
                      onChange={(v) => setCode(v)}
                      disabled={submitting}
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
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("init")}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Button>
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Activation…
                      </>
                    ) : (
                      <>
                        Activer le 2FA
                        <ShieldCheck className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === "done" && (
          <Card>
            <CardContent className="py-10 flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">2FA activé avec succès</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Votre compte est désormais protégé par une double authentification. Vous
                  devrez saisir un code TOTP à chaque connexion.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button asChild className="gap-2">
                  <Link href="/account/security">
                    <ShieldCheck className="h-4 w-4" />
                    Retour à la sécurité
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">Aller au tableau de bord</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountLayout>
  )
}
