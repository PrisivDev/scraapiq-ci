"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import { getDBStats, addPendingAction, getPendingActions } from "./indexeddb"

// Hook pour éviter le mismatch d'hydration et les setState dans effects
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export interface PWAState {
  isOnline: boolean
  isInstalled: boolean
  isStandalone: boolean
  canInstall: boolean
  pendingActions: number
  cachedCompanies: number
  syncStatus: "idle" | "syncing" | "error"
  dbAvailable: boolean
  swRegistered: boolean
}

export interface PWAActions {
  install: () => Promise<boolean>
  registerSync: () => Promise<void>
  queueAction: (action: { url: string; method: string; data: Record<string, unknown>; type: string }) => Promise<void>
  refreshStats: () => Promise<void>
  clearCache: () => Promise<void>
}

export function usePWA(): PWAState & PWAActions {
  const [isOnline, setIsOnline] = useState(true)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [pendingActions, setPendingActions] = useState(0)
  const [cachedCompanies, setCachedCompanies] = useState(0)
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle")
  const [dbAvailable, setDbAvailable] = useState(false)
  const [swRegistered, setSwRegistered] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // Init : online/offline, standalone, service worker
  const mounted = useMounted()
  useEffect(() => {
    if (!mounted) return

    // Online/offline — utilise setTimeout pour éviter setState synchrone dans effect
    const updateOnline = () => setIsOnline(navigator.onLine)
    setTimeout(updateOnline, 0)
    window.addEventListener("online", () => {
      updateOnline()
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          if ("sync" in reg) {
            reg.sync.register("scraapiq-sync").catch(() => {})
            reg.sync.register("scraapiq-sync-jobs").catch(() => {})
            reg.sync.register("scraapiq-sync-exports").catch(() => {})
          }
        }).catch(() => {})
      }
    })
    window.addEventListener("offline", updateOnline)

    // Standalone (déjà installé en PWA) — différé
    setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      setIsStandalone(standalone)
      setIsInstalled(standalone)
    }, 0)

    // beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setCanInstall(false)
      setDeferredPrompt(null)
    }
    window.addEventListener("appinstalled", handleAppInstalled)

    // Service Worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          setSwRegistered(true)
        })
        .catch(() => {
          // SW registration failed (peut être en dev mode)
        })

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "BACKGROUND_SYNC") {
          setSyncStatus("syncing")
        }
        if (event.data?.type === "SYNC_COMPLETE") {
          setSyncStatus("idle")
          // Inline refresh to avoid forward reference
          getDBStats().then((stats) => {
            setPendingActions(stats.pendingActions)
            setCachedCompanies(stats.cachedCompanies)
            setDbAvailable(stats.isAvailable)
          }).catch(() => {})
        }
      })
    }

    // Initial stats
    getDBStats().then((stats) => {
      setPendingActions(stats.pendingActions)
      setCachedCompanies(stats.cachedCompanies)
      setDbAvailable(stats.isAvailable)
    }).catch(() => {})

    return () => {
      window.removeEventListener("online", updateOnline)
      window.removeEventListener("offline", updateOnline)
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const refreshStats = useCallback(async () => {
    const stats = await getDBStats()
    setPendingActions(stats.pendingActions)
    setCachedCompanies(stats.cachedCompanies)
    setDbAvailable(stats.isAvailable)
  }, [])

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === "accepted") {
        setIsInstalled(true)
        setCanInstall(false)
        setDeferredPrompt(null)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [deferredPrompt])

  const registerSync = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      if ("sync" in reg) {
        await reg.sync.register("scraapiq-sync")
        await reg.sync.register("scraapiq-sync-jobs")
        await reg.sync.register("scraapiq-sync-exports")
        setSyncStatus("syncing")
      }
    } catch {
      // Sync non supporté
    }
  }, [])

  const queueAction = useCallback(async (action: {
    url: string
    method: string
    data: Record<string, unknown>
    type: string
  }) => {
    try {
      await addPendingAction(action)
      await refreshStats()
      // Tente d'enregistrer un background sync
      if (isOnline) {
        await registerSync()
      }
    } catch {
      // IndexedDB non disponible
    }
  }, [isOnline, refreshStats, registerSync])

  const clearCache = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      reg.active?.postMessage({ type: "CLEAR_CACHE" })
      // Clear caches API
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
    } catch {
      // ignore
    }
  }, [])

  return {
    isOnline,
    isInstalled,
    isStandalone,
    canInstall,
    pendingActions,
    cachedCompanies,
    syncStatus,
    dbAvailable,
    swRegistered,
    install,
    registerSync,
    queueAction,
    refreshStats,
    clearCache,
  }
}

// Type pour beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
