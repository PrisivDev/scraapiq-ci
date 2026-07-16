"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface PasswordChecks {
  length: boolean
  upper: boolean
  lower: boolean
  digit: boolean
  special: boolean
}

export function evaluatePassword(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
}

function scoreFromChecks(checks: PasswordChecks): number {
  const passed = Object.values(checks).filter(Boolean).length
  return passed // 0..5
}

const LABELS: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "Au moins 8 caractères" },
  { key: "upper", label: "Une majuscule" },
  { key: "lower", label: "Une minuscule" },
  { key: "digit", label: "Un chiffre" },
  { key: "special", label: "Un caractère spécial" },
]

interface PasswordStrengthProps {
  password: string
  className?: string
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const checks = React.useMemo(() => evaluatePassword(password), [password])
  const score = scoreFromChecks(checks)

  if (!password) return null

  const strengthLabel =
    score <= 1 ? "Très faible" : score === 2 ? "Faible" : score === 3 ? "Moyen" : score === 4 ? "Bon" : "Excellent"
  const barColor =
    score <= 1
      ? "bg-destructive"
      : score === 2
      ? "bg-orange-500"
      : score === 3
      ? "bg-amber-500"
      : score === 4
      ? "bg-emerald-500"
      : "bg-emerald-600"

  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/30 p-3", className)}>
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-full flex-1 rounded-full transition-colors",
                i < score ? barColor : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            score <= 1
              ? "text-destructive"
              : score <= 3
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          )}
        >
          {strengthLabel}
        </span>
      </div>

      {/* Checklist */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
        {LABELS.map((item) => {
          const ok = checks[item.key]
          return (
            <li key={item.key} className="flex items-center gap-1.5 text-xs">
              {ok ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={ok ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
