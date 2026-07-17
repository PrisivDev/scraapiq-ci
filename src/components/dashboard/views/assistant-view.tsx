"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  Sparkles, Send, MapPin, Building2, Phone, Mail, Globe, Star,
  Loader2, Brain, Zap, MessageSquare, User, ArrowRight, Lightbulb,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  results?: Array<{
    id: string
    name: string
    sector: string
    commune: string
    city: string
    phone?: string
    email?: string
    website?: string
    address?: string
    rating?: number
    reviewCount?: number
    status?: string
    score: number
  }>
  analysis?: {
    sector?: string
    city?: string
    commune?: string
    hasWebsite?: boolean
    hasPhone?: boolean
    hasEmail?: boolean
    minRating?: number
    intent: string
    confidence: number
    summary: string
  }
  total?: number
  took?: number
  suggestions?: string[]
}

const exampleQueries = [
  "Trouve les hôtels de Marcory",
  "Trouve les cliniques privées de Bouaké",
  "Trouve toutes les entreprises BTP ayant un site web",
  "Trouve les restaurants avec téléphone à Cocody",
  "Combien d'entreprises à Yopougon ?",
  "Trouve les pharmacies notées au moins 4 étoiles",
]

export function AssistantView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll vers le bas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus initial
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: text.trim() }),
      })

      if (!res.ok) throw new Error("Failed")
      const data = await res.json()

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: data.naturalResponse,
        timestamp: new Date().toISOString(),
        results: data.results,
        analysis: data.analysis,
        total: data.total,
        took: data.took,
        suggestions: data.suggestions,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      toast.error("Erreur de l'assistant IA")
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [loading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Assistant IA
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Posez vos questions en langage naturel — l'IA traduit automatiquement en recherche
        </p>
      </div>

      {/* Chat container */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Messages */}
          <div
            ref={scrollRef}
            className="max-h-[500px] min-h-[400px] overflow-y-auto p-4 space-y-4"
          >
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                  <Brain className="h-8 w-8" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Assistant IA ScrapIQ</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Je comprends le langage naturel et je recherche automatiquement
                  dans notre base de {">"}76 entreprises ivoiriennes.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
                  {exampleQueries.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-left hover:bg-accent transition-colors group"
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="flex-1">{q}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages list */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSuggestionClick={sendMessage} />
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Brain className="h-3.5 w-3.5" />
                    L'IA analyse votre requête…
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez votre question… (ex: Trouve les hôtels de Marcory)"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>
              <Button
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MessageBubble({
  message,
  onSuggestionClick,
}: {
  message: ChatMessage
  onSuggestionClick: (text: string) => void
}) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
      </div>

      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        {/* Message content */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 max-w-[85%]",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.took && (
            <p className="text-[10px] mt-1 opacity-60 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" />
              {message.took}ms
            </p>
          )}
        </div>

        {/* Analysis badge (IA only) */}
        {message.analysis && !isUser && (
          <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
            {message.analysis.sector && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
                <Building2 className="h-2.5 w-2.5" />
                {message.analysis.sector}
              </Badge>
            )}
            {message.analysis.commune && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {message.analysis.commune}
              </Badge>
            )}
            {message.analysis.city && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {message.analysis.city}
              </Badge>
            )}
            {message.analysis.hasWebsite && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600">
                <Globe className="h-2.5 w-2.5" />
                Site web
              </Badge>
            )}
            {message.analysis.hasPhone && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600">
                <Phone className="h-2.5 w-2.5" />
                Téléphone
              </Badge>
            )}
            {message.analysis.minRating && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-600">
                <Star className="h-2.5 w-2.5" />
                ≥ {message.analysis.minRating}★
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {Math.round(message.analysis.confidence * 100)}% confiance
            </Badge>
          </div>
        )}

        {/* Results */}
        {message.results && message.results.length > 0 && !isUser && (
          <div className="mt-3 space-y-2 max-w-[85%]">
            {message.results.slice(0, 5).map((r) => (
              <ResultCard key={r.id} result={r} />
            ))}
            {message.total && message.total > 5 && (
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                + {message.total - 5} autre(s) résultat(s)
              </p>
            )}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && !isUser && (
          <div className="mt-3 max-w-[85%]">
            <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
              <Lightbulb className="h-2.5 w-2.5" />
              Suggestions :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick(s)}
                  className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultCard({ result }: { result: ChatMessage["results"] extends (infer T)[] ? T : never }) {
  return (
    <div className="rounded-lg border p-2.5 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
          {result.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{result.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">{result.sector}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {result.commune}, {result.city}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {result.phone && (
              <span className="text-[10px] flex items-center gap-0.5">
                <Phone className="h-2.5 w-2.5 text-muted-foreground" />
                {result.phone}
              </span>
            )}
            {result.website && (
              <span className="text-[10px] flex items-center gap-0.5 text-emerald-600">
                <Globe className="h-2.5 w-2.5" />
                Site web
              </span>
            )}
            {result.email && (
              <span className="text-[10px] flex items-center gap-0.5">
                <Mail className="h-2.5 w-2.5 text-muted-foreground" />
                Email
              </span>
            )}
            {result.rating && (
              <span className="text-[10px] flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {result.rating}
              </span>
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-[9px] shrink-0">
          {result.score.toFixed(1)}
        </Badge>
      </div>
    </div>
  )
}
