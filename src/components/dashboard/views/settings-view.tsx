"use client"

import { Settings, User, Bell, Palette, CreditCard, Shield, FileText, Globe, Moon, Sun } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

export function SettingsView() {
  const { theme, setTheme } = useTheme()

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
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom complet</Label>
                <Input defaultValue="Adama Koné" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input defaultValue="adama@agribusiness.ci" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Langue</Label>
                <Select defaultValue="fr">
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fuseau horaire</Label>
                <Select defaultValue="abidjan">
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abidjan">Africa/Abidjan (GMT+0)</SelectItem>
                    <SelectItem value="paris">Europe/Paris (GMT+1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={() => toast.success("Profil mis à jour")}>
              Enregistrer
            </Button>
          </CardContent>
        </Card>

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
                <Switch defaultChecked={n.on} onCheckedChange={() => toast.info(`${n.label} : ${n.on ? "désactivé" : "activé"}`)} />
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
            <CardDescription className="text-xs">Conforme APIPD · Loi n°2013-450 Côte d'Ivoire</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => toast.info("Téléchargement de vos données")}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Exporter mes données (RGPD)
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => toast.info("Demande d'effacement")}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Demander l'effacement de mon compte
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
