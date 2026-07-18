// Production: données mock supprimées. Brancher la source réelle (DB/API).
// `geoCompanies` is now an empty array — the OSM map will render without markers
// until real scraped companies are inserted into the Company table.
// `abidjanCommunes` and `ciCities` are kept (reference geographic data, NOT mock).

/**
 * Données géographiques pour la carte OpenStreetMap
 * Entreprises réparties sur Abidjan (13 communes) + autres villes CI
 */

export interface GeoCompany {
  id: string
  name: string
  sector: string
  commune: string
  city: string
  phone?: string
  address: string
  lat: number
  lng: number
  rating?: number
  reviewCount?: number
  status: "verified" | "enriched" | "partial"
  employees?: string
}

// Communes d'Abidjan avec coordonnées centroïde — reference data (NOT mock).
// `count` set to 0: the map labels will render without fake company counts
// until real DB aggregates are wired.
export const abidjanCommunes = [
  { name: "Cocody", lat: 5.3461, lng: -3.9986, count: 0 },
  { name: "Plateau", lat: 5.3181, lng: -4.0181, count: 0 },
  { name: "Yopougon", lat: 5.3406, lng: -4.0858, count: 0 },
  { name: "Marcory", lat: 5.2994, lng: -4.0183, count: 0 },
  { name: "Treichville", lat: 5.2925, lng: -4.0114, count: 0 },
  { name: "Koumassi", lat: 5.2856, lng: -3.9967, count: 0 },
  { name: "Abobo", lat: 5.4244, lng: -4.0167, count: 0 },
  { name: "Adjamé", lat: 5.3619, lng: -4.0178, count: 0 },
  { name: "Port-Bouët", lat: 5.2656, lng: -3.9919, count: 0 },
  { name: "Attécoubé", lat: 5.3700, lng: -4.0300, count: 0 },
  { name: "Bingerville", lat: 5.3508, lng: -3.8939, count: 0 },
  { name: "Songon", lat: 5.2800, lng: -4.0800, count: 0 },
]

// Villes de Côte d'Ivoire — reference data (NOT mock).
export const ciCities = [
  { name: "Abidjan", lat: 5.3599, lng: -4.0083, population: 5600000, communes: 13 },
  { name: "Bouaké", lat: 7.6906, lng: -5.0302, population: 659000, communes: 0 },
  { name: "Yamoussoukro", lat: 6.8276, lng: -5.2894, population: 355000, communes: 0 },
  { name: "San-Pédro", lat: 4.7485, lng: -6.6363, population: 390000, communes: 0 },
  { name: "Korhogo", lat: 9.4574, lng: -5.6296, population: 286000, communes: 0 },
  { name: "Daloa", lat: 6.8769, lng: -6.4489, population: 325000, communes: 0 },
  { name: "Man", lat: 7.4125, lng: -7.5544, population: 222000, communes: 0 },
  { name: "Gagnoa", lat: 6.1319, lng: -5.9506, population: 213000, communes: 0 },
  { name: "Grand-Bassam", lat: 5.2000, lng: -3.7333, population: 95000, communes: 0 },
]

// Secteurs pour filtres — reference data (NOT mock).
export const mapSectors = [
  "Restauration", "Banque & Finance", "Télécommunications", "BTP & Construction",
  "Commerce", "Santé & Pharmacie", "Agro-alimentaire", "Technologie & IT",
  "Transport & Logistique", "Tourisme & Hôtellerie", "Éducation & Formation", "Beauté & Bien-être",
]

// Production: empty array — companies must come from real scraping / DB.
export const geoCompanies: GeoCompany[] = []

// Calcul de distance haversine (km)
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Couleurs par secteur — reference data (NOT mock).
export const sectorColors: Record<string, string> = {
  "Restauration": "#f97316",
  "Banque & Finance": "#10b981",
  "Télécommunications": "#3b82f6",
  "BTP & Construction": "#a16207",
  "Commerce": "#8b5cf6",
  "Santé & Pharmacie": "#ef4444",
  "Agro-alimentaire": "#84cc16",
  "Technologie & IT": "#06b6d4",
  "Transport & Logistique": "#f59e0b",
  "Tourisme & Hôtellerie": "#ec4899",
  "Éducation & Formation": "#6366f1",
  "Beauté & Bien-être": "#d946ef",
}
