"use client"

import { useState } from "react"
import { Rocket, Search, MapPin, Tag, Database, Sparkles, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { communes, sectors, cities } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface NewJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const sourceOptions = [
  { id: "google", label: "Google Maps", icon: "🗺️" },
  { id: "rccm", label: "RCCM Côte d'Ivoire", icon: "📋" },
  { id: "annuaire", label: "Annuaire.ci", icon: "📖" },
  { id: "pagesjaunes", label: "Pages Jaunes CI", icon: "📒" },
  { id: "facebook", label: "Facebook Pages", icon: "👥" },
  { id: "linkedin", label: "LinkedIn Entreprises", icon: "💼" },
]

export function NewJobDialog({ open, onOpenChange }: NewJobDialogProps) {
  const [keyword, setKeyword] = useState("")
  const [city, setCity] = useState("Abidjan")
  const [commune, setCommune] = useState("Cocody")
  const [sector, setSector] = useState("Restauration")
  const [sources, setSources] = useState<string[]>(["google", "facebook"])
  const [phase, setPhase] = useState<"form" | "launching" | "done">("form")
  const [progress, setProgress] = useState(0)

  const toggleSource = (id: string) => {
    setSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleLaunch = () => {
    if (!keyword.trim()) {
      toast.error("Veuillez saisir au moins un mot-clé")
      return
    }
    if (sources.length === 0) {
      toast.error("Sélectionnez au moins une source")
      return
    }
    setPhase("launching")
    setProgress(0)
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setPhase("done")
          return 100
        }
        return p + 8
      })
    }, 120)
  }

  const handleReset = () => {
    setPhase("form")
    setProgress(0)
    setKeyword("")
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && phase === "form") onOpenChange(false)
        else if (!v && phase === "done") handleReset()
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {phase === "form" && "Nouveau job de scraping"}
                {phase === "launching" && "Lancement en cours…"}
                {phase === "done" && "Job lancé avec succès !"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {phase === "form" &&
                  "Configurez votre recherche intelligente. Le moteur IA s'occupera du reste."}
                {phase === "launching" &&
                  "Découpage en sous-tâches, dispatch vers les workers…"}
                {phase === "done" &&
                  "Votre job a été mis en file d'attente. Vous serez notifié à la fin."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4">
            {/* Keyword */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Search className="h-3 w-3" /> Mots-clés de recherche *
              </Label>
              <Input
                placeholder="ex: restaurant, pharmacie, agence immobilière…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Le moteur IA va étendre automatiquement ces mots-clés (synonymes, traductions).
              </p>
            </div>

            {/* Zone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Ville
                </Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Commune
                </Label>
                <Select value={commune} onValueChange={setCommune}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {communes.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sector */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Secteur d'activité
              </Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sources */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Database className="h-3 w-3" /> Sources à interroger ({sources.length})
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {sourceOptions.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors",
                      sources.includes(s.id)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent/40"
                    )}
                  >
                    <Checkbox
                      checked={sources.includes(s.id)}
                      onCheckedChange={() => toggleSource(s.id)}
                    />
                    <span className="text-base">{s.icon}</span>
                    <span className="text-xs font-medium">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* IA options */}
            <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-accent/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Options IA activées</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Déduplication
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Enrichissement
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Géocodage
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Normalisation tél
                </Badge>
              </div>
            </div>
          </div>
        )}

        {phase === "launching" && (
          <div className="space-y-4 py-4">
            <Progress value={progress} className="h-2" />
            <div className="space-y-2">
              {[
                { label: "Validation des critères", done: progress > 10 },
                { label: "Découpage en sous-tâches par source", done: progress > 30 },
                { label: "Vérification robots.txt", done: progress > 50 },
                { label: "Dispatch vers les workers", done: progress > 70 },
                { label: "Mise en file Redis", done: progress > 90 },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-2 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
                  )}
                  <span className={step.done ? "" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="font-semibold">Job #0092 créé</p>
              <p className="text-sm text-muted-foreground mt-1">
                {sources.length} worker(s) lancé(s) · estimation ~5 min
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mot-clé</span>
                <span className="font-medium">{keyword}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zone</span>
                <span className="font-medium">{commune}, {city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sources</span>
                <span className="font-medium">{sources.length} sélectionnée(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge className="text-[10px] gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                  En cours
                </Badge>
              </div>
            </div>
          </div>
        )}

        {phase === "form" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleLaunch} className="gap-2">
              <Rocket className="h-4 w-4" />
              Lancer le job
            </Button>
          </DialogFooter>
        )}

        {phase === "done" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleReset}>
              Fermer
            </Button>
            <Button onClick={handleReset} className="gap-2">
              <Rocket className="h-4 w-4" />
              Nouveau job
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
