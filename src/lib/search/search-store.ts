/**
 * Store d'indexation — singleton
 * Indexe toutes les entreprises (geo-data + mock-data) dans le moteur Elasticsearch
 */

import { InMemoryElasticsearch, type IndexedDocument } from "./elasticsearch-engine"
import { geoCompanies } from "@/lib/geo-data"
import { companies as mockCompanies } from "@/lib/mock-data"

const globalForSearch = globalThis as unknown as {
  __searchEngine?: InMemoryElasticsearch
  __searchEngineVersion?: number
}

const SEARCH_ENGINE_VERSION = 2 // bump pour forcer rebuild quand données changent

function buildSearchEngine(): InMemoryElasticsearch {
  const engine = new InMemoryElasticsearch([
    "name", "sector", "commune", "city", "address", "category", "description",
  ])

  const docs: IndexedDocument[] = []

  for (const c of geoCompanies) {
    docs.push({
      id: `geo-${c.id}`,
      fields: {
        name: c.name,
        sector: c.sector,
        commune: c.commune,
        city: c.city,
        address: c.address,
        phone: c.phone,
        lat: c.lat,
        lng: c.lng,
        rating: c.rating,
        reviewCount: c.reviewCount,
        status: c.status,
        employees: c.employees,
        category: c.sector,
        description: `${c.name} — ${c.sector} à ${c.commune}, ${c.city}. ${c.address}`,
        source: "geo",
      },
    })
  }

  for (const c of mockCompanies) {
    docs.push({
      id: `mock-${c.id}`,
      fields: {
        name: c.name,
        sector: c.sector,
        commune: c.commune,
        city: c.city,
        address: c.address || "",
        phone: c.phone,
        email: c.email,
        website: c.website,
        rccm: c.rccm,
        lat: c.lat,
        lng: c.lng,
        rating: undefined,
        reviewCount: undefined,
        status: c.status,
        employees: c.employees,
        category: c.sector,
        description: `${c.name} — ${c.sector} à ${c.commune}, ${c.city}. ${c.sources?.join(", ") || ""}`,
        source: "mock",
      },
    })
  }

  engine.indexBatch(docs)
  return engine
}

// Rebuild si version change ou si pas encore construit
const needsRebuild = !globalForSearch.__searchEngine || globalForSearch.__searchEngineVersion !== SEARCH_ENGINE_VERSION

export const searchEngine = needsRebuild ? buildSearchEngine() : globalForSearch.__searchEngine!

if (process.env.NODE_ENV !== "production") {
  globalForSearch.__searchEngine = searchEngine
  globalForSearch.__searchEngineVersion = SEARCH_ENGINE_VERSION
}

export function getSearchStats() {
  return searchEngine.stats()
}
