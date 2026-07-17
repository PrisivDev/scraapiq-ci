/**
 * Seed — alertes et rapports par défaut
 *
 * Appelé au premier GET sur /api/v1/alerts (idempotent).
 */

import { db } from "@/lib/db"
import { createScheduledReport } from "./reports"
import type { NotificationChannel } from "./providers"

const DEFAULT_ALERTS = [
  {
    name: "Quota API > 80%",
    description:
      "Déclenché quand le quota d'appels API dépasse 80% du forfait mensuel.",
    metric: "quota_usage",
    condition: "gt",
    threshold: 80,
    channels: ["in_app", "email"],
    cooldownMin: 60,
  },
  {
    name: "Source dégradée",
    description:
      "Déclenché quand au moins une source de données a un taux de succès < 85%.",
    metric: "source_degraded",
    condition: "eq",
    threshold: 1,
    channels: ["in_app", "webhook"],
    cooldownMin: 30,
  },
  {
    name: "Taux de déduplication élevé",
    description:
      "Déclenché quand le taux de doublons détectés dépasse 20% (qualité source en baisse).",
    metric: "dedup_rate",
    condition: "gt",
    threshold: 20,
    channels: ["in_app"],
    cooldownMin: 120,
  },
]

const DEFAULT_REPORTS = [
  {
    name: "Rapport quotidien",
    description: "Rapport journalier des entreprises indexées (tous secteurs, Abidjan).",
    type: "daily" as const,
    schedule: "daily:08:00",
    channels: ["email"] satisfies NotificationChannel[],
    recipients: ["demo@scraapiq.ci"],
    filters: { cities: ["Abidjan"] },
    format: "pdf" as const,
  },
  {
    name: "Rapport hebdomadaire",
    description: "Synthèse hebdomadaire des entreprises ajoutées et dédupliquées.",
    type: "weekly" as const,
    schedule: "weekly:mon:08:00",
    channels: ["email"] satisfies NotificationChannel[],
    recipients: ["demo@scraapiq.ci"],
    filters: {},
    format: "xlsx" as const,
  },
]

let seedPromise: Promise<void> | null = null

export async function seedNotificationsIfEmpty(): Promise<void> {
  // Singleton pour éviter plusieurs seeds concurrents — mais on relâche le
  // verrou une fois terminé pour qu'un re-seed soit possible si l'utilisateur
  // supprime toutes les règles/rapports et qu'on veut restaurer les défauts.
  if (seedPromise) return seedPromise
  seedPromise = doSeed().finally(() => {
    seedPromise = null
  })
  return seedPromise
}

async function doSeed(): Promise<void> {
  try {
    const alertCount = await db.alertRule.count()
    if (alertCount === 0) {
      for (const a of DEFAULT_ALERTS) {
        await db.alertRule.create({
          data: {
            name: a.name,
            description: a.description,
            metric: a.metric,
            condition: a.condition,
            threshold: a.threshold,
            channels: JSON.stringify(a.channels),
            cooldownMin: a.cooldownMin,
            isActive: true,
          },
        })
      }
      console.log(`[notifications:seed] seeded ${DEFAULT_ALERTS.length} alert rules`)
    }

    const reportCount = await db.scheduledReport.count()
    if (reportCount === 0) {
      for (const r of DEFAULT_REPORTS) {
        await createScheduledReport(r)
      }
      console.log(`[notifications:seed] seeded ${DEFAULT_REPORTS.length} scheduled reports`)
    }
  } catch (err) {
    console.error("[notifications:seed] error:", err)
  }
}
