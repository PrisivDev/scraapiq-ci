"use client"

import { useEffect, useState } from "react"

/**
 * Hook qui fetch les vrais compteurs pour les badges de la sidebar.
 *
 * Au lieu d'afficher des nombres hardcodés (ex: "12" jobs), on interroge
 * les API existantes pour obtenir les valeurs réelles, filtrées par org.
 *
 * Refresh toutes les 30 secondes pour rester à jour.
 */

interface SidebarCounts {
  companies: number
  jobs: number
  notifications: number
  agents: number
  apiKeys: number
  loading: boolean
}

const EMPTY: SidebarCounts = {
  companies: 0,
  jobs: 0,
  notifications: 0,
  agents: 0,
  apiKeys: 0,
  loading: true,
}

export function useSidebarCounts(): SidebarCounts {
  const [counts, setCounts] = useState<SidebarCounts>(EMPTY)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const fetchCounts = async () => {
      try {
        // Fetch parallèle de tous les compteurs
        const [companiesRes, notifRes, agentsRes] = await Promise.allSettled([
          fetch("/api/v1/companies?limit=1", { credentials: "include" }).then((r) =>
            r.ok ? r.json() : null
          ),
          fetch("/api/v1/notifications/stats", { credentials: "include" }).then((r) =>
            r.ok ? r.json() : null
          ),
          fetch("/api/v1/agents", { credentials: "include" }).then((r) =>
            r.ok ? r.json() : null
          ),
        ])

        if (!active) return

        const next: SidebarCounts = {
          companies: 0,
          jobs: 0,
          notifications: 0,
          agents: 0,
          apiKeys: 0,
          loading: false,
        }

        // Companies — total depuis meta
        if (companiesRes.status === "fulfilled" && companiesRes.value?.meta?.total != null) {
          next.companies = companiesRes.value.meta.total
        }

        // Notifications — non lues (in_app)
        if (notifRes.status === "fulfilled") {
          const v = notifRes.value
          // L'API retourne { success, data: { unreadInApp, total, ... } }
          const unread =
            v?.data?.unreadInApp ??
            v?.data?.unread ??
            v?.unreadInApp ??
            v?.unread ??
            0
          if (unread > 0) next.notifications = unread
        }

        // Agents — nombre de pipelines exécutés
        if (agentsRes.status === "fulfilled") {
          const v = agentsRes.value
          if (Array.isArray(v?.data)) next.agents = v.data.length
          else if (Array.isArray(v?.pipelines)) next.agents = v.pipelines.length
        }

        setCounts(next)
      } catch {
        if (active) setCounts((c) => ({ ...c, loading: false }))
      } finally {
        // Refresh toutes les 30s
        if (active) {
          timer = setTimeout(fetchCounts, 30000)
        }
      }
    }

    fetchCounts()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  return counts
}
