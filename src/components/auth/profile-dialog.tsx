"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, User as UserIcon, Save } from "lucide-react"
import { toast } from "sonner"

interface ProfileData {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  locale: string
  timezone: string
}

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

/**
 * Modal "Mon profil" — édition du profil utilisateur courant.
 *
 * - Fetch /api/me au montage pour pré-remplir les champs.
 * - Save via PUT /api/me (name, email, locale, timezone, avatarUrl).
 * - Toast succès/erreur + callback onSaved (pour rafraîchir le header).
 */
export function ProfileDialog({ open, onOpenChange, onSaved }: ProfileDialogProps) {
  const router = useRouter()
  const [profile, setProfile] = React.useState<ProfileData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Champs éditables
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [avatarUrl, setAvatarUrl] = React.useState("")
  const [locale, setLocale] = React.useState("fr")
  const [timezone, setTimezone] = React.useState("Africa/Abidjan")

  React.useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setErrors({})
    ;(async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        if (!active || !data?.user) return
        const u = data.user
        setProfile({
          id: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
          locale: u.locale || "fr",
          timezone: u.timezone || "Africa/Abidjan",
        })
        setName(u.name || "")
        setEmail(u.email || "")
        setAvatarUrl(u.avatarUrl || "")
        setLocale(u.locale || "fr")
        setTimezone(u.timezone || "Africa/Abidjan")
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [open])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = "Le nom est requis"
    if (name.trim().length > 100) e.name = "100 caractères max"
    if (!email.trim()) e.email = "L'email est requis"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Format email invalide"
    if (avatarUrl && !/^https?:\/\/.+/.test(avatarUrl)) e.avatarUrl = "URL invalide (doit commencer par http:// ou https://)"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        locale,
        timezone,
      }
      if (avatarUrl.trim()) body.avatarUrl = avatarUrl.trim()

      const res = await fetch("/api/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409) {
          setErrors({ email: "Cet email est déjà utilisé" })
          return
        }
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      toast.success("Profil mis à jour", {
        description: "Vos modifications ont été enregistrées.",
      })
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast.error("Erreur", {
        description: err instanceof Error ? err.message : "Échec de la mise à jour",
      })
    } finally {
      setSaving(false)
    }
  }

  const initials = React.useMemo(() => {
    const n = name || email || "U"
    const parts = n.split(/[\s@._-]+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return n.slice(0, 2).toUpperCase()
  }, [name, email])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[100vh] sm:h-auto h-full sm:max-h-[90vh] flex flex-col overflow-hidden rounded-none sm:rounded-lg">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserIcon className="h-5 w-5 text-primary" />
            Mon profil
          </DialogTitle>
          <DialogDescription className="text-xs">
            Modifiez vos informations personnelles. Enregistré via PUT /api/me.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Avatar preview */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40">
                <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{name || "Sans nom"}</p>
                  <p className="text-sm text-muted-foreground truncate">{email}</p>
                  {profile && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      ID : <code className="font-mono">{profile.id.slice(-8)}</code>
                    </p>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs">
                  Nom complet
                </Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="h-9"
                  disabled={saving}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="text-xs">
                  Email professionnel
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@entreprise.ci"
                  className="h-9"
                  disabled={saving}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              {/* Avatar URL */}
              <div className="space-y-1.5">
                <Label htmlFor="profile-avatar" className="text-xs">
                  URL de l&apos;avatar <span className="text-muted-foreground">(optionnel)</span>
                </Label>
                <Input
                  id="profile-avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://exemple.com/avatar.png"
                  className="h-9"
                  disabled={saving}
                />
                {errors.avatarUrl && (
                  <p className="text-xs text-destructive">{errors.avatarUrl}</p>
                )}
              </div>

              {/* Locale + Timezone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Langue</Label>
                  <Select value={locale} onValueChange={setLocale} disabled={saving}>
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
                  <Select value={timezone} onValueChange={setTimezone} disabled={saving}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Africa/Abidjan">Africa/Abidjan (GMT+0)</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris (GMT+1)</SelectItem>
                      <SelectItem value="Africa/Dakar">Africa/Dakar (GMT+0)</SelectItem>
                      <SelectItem value="Africa/Bamako">Africa/Bamako (GMT+0)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t sticky bottom-0 bg-background gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || loading}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
