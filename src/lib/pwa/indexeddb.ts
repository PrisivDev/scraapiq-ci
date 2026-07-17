/**
 * IndexedDB — stockage offline pour la PWA
 *
 * Stores :
 *  - pending-actions : actions en attente de synchronisation (jobs, exports)
 *  - cached-companies : entreprises mises en cache pour consultation offline
 *  - user-preferences : préférences utilisateur (theme, filters, etc.)
 */

const DB_NAME = "scraapiq-pwa"
const DB_VERSION = 1

export interface PendingAction {
  id: string
  url: string
  method: string
  data: Record<string, unknown>
  createdAt: string
  type: "job" | "export" | "search" | "notification"
}

export interface CachedCompany {
  id: string
  name: string
  sector: string
  commune: string
  city: string
  phone?: string
  email?: string
  website?: string
  address?: string
  lat?: number
  lng?: number
  cachedAt: string
}

let dbInstance: IDBDatabase | null = null

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non disponible"))
      return
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains("pending-actions")) {
        const store = db.createObjectStore("pending-actions", { keyPath: "id" })
        store.createIndex("type", "type", { unique: false })
        store.createIndex("createdAt", "createdAt", { unique: false })
      }

      if (!db.objectStoreNames.contains("cached-companies")) {
        const store = db.createObjectStore("cached-companies", { keyPath: "id" })
        store.createIndex("sector", "sector", { unique: false })
        store.createIndex("commune", "commune", { unique: false })
        store.createIndex("city", "city", { unique: false })
      }

      if (!db.objectStoreNames.contains("user-preferences")) {
        db.createObjectStore("user-preferences", { keyPath: "key" })
      }
    }

    req.onsuccess = () => {
      dbInstance = req.result
      resolve(dbInstance)
    }

    req.onerror = () => reject(req.error)
  })
}

// ============================================================================
// PENDING ACTIONS (offline queue)
// ============================================================================

export async function addPendingAction(action: Omit<PendingAction, "id" | "createdAt">): Promise<string> {
  const db = await openDB()
  const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const fullAction: PendingAction = {
    ...action,
    id,
    createdAt: new Date().toISOString(),
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-actions", "readwrite")
    tx.objectStore("pending-actions").add(fullAction)
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-actions", "readonly")
    const req = tx.objectStore("pending-actions").getAll()
    req.onsuccess = () => resolve(req.result as PendingAction[])
    req.onerror = () => reject(req.error)
  })
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-actions", "readwrite")
    tx.objectStore("pending-actions").delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ============================================================================
// CACHED COMPANIES (offline data)
// ============================================================================

export async function cacheCompanies(companies: CachedCompany[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-companies", "readwrite")
    const store = tx.objectStore("cached-companies")
    for (const c of companies) {
      store.put(c)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedCompanies(filters?: {
  sector?: string
  commune?: string
  city?: string
}): Promise<CachedCompany[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-companies", "readonly")
    const req = tx.objectStore("cached-companies").getAll()
    req.onsuccess = () => {
      let results = req.result as CachedCompany[]
      if (filters?.sector) results = results.filter((c) => c.sector === filters.sector)
      if (filters?.commune) results = results.filter((c) => c.commune === filters.commune)
      if (filters?.city) results = results.filter((c) => c.city === filters.city)
      resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getCachedCompanyCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-companies", "readonly")
    const req = tx.objectStore("cached-companies").count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export async function setPreference(key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("user-preferences", "readwrite")
    tx.objectStore("user-preferences").put({ key, value })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPreference<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("user-preferences", "readonly")
    const req = tx.objectStore("user-preferences").get(key)
    req.onsuccess = () => resolve(req.result?.value as T)
    req.onerror = () => reject(req.error)
  })
}

// ============================================================================
// STATS
// ============================================================================

export async function getDBStats() {
  try {
    const [pending, cached] = await Promise.all([
      getPendingActions(),
      getCachedCompanyCount(),
    ])
    return {
      pendingActions: pending.length,
      cachedCompanies: cached,
      isAvailable: true,
    }
  } catch {
    return {
      pendingActions: 0,
      cachedCompanies: 0,
      isAvailable: false,
    }
  }
}
