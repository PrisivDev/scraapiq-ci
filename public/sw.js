/**
 * Service Worker — ScrapIQ CI PWA
 *
 * Fonctionnalités :
 *  1. Cache statique (app shell) — pré-cache des ressources critiques
 *  2. Cache dynamique — mise en cache à la volée (stale-while-revalidate)
 *  3. Offline — sert le cache quand le réseau est indisponible
 *  4. Background Sync — synchronise les actions en attente quand le réseau revient
 *  5. Push Notifications — reçoit les notifications push
 *  6. Cache cleanup — nettoyage périodique des vieux caches
 */

const CACHE_VERSION = "scraapiq-v1"
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const OFFLINE_URL = "/offline"

// Ressources à pré-cacher (app shell)
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.svg",
]

// ============================================================================
// INSTALL — pré-cache de l'app shell
// ============================================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Si une ressource échoue, on continue quand même
        return Promise.resolve()
      })
    })
  )
  self.skipWaiting()
})

// ============================================================================
// ACTIVATE — nettoyage des vieux caches
// ============================================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("scraapiq-") && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// ============================================================================
// FETCH — stratégies de cache
// ============================================================================
self.addEventListener("fetch", (event) => {
  const { request } = event

  // Ignore les requêtes non-GET
  if (request.method !== "GET") return

  // Ignore les requêtes vers l'API (toujours réseau)
  if (request.url.includes("/api/")) {
    // Pour les API, on tente le réseau, fallback sur cache si offline
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          return new Response(
            JSON.stringify({ error: "Offline", message: "Cette action nécessite une connexion internet." }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          )
        })
      })
    )
    return
  }

  // Pour les assets statiques : cache-first
  if (request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }

  // Pour les pages : stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          // Clone et stocke dans le cache dynamique
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Si offline et pas de cache → page offline
          if (request.mode === "navigate") {
            return caches.match(OFFLINE_URL).then((offline) => {
              return offline || new Response(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — ScrapIQ CI</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>🔌 Mode hors ligne</h1><p>Vous êtes hors ligne. Vos données sont disponibles dans le cache.</p><p>La synchronisation se fera automatiquement quand vous serez de nouveau connecté.</p></body></html>`,
                { headers: { "Content-Type": "text/html" } }
              )
            })
          }
          throw new Error("Network error")
        })

      // Retourne le cache immédiatement si disponible, sinon attend le réseau
      return cached || fetchPromise
    })
  )
})

// ============================================================================
// BACKGROUND SYNC — synchronisation différée
// ============================================================================
self.addEventListener("sync", (event) => {
  if (event.tag === "scraapiq-sync") {
    event.waitUntil(
      self.registration.sync.register("scraapiq-sync").then(() => {
        // Notifie les clients que la sync a lieu
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "BACKGROUND_SYNC", status: "syncing" })
          })
        })
      })
    )
  }

  if (event.tag === "scraapiq-sync-jobs") {
    event.waitUntil(syncPendingJobs())
  }

  if (event.tag === "scraapiq-sync-exports") {
    event.waitUntil(syncPendingExports())
  }
})

async function syncPendingJobs() {
  // Récupère les jobs en attente depuis IndexedDB
  // En production : envoie vers l'API
  try {
    const db = await openDB()
    const tx = db.transaction("pending-actions", "readonly")
    const store = tx.objectStore("pending-actions")
    const pending = await store.getAll()

    for (const action of pending) {
      try {
        const res = await fetch(action.url, {
          method: action.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.data),
          credentials: "include",
        })
        if (res.ok) {
          // Supprime l'action synchronisée
          const deleteTx = db.transaction("pending-actions", "readwrite")
          await deleteTx.objectStore("pending-actions").delete(action.id)
        }
      } catch {
        // Réessaiera au prochain sync
      }
    }

    // Notifie les clients
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({ type: "SYNC_COMPLETE", synced: pending.length })
    })
  } catch (err) {
    console.error("[SW] sync error:", err)
  }
}

async function syncPendingExports() {
  // Similaire à syncPendingJobs mais pour les exports
  try {
    const db = await openDB()
    const tx = db.transaction("pending-exports", "readonly")
    const pending = await tx.objectStore("pending-exports").getAll()

    for (const exp of pending) {
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exp.data),
          credentials: "include",
        })
        if (res.ok) {
          const deleteTx = db.transaction("pending-exports", "readwrite")
          await deleteTx.objectStore("pending-exports").delete(exp.id)
        }
      } catch {
        // Réessaiera
      }
    }
  } catch (err) {
    console.error("[SW] export sync error:", err)
  }
}

// Helper : ouvre IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("scraapiq-pwa", 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("pending-actions")) {
        db.createObjectStore("pending-actions", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("pending-exports")) {
        db.createObjectStore("pending-exports", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("cached-companies")) {
        db.createObjectStore("cached-companies", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("user-preferences")) {
        db.createObjectStore("user-preferences", { keyPath: "key" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ============================================================================
// PUSH — notifications push
// ============================================================================
self.addEventListener("push", (event) => {
  let data = { title: "ScrapIQ CI", body: "Nouvelle notification" }
  try {
    if (event.data) data = event.data.json()
  } catch {
    if (event.data) data = { title: "ScrapIQ CI", body: event.data.text() }
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: [
      { action: "open", title: "Ouvrir" },
      { action: "close", title: "Fermer" },
    ],
    tag: data.tag || "scraapiq-notification",
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// ============================================================================
// NOTIFICATION CLICK
// ============================================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "close") return

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus sur un client existant
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus()
        }
      }
      // Sinon ouvre une nouvelle fenêtre
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || "/")
      }
    })
  )
})

// ============================================================================
// MESSAGE — communication avec le client
// ============================================================================
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }

  if (event.data?.type === "GET_CACHE_STATS") {
    event.respondWith(
      (async () => {
        const staticKeys = await caches.keys()
        let totalEntries = 0
        for (const cacheName of staticKeys) {
          const cache = await caches.open(cacheName)
          const keys = await cache.keys()
          totalEntries += keys.length
        }
        return new Response(JSON.stringify({
          caches: staticKeys,
          totalEntries,
        }), { headers: { "Content-Type": "application/json" } })
      })()
    )
  }

  if (event.data?.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((names) => {
        return Promise.all(names.map((n) => caches.delete(n)))
      }).then(() => {
        // Re-pré-cache l'app shell
        return caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
      })
    )
  }
})
