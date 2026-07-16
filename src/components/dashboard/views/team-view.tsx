"use client"

import { Users, UserPlus, Building2, Crown, Shield, UserCog, User, Eye, MoreVertical, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"

interface TeamMember {
  id: string
  name: string
  email: string
  role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER"
  status: "active" | "pending" | "disabled"
  lastActive: string
}

const team: TeamMember[] = [
  { id: "u1", name: "Adama Koné", email: "adama@agribusiness.ci", role: "OWNER", status: "active", lastActive: "En ligne" },
  { id: "u2", name: "Mariam Traoré", email: "mariam@agribusiness.ci", role: "ADMIN", status: "active", lastActive: "Il y a 5 min" },
  { id: "u3", name: "Sekou Bamba", email: "sekou@agribusiness.ci", role: "MANAGER", status: "active", lastActive: "Il y a 1 h" },
  { id: "u4", name: "Yasmine Koné", email: "yasmine@agribusiness.ci", role: "AGENT", status: "pending", lastActive: "Invitation envoyée" },
  { id: "u5", name: "Ibrahim Cissé", email: "ibrahim@agribusiness.ci", role: "VIEWER", status: "disabled", lastActive: "Il y a 3 j" },
]

const roleMeta = {
  OWNER: { label: "Owner", icon: Crown, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  ADMIN: { label: "Admin", icon: Shield, className: "bg-primary/10 text-primary" },
  MANAGER: { label: "Manager", icon: UserCog, className: "bg-accent/20 text-accent-foreground" },
  AGENT: { label: "Agent", icon: User, className: "bg-muted text-muted-foreground" },
  VIEWER: { label: "Viewer", icon: Eye, className: "bg-muted text-muted-foreground" },
}

const statusMeta = {
  active: { label: "Actif", className: "bg-primary/10 text-primary" },
  pending: { label: "En attente", className: "bg-accent/20 text-accent-foreground" },
  disabled: { label: "Désactivé", className: "bg-muted text-muted-foreground" },
}

export function TeamView() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Équipe & Tenants
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {team.length} membres · {team.filter((m) => m.status === "active").length} actifs
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Ouverture de la modale d'invitation")}>
          <UserPlus className="h-4 w-4" />
          Inviter un membre
        </Button>
      </div>

      {/* Organisation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">AgriBusiness CI</p>
              <p className="text-xs text-muted-foreground">Plan Pro · 5 / 20 membres · Créée le 12 oct. 2026</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info("Paramètres org")}>
              Paramètres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Membres */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Membres</CardTitle>
          <CardDescription className="text-xs">Gérez les rôles et les accès</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {team.map((m) => {
              const rMeta = roleMeta[m.role]
              const RoleIcon = rMeta.icon
              const sMeta = statusMeta[m.status]
              return (
                <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <Badge variant="outline" className={`text-[10px] gap-1 ${rMeta.className}`}>
                        <RoleIcon className="h-2.5 w-2.5" />
                        {rMeta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${sMeta.className}`}>
                      {sMeta.label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground w-24 text-right">{m.lastActive}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info(`Menu actions pour ${m.name}`)}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Matrice RBAC résumée */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Matrice des rôles</CardTitle>
          <CardDescription className="text-xs">Permissions par rôle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Permission</th>
                  {Object.entries(roleMeta).map(([key, m]) => (
                    <th key={key} className="text-center py-2 px-2 font-medium text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <m.icon className="h-3 w-3" />
                        {m.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Voir entreprises", perms: [true, true, true, true, true] },
                  { label: "Créer/modifier entreprises", perms: [true, true, true, true, false] },
                  { label: "Supprimer entreprises", perms: [true, true, false, false, false] },
                  { label: "Exporter", perms: [true, true, true, true, false] },
                  { label: "Lancer jobs scraping", perms: [true, true, true, true, false] },
                  { label: "Annuler/supprimer jobs", perms: [true, true, true, false, false] },
                  { label: "Gérer sources", perms: [true, true, false, false, false] },
                  { label: "Inviter membres", perms: [true, true, true, false, false] },
                  { label: "Changer rôles", perms: [true, true, false, false, false] },
                  { label: "Gérer facturation", perms: [true, false, false, false, false] },
                  { label: "Voir audit logs", perms: [true, true, true, false, false] },
                  { label: "Gérer clés API", perms: [true, true, false, false, false] },
                ].map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{row.label}</td>
                    {row.perms.map((p, i) => (
                      <td key={i} className="text-center py-2 px-2">
                        {p ? (
                          <span className="text-primary">✓</span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
