"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Settings,
  User,
  Bell,
  Palette,
  CreditCard,
  Shield,
  FileText,
  Globe,
  Moon,
  Sun,
  Loader2,
  Building2,
  Save,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "next-themes"
import { toast } from "sonner"

interface MembershipOrg {
  id: string
  name: string
  slug: string
  plan: string
}
interface Profile {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  locale: string | null
  timezone: string | null
  role: string | null
  orgId: string | null
  memberships?: Array<{
    id: string
    role: string
    organization: MembershipOrg
  }>
}

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  ownerId: string
}

const TIMEZONES = [
  { value: "Africa/Abidjan", label: "Africa/Abidjan (GMT+0)" },
  { value: "Africa/Casablanca", label: "Africa/Casablanca (GMT+1)" },
  { value: "Africa/Dakar", label: "Africa/Dakar (GMT+0)" },
  { value: "Africa/Lagos", label: "Africa/Lagos (GMT+1)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (GMT+2)" },
  { value: "Europe/Paris", label: "Europe/Paris (GMT+1)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "America/New_York", label: "America/New_York (GMT-5)" },
  { value: "UTC", label: "UTC" },
]

export function SettingsView() {
  const { theme, setTheme } = useTheme()

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [locale, setLocale] = useState("fr")
  const [timezone, setTimezone] = useState("Africa/Abidjan")
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  // Organization state
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [orgName, setOrgName] = useState("")
  const [loadingOrg, setLoadingOrg] = useState(true)
  const [savingOrg, setSavingOrg] = useState(false)

  const canEditOrg =
    profile?.role === "OWNER" || profile?.role === "ADMIN"

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true)
    try {
      const res = await fetch("/api/me", { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const u: Profile = json.user
      setProfile(u)
      setName(u.name || "")
      setEmail(u.email || "")
      setAvatarUrl(u.avatarUrl || "")
      setLocale(u.locale || "fr")
      setTimezone(u.timezone || "Africa/Abidjan")
    } catch (e) {
      console.error("[settings] fetch /api/me error:", e)
      toast.error("Impossible de charger votre profil")
    } finally {
      setLoadingProfile(false)
    }
  }, [])

  const fetchOrganization = useCallback(async () => {
    setLoadingOrg(true)
    try {
      const res = await fetch("/api/organization", { credentials: "include" })
      if (!res.ok) {
        // 404 is fine — user has no org yet
        if (res.status !== 404) throw new Error(`HTTP ${res.status}`)
        return
      }
      const json = await res.json()
      const org: Organization = json.organization
      setOrganization(org)
      setOrgName(org.name)
    } catch (e) {
      console.error("[settings] fetch /api/organization error:", e)
    } finally {
      setLoadingOrg(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchOrganization()
  }, [fetchProfile, fetchOrganization])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          avatarUrl: avatarUrl.trim() || null,
          locale,
          timezone,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `Erreur ${res.status}`
        toast.error(`Erreur : ${msg}`)
        return
      }
      // Update local state from server response
      const u: Profile = json.user
      if (u) {
        setProfile((prev) =>
          prev ? { ...prev, ...u } : prev
        )
        setName(u.name || name)
        setEmail(u.email || email)
        setAvatarUrl(u.avatarUrl || "")
        setLocale(u.locale || locale)
        setTimezone(u.timezone || timezone)
      }
      toast.success("Profil mis à jour")
    } catch (e) {
      console.error("[settings] save profile error:", e)
      toast.error("Erreur réseau, réessayez")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveOrg = async () => {
    if (!organization) return
    setSavingOrg(true)
    try {
      const res = await fetch("/api/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: orgName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `Erreur ${res.status}`
        toast.error(`Erreur : ${msg}`)
        return
      }
      const org: Organization = json.organization
      setOrganization(org)
      setOrgName(org.name)
      toast.success("Organisation mise à jour")
    } catch (e) {
      console.error("[settings] save org error:", e)
      toast.error("Erreur réseau, réessayez")
    } finally {
      setSavingOrg(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gérez votre profil, préférences, facturation et sécurité
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profil */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Profil
            </CardTitle>
            {profile?.role && (
              <CardDescription className="text-xs">
                Rôle : <Badge variant="outline" className="text-[10px]">{profile.role}</Badge>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingProfile ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nom complet</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9"
                      placeholder="Votre nom"
                      disabled={savingProfile}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9"
                      placeholder="vous@exemple.ci"
                      disabled={savingProfile}
                      type="email"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL de l&apos;avatar</Label>
                  <Input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="h-9"
                    placeholder="https://..."
                    disabled={savingProfile}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Langue
                    </Label>
                    <Select
                      value={locale}
                      onValueChange={setLocale}
                      disabled={savingProfile}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fuseau horaire</Label>
                    <Select
                      value={timezone}
                      onValueChange={setTimezone}
                      disabled={savingProfile}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveProfile}
                  disabled={savingProfile || loadingProfile}
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Organisation (OWNER / ADMIN only) */}
        {canEditOrg && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Organisation
              </CardTitle>
              {organization && (
                <CardDescription className="text-xs">
                  Slug : <code className="bg-muted px-1 rounded">{organization.slug}</code>
                  {" · "}
                  Plan : <Badge variant="outline" className="text-[10px]">{organization.plan}</Badge>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingOrg ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : organization ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nom de l&apos;organisation</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="h-9"
                      placeholder="Mon organisation"
                      disabled={savingOrg}
                      maxLength={100}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Le slug sera régénéré automatiquement à partir du nom.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSaveOrg}
                    disabled={savingOrg || orgName.trim() === organization.name}
                  >
                    {savingOrg ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement…
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer l&apos;organisation
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune organisation associée.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Apparence */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              Apparence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Thème</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${theme === "light" ? "border-primary bg-primary/5" : "hover:bg-accent/40"}`}
                >
                  <Sun className="h-4 w-4" />
                  Clair
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${theme === "dark" ? "border-primary bg-primary/5" : "hover:bg-accent/40"}`}
                >
                  <Moon className="h-4 w-4" />
                  Sombre
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Densité tableau</Label>
                <p className="text-[11px] text-muted-foreground">Compact les lignes</p>
              </div>
              <Switch defaultChecked={false} onCheckedChange={() => toast.info("Densité modifiée")} />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Job terminé", desc: "Notification quand un job se termine", on: true },
              { label: "Quota atteint", desc: "Alerte à 80% et 100% du quota", on: true },
              { label: "Source dégradée", desc: "Quand une source tombe en panne", on: true },
              { label: "Résumé hebdomadaire", desc: "Email chaque lundi à 8h", on: false },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{n.label}</p>
                  <p className="text-[11px] text-muted-foreground">{n.desc}</p>
                </div>
                <Switch
                  defaultChecked={n.on}
                  onCheckedChange={() =>
                    toast.info(`${n.label} : ${n.on ? "désactivé" : "activé"}`)
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Facturation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Facturation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Plan Pro</p>
                  <p className="text-[11px] text-muted-foreground">85 000 FCFA / mois</p>
                </div>
                <Badge className="bg-primary/10 text-primary">Actif</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Renouvellement le 15 janv. 2027</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info("Voir les factures")}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                Factures
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info("Changer de plan")}>
                Changer de plan
              </Button>
            </div>
            <div>
              <Label className="text-xs">Méthode de paiement</Label>
              <div className="flex items-center gap-2 mt-1.5 rounded-lg border p-2.5">
                <span className="text-lg">📱</span>
                <div className="flex-1">
                  <p className="text-xs font-medium">Orange Money</p>
                  <p className="text-[10px] text-muted-foreground">+225 07 08 12 34 56</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs">Modifier</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sécurité */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Authentification 2FA</p>
                <p className="text-[11px] text-muted-foreground">Sécurisez votre compte avec TOTP</p>
              </div>
              <Switch onCheckedChange={(c) => toast.info(c ? "Activer 2FA" : "Désactiver 2FA")} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Alertes de connexion</p>
                <p className="text-[11px] text-muted-foreground">Email à chaque nouvelle connexion</p>
              </div>
              <Switch defaultChecked onCheckedChange={() => toast.info("Préférence modifiée")} />
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => toast.info("Voir les sessions actives")}>
              Gérer les sessions actives
            </Button>
          </CardContent>
        </Card>

        {/* Conformité */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Conformité & Données
            </CardTitle>
            <CardDescription className="text-xs">Conforme APIPD · Loi n°2013-450 Côte d&apos;Ivoire</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => toast.info("Téléchargement de vos données")}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Exporter mes données (RGPD)
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => toast.info("Demande d'effacement")}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Demander l&apos;effacement de mon compte
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start text-destructive" onClick={() => toast.warning("Action irréversible")}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Supprimer mon compte
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
