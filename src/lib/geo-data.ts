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

// Communes d'Abidjan avec coordonnées centroïde
export const abidjanCommunes = [
  { name: "Cocody", lat: 5.3461, lng: -3.9986, count: 8210 },
  { name: "Plateau", lat: 5.3181, lng: -4.0181, count: 6890 },
  { name: "Yopougon", lat: 5.3406, lng: -4.0858, count: 5760 },
  { name: "Marcory", lat: 5.2994, lng: -4.0183, count: 4340 },
  { name: "Treichville", lat: 5.2925, lng: -4.0114, count: 3980 },
  { name: "Koumassi", lat: 5.2856, lng: -3.9967, count: 3620 },
  { name: "Abobo", lat: 5.4244, lng: -4.0167, count: 3450 },
  { name: "Adjamé", lat: 5.3619, lng: -4.0178, count: 3280 },
  { name: "Port-Bouët", lat: 5.2656, lng: -3.9919, count: 2890 },
  { name: "Attécoubé", lat: 5.3700, lng: -4.0300, count: 2120 },
  { name: "Bingerville", lat: 5.3508, lng: -3.8939, count: 1820 },
  { name: "Songon", lat: 5.2800, lng: -4.0800, count: 980 },
]

// Villes de Côte d'Ivoire
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

// Secteurs pour filtres
export const mapSectors = [
  "Restauration", "Banque & Finance", "Télécommunications", "BTP & Construction",
  "Commerce", "Santé & Pharmacie", "Agro-alimentaire", "Technologie & IT",
  "Transport & Logistique", "Tourisme & Hôtellerie", "Éducation & Formation", "Beauté & Bien-être",
]

// Génération d'entreprises géolocalisées (60 entreprises réparties)
function generateGeoCompanies(): GeoCompany[] {
  const companies: GeoCompany[] = []
  let id = 1

  // Abidjan — 45 entreprises réparties par commune
  const abidjanCompanies: Array<[string, string, string, string, number, number]> = [
    // [name, sector, commune, address, lat offset, lng offset]
    ["Orange CI - Agence Cocody", "Télécommunications", "Cocody", "Bd Latrille, Cocody", 5.3511, -3.9956],
    ["MTN Côte d'Ivoire - Siège", "Télécommunications", "Cocody", "Riviera 2, Cocody", 5.3481, -4.0006],
    ["Restaurant Le Wôyô", "Restauration", "Cocody", "Riviera 3, Cocody", 5.3461, -3.9986],
    ["Pharmacie de la Riviera", "Santé & Pharmacie", "Cocody", "Riviera 2, Cocody", 5.3421, -4.0016],
    ["Hôtel Ibis Abidjan Plateau", "Tourisme & Hôtellerie", "Plateau", "Bd Lagunaire, Plateau", 5.3201, -4.0201],
    ["BICICI Succursale Plateau", "Banque & Finance", "Plateau", "Av. Chardy, Plateau", 5.3161, -4.0161],
    ["Société Générale CI", "Banque & Finance", "Plateau", "Immeuble SGMA, Plateau", 5.3180, -4.0170],
    ["CFAO Motors Côte d'Ivoire", "Commerce", "Marcory", "Zone 4, Marcory", 5.2994, -4.0183],
    ["Restaurant Le NandO", "Restauration", "Marcory", "Zone 4A, Marcory", 5.2980, -4.0190],
    ["Pharmacie Marcory Zone 4", "Santé & Pharmacie", "Marcory", "Zone 4, Marcory", 5.2970, -4.0200],
    ["ETS Kouassi Logistique", "Transport & Logistique", "Yopougon", "ZI Yopougon", 5.3406, -4.0858],
    ["SIFCA Industries", "Agro-alimentaire", "Plateau", "Immeuble SIFCA, Plateau", 5.3181, -4.0181],
    ["BTP Afrique Construction", "BTP & Construction", "Abobo", "Av. Williamsville, Abobo", 5.4244, -4.0167],
    ["Institut Pédagogique National", "Éducation & Formation", "Treichville", "Av. 14, Treichville", 5.2925, -4.0114],
    ["Orange CI - Agence Yopougon", "Télécommunications", "Yopougon", "Sicogi, Yopougon", 5.3450, -4.0800],
    ["Pharmacie de Treichville", "Santé & Pharmacie", "Treichville", "Av. 13, Treichville", 5.2930, -4.0100],
    ["Restaurant Maquis du Plateau", "Restauration", "Plateau", "Rue des Jardins, Plateau", 5.3190, -4.0190],
    ["SGCI - Société Générale", "Banque & Finance", "Cocody", "II Plateaux, Cocody", 5.3500, -3.9970],
    ["Citadel Logistics", "Transport & Logistique", "Port-Bouët", "Port d'Abidjan", 5.2656, -3.9919],
    ["EcoBank Abidjan", "Banque & Finance", "Plateau", "Immeuble Ecobank, Plateau", 5.3170, -4.0180],
    ["NSIA Banque Plateau", "Banque & Finance", "Plateau", "Av. Houphouët, Plateau", 5.3150, -4.0170],
    ["Cocody Mall", "Commerce", "Cocody", "Riviera Palmeraie, Cocody", 5.3550, -3.9920],
    ["Cap Sud Commerce", "Commerce", "Marcory", "Zone 4, Marcory", 5.2960, -4.0170],
    ["Abidjan Tech Hub", "Technologie & IT", "Cocody", "Angré, Cocody", 5.3600, -3.9900],
    ["Digital Academy CI", "Éducation & Formation", "Cocody", "II Plateaux, Cocody", 5.3530, -3.9960],
    ["Hôtel Tiama", "Tourisme & Hôtellerie", "Plateau", "Av. Houphouët, Plateau", 5.3210, -4.0185],
    ["Sofitel Abidjan", "Tourisme & Hôtellerie", "Plateau", "Bd Lagunaire, Plateau", 5.3220, -4.0210],
    ["Yopougon Pharma", "Santé & Pharmacie", "Yopougon", "Selmer, Yopougon", 5.3430, -4.0820],
    ["Abobo Market Center", "Commerce", "Abobo", "Marché d'Abobo", 5.4250, -4.0150],
    ["Adjamé Commerce", "Commerce", "Adjamé", "Marché d'Adjamé", 5.3620, -4.0180],
    ["Koumassi Pharma", "Santé & Pharmacie", "Koumassi", "Av. 13, Koumassi", 5.2860, -3.9970],
    ["Treichville Logistics", "Transport & Logistique", "Treichville", "Gare de Treichville", 5.2910, -4.0120],
    ["Attécoubé BTP", "BTP & Construction", "Attécoubé", "Av. Attécoubé", 5.3710, -4.0310],
    ["Bingerville Agro", "Agro-alimentaire", "Bingerville", "Route de Bingerville", 5.3510, -3.8950],
    ["Songon Industries", "Agro-alimentaire", "Songon", "ZI Songon", 5.2810, -4.0810],
    ["Port-Bouët Transport", "Transport & Logistique", "Port-Bouët", "Aéroport, Port-Bouët", 5.2610, -3.9920],
    ["Plateau Digital", "Technologie & IT", "Plateau", "Tour A, Plateau", 5.3175, -4.0175],
    ["Cocody Beauty Spa", "Beauté & Bien-être", "Cocody", "Riviera 4, Cocody", 5.3540, -3.9940],
    ["Marcory Beauty Center", "Beauté & Bien-être", "Marcory", "Zone 4B, Marcory", 5.2975, -4.0195],
    ["Abobo Formation Center", "Éducation & Formation", "Abobo", "Av. Abobo, Abobo", 5.4230, -4.0140],
  ]

  for (const [name, sector, commune, address, lat, lng] of abidjanCompanies) {
    companies.push({
      id: `c${id++}`,
      name,
      sector,
      commune,
      city: "Abidjan",
      address,
      lat,
      lng,
      phone: `+225 0${Math.floor(Math.random() * 9) + 1} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)}`,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      reviewCount: Math.floor(Math.random() * 500) + 10,
      status: Math.random() > 0.6 ? "verified" : Math.random() > 0.4 ? "enriched" : "partial",
      employees: ["10-50", "50-100", "100-500", "500-1000"][Math.floor(Math.random() * 4)],
    })
  }

  // Autres villes CI — 20 entreprises
  const otherCities: Array<[string, string, string, number, number]> = [
    ["Bouaké Telecom", "Télécommunications", "Bouaké", 7.6906, -5.0302],
    ["Bouaké Pharma", "Santé & Pharmacie", "Bouaké", 7.6950, -5.0280],
    ["San-Pédro Port Logistics", "Transport & Logistique", "San-Pédro", 4.7485, -6.6363],
    ["San-Pédro Agro Export", "Agro-alimentaire", "San-Pédro", 4.7510, -6.6380],
    ["Yamoussoukro Hôtel", "Tourisme & Hôtellerie", "Yamoussoukro", 6.8276, -5.2894],
    ["Yamoussoukro Basilique", "Tourisme & Hôtellerie", "Yamoussoukro", 6.8300, -5.2900],
    ["Korhogo Market", "Commerce", "Korhogo", 9.4574, -5.6296],
    ["Daloa Commerce", "Commerce", "Daloa", 6.8769, -6.4489],
    ["Man Hôtel", "Tourisme & Hôtellerie", "Man", 7.4125, -7.5544],
    ["Gagnoa Pharma", "Santé & Pharmacie", "Gagnoa", 6.1319, -5.9506],
    ["Bouaké BTP", "BTP & Construction", "Bouaké", 7.6920, -5.0320],
    ["San-Pédro Restaurant", "Restauration", "San-Pédro", 4.7500, -6.6350],
    ["Korhogo Education", "Éducation & Formation", "Korhogo", 9.4590, -5.6280],
    ["Daloa Banque", "Banque & Finance", "Daloa", 6.8780, -6.4470],
    ["Man Tech Center", "Technologie & IT", "Man", 7.4140, -7.5530],
    ["Gagnoa Agro", "Agro-alimentaire", "Gagnoa", 6.1330, -5.9520],
    ["Bouaké Logistics", "Transport & Logistique", "Bouaké", 7.6880, -5.0310],
    ["Yamoussoukro Commerce", "Commerce", "Yamoussoukro", 6.8290, -5.2880],
    ["San-Pédro BTP", "BTP & Construction", "San-Pédro", 4.7490, -6.6370],
    ["Daloa Beauty Spa", "Beauté & Bien-être", "Daloa", 6.8775, -6.4495],
    ["Hôtel Etoile du Sud", "Tourisme & Hôtellerie", "Grand-Bassam", 5.2000, -3.7333],
    ["Restaurant Le Lagon", "Restauration", "Grand-Bassam", 5.2010, -3.7340],
    ["Pharmacie Grand-Bassam", "Santé & Pharmacie", "Grand-Bassam", 5.1990, -3.7320],
    ["Grand-Bassam Commerce", "Commerce", "Grand-Bassam", 5.2020, -3.7350],
  ]

  for (const [name, sector, city, lat, lng] of otherCities) {
    companies.push({
      id: `c${id++}`,
      name,
      sector,
      commune: city,
      city,
      address: `${city}, Côte d'Ivoire`,
      lat,
      lng,
      phone: `+225 0${Math.floor(Math.random() * 9) + 1} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)}`,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      reviewCount: Math.floor(Math.random() * 200) + 5,
      status: Math.random() > 0.6 ? "verified" : Math.random() > 0.4 ? "enriched" : "partial",
      employees: ["10-50", "50-100", "100-500"][Math.floor(Math.random() * 3)],
    })
  }

  return companies
}

export const geoCompanies: GeoCompany[] = generateGeoCompanies()

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

// Couleurs par secteur
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
