"use client"

import {
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  FileText,
  Users,
  Calendar,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Database,
  Copy,
  ExternalLink,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type Company } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface CompanyDetailDialogProps {
  company: Company | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompanyDetailDialog({
  company,
  open,
  onOpenChange,
}: CompanyDetailDialogProps) {
  if (!company) return null

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value)
    toast.success(`${label} copié`)
  }

  const statusMeta = {
    verified: { label: "Vérifié", icon: CheckCircle2, className: "bg-primary/10 text-primary border-primary/20" },
    enriched: { label: "Enrichi", icon: Sparkles, className: "bg-accent/20 text-accent-foreground border-accent/30" },
    partial: { label: "Partiel", icon: AlertCircle, className: "bg-muted text-muted-foreground border-border" },
    duplicate: { label: "Doublon", icon: Copy, className: "bg-destructive/10 text-destructive border-destructive/20" },
  }
  const meta = statusMeta[company.status]
  const StatusIcon = meta.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto w-full sm:max-w-3xl flex flex-col overflow-hidden rounded-none sm:rounded-lg">
        <DialogHeader className="px-4 md:px-6 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl truncate">{company.name}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                <span>{company.sector}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {company.commune}, {company.city}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Status & confidence */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("gap-1.5", meta.className)}>
              <StatusIcon className="h-3 w-3" />
              {meta.label}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              Confiance IA : {company.confidence}%
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Users className="h-3 w-3" />
              {company.employees} employés
            </Badge>
          </div>

          {/* Coordonnées */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                Coordonnées publiques
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{company.phone}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copy(company.phone, "Téléphone")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {company.email && (
                  <div className="flex items-center justify-between rounded-lg border p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{company.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copy(company.email, "Email")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {company.website && (
                  <div className="flex items-center justify-between rounded-lg border p-2.5 sm:col-span-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{company.website}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Informations légales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Informations légales
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">RCCM</p>
                  <p className="text-sm font-medium font-mono">{company.rccm}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Effectif</p>
                  <p className="text-sm font-medium">{company.employees} employés</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sources & traçabilité */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Sources & traçabilité
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 mb-3">
                {company.sources.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1.5">
                    <Database className="h-3 w-3" />
                    {s}
                  </Badge>
                ))}
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Première indexation
                  </span>
                  <span className="font-medium">{company.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dernière mise à jour IA</span>
                  <span className="font-medium">Il y a 2 jours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Score de fusion</span>
                  <span className="font-medium text-primary">{company.confidence}/100</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline IA */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Pipeline de traitement IA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                {[
                  { label: "Scrapé", done: true },
                  { label: "Normalisé", done: true },
                  { label: "Fusionné", done: true },
                  { label: "Dédupliqué", done: true },
                  { label: "Enrichi", done: company.status !== "partial" },
                  { label: "Géocodé", done: true },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-1">
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1",
                        step.done
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {step.label}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="h-px w-3 bg-border" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="border-t bg-background px-4 md:px-6 py-3 sticky bottom-0 flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Voir la fiche complète
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
