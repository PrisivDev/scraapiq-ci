/**
 * Alert engine — évalue les règles d'alerte et déclenche des notifications
 *
 * Métriques supportées :
 *  - quota_usage     : % du quota API utilisé (depuis dashboardKpis → 68% simulé)
 *  - scrape_failures : nombre de jobs de scraping échoués (depuis scraper job-store)
 *  - source_degraded : 1 si au moins une source a successRate < 85, sinon 0
 *  - companies_added : nombre d'entreprises en DB (table Company)
 *  - dedup_rate      : taux de déduplication simulé (17.8%)
 *
 * Conditions : gt | lt | gte | lte | eq | contains
 *
 * Chaque règle a un cooldownMin pour éviter le spam.
 */

import { db } from "@/lib/db"
import type { AlertRule } from "@prisma/client"
import { dashboardKpis, sourcePerformance } from "@/lib/dashboard-data"
import { listJobs } from "@/lib/scraper/job-store"
import {
  sendMultiChannel,
  type NotificationChannel,
  type NotificationPriority,
} from "./engine"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertMetric =
  | "quota_usage"
  | "scrape_failures"
  | "source_degraded"
  | "companies_added"
  | "dedup_rate"

export type AlertCondition =
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "eq"
  | "contains"

export interface MetricResult {
  metric: AlertMetric
  value: number
  label: string
  detail?: string
}

export interface EvaluationResult {
  ruleId: string
  ruleName: string
  metric: AlertMetric
  value: number
  threshold: number
  condition: AlertCondition
  triggered: boolean
  reason?: string
  /** Si triggered mais dans le cooldown */
  inCooldown?: boolean
}

export interface CheckAllResult {
  evaluated: number
  triggered: number
  skipped: number
  results: EvaluationResult[]
}

// ---------------------------------------------------------------------------
// Collecte des métriques (réelles + simulées)
// ---------------------------------------------------------------------------

export async function collectMetric(
  metric: AlertMetric
): Promise<MetricResult> {
  switch (metric) {
    case "quota_usage": {
      // 68% simulé depuis dashboardKpis (hint "68% du quota utilisé")
      const apiKpi = dashboardKpis.find((k) => k.id === "api")
      const value = 68 // simulé
      return {
        metric,
        value,
        label: "Quota API utilisé",
        detail: apiKpi?.hint || "68% du quota utilisé",
      }
    }

    case "scrape_failures": {
      // Compte les jobs en statut "failed" dans le scraper store
      let failed = 0
      try {
        const jobs = listJobs()
        failed = jobs.filter((j) => j.progress.status === "failed").length
      } catch {
        failed = 0
      }
      return {
        metric,
        value: failed,
        label: "Jobs de scraping échoués",
        detail: `${failed} job(s) en échec`,
      }
    }

    case "source_degraded": {
      // 1 si au moins une source a successRate < 85, sinon 0
      const degraded = sourcePerformance.filter((s) => s.success < 85)
      const value = degraded.length > 0 ? 1 : 0
      const names = degraded.map((s) => s.source).join(", ")
      return {
        metric,
        value,
        label: "Source dégradée",
        detail:
          degraded.length > 0
            ? `${degraded.length} source(s) dégradée(s): ${names}`
            : "Toutes les sources sont opérationnelles",
      }
    }

    case "companies_added": {
      // Nombre d'entreprises en DB
      let count = 0
      try {
        count = await db.company.count()
      } catch {
        count = 0
      }
      return {
        metric,
        value: count,
        label: "Entreprises indexées",
        detail: `${count} entreprise(s) en base`,
      }
    }

    case "dedup_rate": {
      // Taux simulé (17.8%)
      const dedupKpi = dashboardKpis.find((k) => k.id === "dedup")
      const value = 17.8
      return {
        metric,
        value,
        label: "Taux de déduplication",
        detail: dedupKpi?.deltaLabel || "17.8% (8 421 doublons fusionnés)",
      }
    }

    default:
      return {
        metric,
        value: 0,
        label: String(metric),
        detail: "Unknown metric",
      }
  }
}

// ---------------------------------------------------------------------------
// Évaluation d'une condition
// ---------------------------------------------------------------------------

export function evaluateCondition(
  value: number,
  condition: AlertCondition,
  threshold: number
): boolean {
  switch (condition) {
    case "gt":
      return value > threshold
    case "lt":
      return value < threshold
    case "gte":
      return value >= threshold
    case "lte":
      return value <= threshold
    case "eq":
      return value === threshold
    case "contains":
      // Pour contains : on compare le détail textuel au seuil (rare sur metrics numériques)
      return value > 0
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Évaluation d'une règle
// ---------------------------------------------------------------------------

export async function evaluateAlert(
  rule: AlertRule
): Promise<EvaluationResult> {
  const metricResult = await collectMetric(rule.metric as AlertMetric)
  const threshold = Number(rule.threshold) || 0
  const condition = rule.condition as AlertCondition
  const triggered = evaluateCondition(metricResult.value, condition, threshold)

  // Vérifier le cooldown
  let inCooldown = false
  if (triggered && rule.lastTriggeredAt) {
    const elapsedMs = Date.now() - rule.lastTriggeredAt.getTime()
    const cooldownMs = (rule.cooldownMin || 0) * 60 * 1000
    if (elapsedMs < cooldownMs) {
      inCooldown = true
    }
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    metric: rule.metric as AlertMetric,
    value: metricResult.value,
    threshold,
    condition,
    triggered: triggered && !inCooldown,
    inCooldown,
    reason: triggered
      ? inCooldown
        ? `Dans le cooldown (${rule.cooldownMin} min) — dernière alerte ${rule.lastTriggeredAt?.toISOString()}`
        : `${metricResult.label} = ${metricResult.value} ${condition} ${threshold} → déclenché`
      : `${metricResult.label} = ${metricResult.value} (condition: ${condition} ${threshold}) — non atteinte`,
  }
}

// ---------------------------------------------------------------------------
// Déclenchement d'une alerte → envoie les notifications sur les canaux
// ---------------------------------------------------------------------------

export async function triggerAlert(
  rule: AlertRule,
  value: number
): Promise<{
  sent: number
  failed: number
  results: Array<{ channel: string; success: boolean; error?: string }>
}> {
  let channels: NotificationChannel[] = ["in_app"]
  try {
    channels = JSON.parse(rule.channels) as NotificationChannel[]
  } catch {
    channels = ["in_app"]
  }

  // Priorité selon la métrique
  const priority: NotificationPriority =
    rule.metric === "quota_usage" || rule.metric === "source_degraded"
      ? "high"
      : "normal"

  const title = `🚨 Alerte : ${rule.name}`
  const body =
    `${rule.description || rule.name}\n` +
    `Métrique: ${rule.metric} = ${value} (${rule.condition} ${rule.threshold})\n` +
    `Déclenchée le ${new Date().toLocaleString("fr-FR")}`

  const multi = await sendMultiChannel({
    channels,
    title,
    body,
    priority,
    payload: {
      alertRuleId: rule.id,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      condition: rule.condition,
      triggeredAt: new Date().toISOString(),
    },
    eventName: `alert.${rule.metric}`,
  })

  // Mettre à jour la règle
  await db.alertRule.update({
    where: { id: rule.id },
    data: {
      lastTriggeredAt: new Date(),
      triggerCount: { increment: 1 },
    },
  })

  return {
    sent: multi.success,
    failed: multi.failed,
    results: multi.results,
  }
}

// ---------------------------------------------------------------------------
// Boucle principale : évalue toutes les règles actives
// ---------------------------------------------------------------------------

export async function checkAllAlerts(): Promise<CheckAllResult> {
  const rules = await db.alertRule.findMany({
    where: { isActive: true },
  })

  const results: EvaluationResult[] = []
  let triggered = 0
  let skipped = 0

  for (const rule of rules) {
    const evalResult = await evaluateAlert(rule)
    results.push(evalResult)

    if (evalResult.triggered) {
      triggered++
      try {
        await triggerAlert(rule, evalResult.value)
      } catch (e) {
        console.error(`[alerts] triggerAlert failed for ${rule.id}:`, e)
      }
    } else if (evalResult.inCooldown) {
      skipped++
    }
  }

  return {
    evaluated: rules.length,
    triggered,
    skipped,
    results,
  }
}
