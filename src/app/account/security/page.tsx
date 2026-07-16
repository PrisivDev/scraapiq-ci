"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  KeyRound,
  Smartphone,
  Mail,
  Building2,
  Clock,
  LogIn,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AccountLayout } from "@/components/auth/auth-layout"

interface CurrentUser {
  id: string
  email: string
  name?: string | null
  avatarUrl?: string | null
  role?: string
  twoFactorEnabled?: boolean
  oauthProviders?: string[]
  lastLoginAt?: string | null
  memberships?: Array<{
    id: string
    role: string
    organization: { id: string; name: string; slug: string; plan: string }
    workspace: { id: string; name: string; slug: string }
  }>
}

function formatDate(iso?: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export default function SecurityPage() {
  const router = useRouter()
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Disable 2FA dialog state
  const [disable2faOpen, setDisable2faOpen] = React.useState(false)
  const [disablePassword, setDisablePassword] = React.useState("")
  const [disableLoading, setDisableLoading] = React.useState(false)

  // Change password (placeholder)
  const [currentPwd, setCurrentPwd] = React.useState("")
  const [newPwd, setNewPwd] = React.useState("")
  const [confirmPwd, setConfirmPwd] = React.useState("")
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [pwdLoading, setPwdLoading] = React.useState(false)

  const loadUser = React.useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" })
      if (res.status === 401) {
        router.replace("/auth/login?redirect=/account/security")
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setUser(data.user)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [router])

  React.useEffect(() => {
    loadUser()
  }, [loadUser])

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setDisableLoading(true)
    try {
      const res = await fetch("/api/twofa/disable", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success("2FA désactivé", {
          description: "Votre compte n'est plus protégé par 2FA.",
        })
        setDisable2faOpen(false)
        setDisablePassword("")
        loadUser()
        return
      }
      toast.error(data.error || "Échec de la désactivation")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDisableLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPwd !== confirmPwd) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    if (newPwd.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères")
      return
    }
    setPwdLoading(true)
    // NOTE: endpoint not implemented yet — placeholder UI.
    setTimeout(() => {
      setPwdLoading(false)
      toast.info("Modification de mot de passe", {
        description: "Cette fonctionnalité sera disponible prochainement.",
      })
      setCurrentPwd("")
      setNewPwd("")
      setConfirmPwd("")
    }, 800)
  }

  if (loading) {
    return (
      <AccountLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de votre espace sécurité…</p>
        </div>
      </AccountLayout>
    )
  }

  if (!user) {
    return (
      <AccountLayout>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Impossible de charger vos informations</AlertTitle>
          <AlertDescription>
            Veuillez vous reconnecter.{" "}
            <Link href="/auth/login" className="underline">
              Aller à la connexion
            </Link>
          </AlertDescription>
        </Alert>
      </AccountLayout>
    )
  }

  const oauthProviders = user.oauthProviders || []
  const hasGoogle = oauthProviders.includes("google")
  const hasMicrosoft = oauthProviders.includes("microsoft")

  return (
    <AccountLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Sécurité du compte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez l'authentification, les méthodes de connexion et la protection de votre compte.
          </p>
        </div>

        {/* Account summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email
              </span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <KeyRound className="h-4 w-4" />
                Rôle
              </span>
              <Badge variant="secondary">{user.role || "VIEWER"}</Badge>
            </div>
            {user.memberships?.[0] && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Organisation
                </span>
                <span className="font-medium">
                  {user.memberships[0].organization.name}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <LogIn className="h-4 w-4" />
                Dernière connexion
              </span>
              <span className="font-medium">{formatDate(user.lastLoginAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 2FA status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Authentification à deux facteurs (2FA)
            </CardTitle>
            <CardDescription>
              Ajoutez une couche supplémentaire de sécurité en exigeant un code temporel à chaque connexion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    user.twoFactorEnabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                  }`}
                >
                  {user.twoFactorEnabled ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {user.twoFactorEnabled ? "2FA activé" : "2FA non activé"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.twoFactorEnabled
                      ? "Votre compte est protégé par une double authentification."
                      : "Activez le 2FA pour renforcer la sécurité de votre compte."}
                  </p>
                </div>
              </div>

              {user.twoFactorEnabled ? (
                <Button
                  variant="outline"
                  onClick={() => setDisable2faOpen(true)}
                  className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  Désactiver 2FA
                </Button>
              ) : (
                <Button asChild className="gap-2">
                  <Link href="/auth/setup-2fa">
                    Activer 2FA
                  </Link>
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Statut global</p>
                <p className="text-xs text-muted-foreground">
                  Recevoir une notification lors des connexions suspectes.
                </p>
              </div>
              <Switch defaultChecked disabled aria-label="Notifications de sécurité" />
            </div>
          </CardContent>
        </Card>

        {/* OAuth providers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" />
              Méthodes de connexion OAuth
            </CardTitle>
            <CardDescription>
              Connectez votre compte à des fournisseurs d'identité externes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <OAuthProviderRow
              name="Google"
              linked={hasGoogle}
              connectHref="/api/oauth/google"
            />
            <OAuthProviderRow
              name="Microsoft"
              linked={hasMicrosoft}
              connectHref="/api/oauth/microsoft"
            />
          </CardContent>
        </Card>

        {/* Password change (placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Changer de mot de passe
            </CardTitle>
            <CardDescription>
              Choisissez un mot de passe robuste et unique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-3" noValidate>
              <div className="space-y-2">
                <Label htmlFor="current-pwd">Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    id="current-pwd"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    disabled={pwdLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                    aria-label="Afficher"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="new-pwd"
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      disabled={pwdLoading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                      aria-label="Afficher"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pwd">Confirmer</Label>
                  <Input
                    id="confirm-pwd"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    disabled={pwdLoading}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={pwdLoading} variant="outline" className="gap-2">
                  {pwdLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Mettre à jour
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Fonctionnalité en cours de finalisation côté serveur.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button asChild variant="outline" className="justify-start gap-2 h-auto py-4">
            <Link href="/account/sessions">
              <Smartphone className="h-4 w-4 text-primary" />
              <div className="text-left">
                <div className="text-sm font-medium">Sessions actives</div>
                <div className="text-xs text-muted-foreground">Gérez vos appareils connectés</div>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start gap-2 h-auto py-4">
            <Link href="/account/permissions">
              <KeyRound className="h-4 w-4 text-primary" />
              <div className="text-left">
                <div className="text-sm font-medium">Permissions</div>
                <div className="text-xs text-muted-foreground">Voir vos droits d'accès</div>
              </div>
            </Link>
          </Button>
        </div>
      </div>

      {/* Disable 2FA dialog */}
      <Dialog open={disable2faOpen} onOpenChange={setDisable2faOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Désactiver le 2FA ?
            </DialogTitle>
            <DialogDescription>
              Cette action réduira la sécurité de votre compte. Confirmez avec votre mot de
              passe pour continuer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDisable2FA} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="disable-pwd">Votre mot de passe</Label>
              <Input
                id="disable-pwd"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDisable2faOpen(false)
                  setDisablePassword("")
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={disableLoading || !disablePassword}
                className="gap-2"
              >
                {disableLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Désactiver le 2FA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AccountLayout>
  )
}

function OAuthProviderRow({
  name,
  linked,
  connectHref,
}: {
  name: string
  linked: boolean
  connectHref: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
          {name === "Google" ? (
            <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 23 23" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" fill="#F25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
              <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {linked ? "Compte lié" : "Non connecté"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {linked ? (
          <>
            <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-400">
              Lié
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="text-xs text-muted-foreground"
              title="Bientôt disponible"
            >
              Délier
            </Button>
          </>
        ) : (
          <Button asChild size="sm" variant="outline">
            <a href={connectHref}>Connecter</a>
          </Button>
        )}
      </div>
    </div>
  )
}
