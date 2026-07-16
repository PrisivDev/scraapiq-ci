// Données mock pour la maquette du tableau de bord ScrapIQ CI

export type CompanyStatus = "verified" | "enriched" | "partial" | "duplicate"
export type JobStatus = "running" | "completed" | "queued" | "failed"

export interface Company {
  id: string
  name: string
  sector: string
  commune: string
  city: string
  phone: string
  email: string
  website: string
  rccm: string
  lat: number
  lng: number
  sources: string[]
  confidence: number
  status: CompanyStatus
  employees: string
  createdAt: string
}

export interface ScrapingJob {
  id: string
  keyword: string
  sources: string[]
  status: JobStatus
  progress: number
  results: number
  duration: string
  createdAt: string
  user: string
}

export interface DataSource {
  id: string
  name: string
  type: string
  status: "active" | "degraded" | "maintenance"
  records: number
  successRate: number
  lastSync: string
  icon: string
}

// Communes d'Abidjan avec coordonnées approximatives
export const communes = [
  { name: "Cocody", lat: 5.3461, lng: -3.9986 },
  { name: "Plateau", lat: 5.3181, lng: -4.0181 },
  { name: "Yopougon", lat: 5.3406, lng: -4.0858 },
  { name: "Marcory", lat: 5.2994, lng: -4.0183 },
  { name: "Treichville", lat: 5.2925, lng: -4.0114 },
  { name: "Koumassi", lat: 5.2856, lng: -3.9967 },
  { name: "Abobo", lat: 5.4244, lng: -4.0167 },
  { name: "Adjamé", lat: 5.3619, lng: -4.0178 },
  { name: "Port-Bouët", lat: 5.2656, lng: -3.9919 },
  { name: "Bingerville", lat: 5.3508, lng: -3.8939 },
]

export const sectors = [
  "Restauration",
  "Banque & Finance",
  "Télécommunications",
  "BTP & Construction",
  "Commerce de gros",
  "Santé & Pharmacie",
  "Éducation & Formation",
  "Logistique & Transport",
  "Agro-alimentaire",
  "Technologie & IT",
  "Énergie",
  "Tourisme & Hôtellerie",
]

export const cities = [
  "Abidjan",
  "Bouaké",
  "Yamoussoukro",
  "San-Pédro",
  "Korhogo",
  "Daloa",
  "Man",
  "Gagnoa",
  "Divo",
  "Abengourou",
]

export const companies: Company[] = [
  {
    id: "c001",
    name: "Groupe SIFCA Industries",
    sector: "Agro-alimentaire",
    commune: "Plateau",
    city: "Abidjan",
    phone: "+225 27 20 21 00 00",
    email: "contact@sifca-group.com",
    website: "sifca-group.com",
    rccm: "CI-ABJ-2013-B-12345",
    lat: 5.3181,
    lng: -4.0181,
    sources: ["Google Maps", "RCCM", "Site Web"],
    confidence: 98,
    status: "verified",
    employees: "1000-5000",
    createdAt: "2024-11-12",
  },
  {
    id: "c002",
    name: "Restaurant Le Wôyô",
    sector: "Restauration",
    commune: "Cocody",
    city: "Abidjan",
    phone: "+225 07 08 12 34 56",
    email: "contact@lerestaurant-woyo.ci",
    website: "woyo.ci",
    rccm: "CI-ABJ-2018-C-00876",
    lat: 5.3461,
    lng: -3.9986,
    sources: ["Google Maps", "Facebook", "Annuaire.ci"],
    confidence: 92,
    status: "enriched",
    employees: "10-50",
    createdAt: "2024-12-03",
  },
  {
    id: "c003",
    name: "Orange CI - Agence Cocody",
    sector: "Télécommunications",
    commune: "Cocody",
    city: "Abidjan",
    phone: "+225 27 22 48 00 00",
    email: "service.client@orange.ci",
    website: "orange.ci",
    rccm: "CI-ABJ-2009-A-00012",
    lat: 5.3511,
    lng: -3.9956,
    sources: ["Google Maps", "Site Web", "Pages Jaunes"],
    confidence: 99,
    status: "verified",
    employees: "1000-5000",
    createdAt: "2024-10-21",
  },
  {
    id: "c004",
    name: "Pharmacie de la Riviera",
    sector: "Santé & Pharmacie",
    commune: "Cocody",
    city: "Abidjan",
    phone: "+225 27 22 44 12 12",
    email: "contact@pharma-riviera.ci",
    website: "pharma-riviera.ci",
    rccm: "CI-ABJ-2015-D-00234",
    lat: 5.3421,
    lng: -4.0016,
    sources: ["Google Maps", "Facebook"],
    confidence: 88,
    status: "enriched",
    employees: "10-50",
    createdAt: "2024-12-15",
  },
  {
    id: "c005",
    name: "BICICI Succursale Plateau",
    sector: "Banque & Finance",
    commune: "Plateau",
    city: "Abidjan",
    phone: "+225 27 20 24 50 00",
    email: "particuliers@bicici.com",
    website: "bicici.com",
    rccm: "CI-ABJ-2002-A-00088",
    lat: 5.3161,
    lng: -4.0161,
    sources: ["Google Maps", "Site Web", "RCCM"],
    confidence: 97,
    status: "verified",
    employees: "1000-5000",
    createdAt: "2024-11-28",
  },
  {
    id: "c006",
    name: "CFAO Motors Côte d'Ivoire",
    sector: "Commerce de gros",
    commune: "Marcory",
    city: "Abidjan",
    phone: "+225 27 21 35 80 00",
    email: "info@cfao-motors.ci",
    website: "cfao-motors.com",
    rccm: "CI-ABJ-2008-B-00112",
    lat: 5.2994,
    lng: -4.0183,
    sources: ["Google Maps", "RCCM", "Site Web", "Annuaire.ci"],
    confidence: 96,
    status: "verified",
    employees: "100-1000",
    createdAt: "2024-12-01",
  },
  {
    id: "c007",
    name: "ETS Kouassi Logistique",
    sector: "Logistique & Transport",
    commune: "Yopougon",
    city: "Abidjan",
    phone: "+225 05 56 78 90 12",
    email: "kouassi.logistique@gmail.com",
    website: "",
    rccm: "CI-ABJ-2019-E-00456",
    lat: 5.3406,
    lng: -4.0858,
    sources: ["Facebook", "Annuaire.ci"],
    confidence: 76,
    status: "partial",
    employees: "10-50",
    createdAt: "2024-12-18",
  },
  {
    id: "c008",
    name: "Hôtel Ibis Abidjan Plateau",
    sector: "Tourisme & Hôtellerie",
    commune: "Plateau",
    city: "Abidjan",
    phone: "+225 27 20 20 30 00",
    email: "h9121@accor.com",
    website: "accor.com",
    rccm: "CI-ABJ-2011-A-00201",
    lat: 5.3201,
    lng: -4.0201,
    sources: ["Google Maps", "Site Web", "Pages Jaunes"],
    confidence: 95,
    status: "verified",
    employees: "100-1000",
    createdAt: "2024-11-05",
  },
  {
    id: "c009",
    name: "Institut Pédagogique National",
    sector: "Éducation & Formation",
    commune: "Treichville",
    city: "Abidjan",
    phone: "+225 27 21 25 12 12",
    email: "contact@ipn-ci.edu",
    website: "ipn-ci.edu",
    rccm: "CI-ABJ-2010-D-00178",
    lat: 5.2925,
    lng: -4.0114,
    sources: ["Google Maps", "Site Web"],
    confidence: 90,
    status: "enriched",
    employees: "100-1000",
    createdAt: "2024-12-08",
  },
  {
    id: "c010",
    name: "Société Ivoirienne de Traitement de Cacao",
    sector: "Agro-alimentaire",
    commune: "San-Pédro",
    city: "San-Pédro",
    phone: "+225 27 34 71 22 33",
    email: "info@sicta.ci",
    website: "sicta.ci",
    rccm: "CI-SPL-2006-B-00044",
    lat: 4.7485,
    lng: -6.6363,
    sources: ["Google Maps", "RCCM"],
    confidence: 93,
    status: "verified",
    employees: "100-1000",
    createdAt: "2024-12-10",
  },
  {
    id: "c011",
    name: "MTN Côte d'Ivoire - Siège",
    sector: "Télécommunications",
    commune: "Cocody",
    city: "Abidjan",
    phone: "+225 27 22 49 00 00",
    email: "customercare@mtn.ci",
    website: "mtn.ci",
    rccm: "CI-ABJ-2006-A-00033",
    lat: 5.3481,
    lng: -4.0006,
    sources: ["Google Maps", "Site Web", "Facebook"],
    confidence: 98,
    status: "verified",
    employees: "1000-5000",
    createdAt: "2024-11-15",
  },
  {
    id: "c012",
    name: "BTP Afrique Construction",
    sector: "BTP & Construction",
    commune: "Abobo",
    city: "Abidjan",
    phone: "+225 01 23 45 67 89",
    email: "contact@btp-afrique.ci",
    website: "btp-afrique.ci",
    rccm: "CI-ABJ-2016-C-00321",
    lat: 5.4244,
    lng: -4.0167,
    sources: ["Facebook", "Annuaire.ci", "Google Maps"],
    confidence: 82,
    status: "enriched",
    employees: "50-100",
    createdAt: "2024-12-20",
  },
]

export const scrapingJobs: ScrapingJob[] = [
  {
    id: "job-0091",
    keyword: "restaurant + Cocody",
    sources: ["Google Maps", "Facebook"],
    status: "running",
    progress: 68,
    results: 142,
    duration: "00:04:32",
    createdAt: "Il y a 2 min",
    user: "A. Koné",
  },
  {
    id: "job-0090",
    keyword: "pharmacie + Plateau",
    sources: ["Google Maps", "Pages Jaunes"],
    status: "running",
    progress: 34,
    results: 67,
    duration: "00:02:18",
    createdAt: "Il y a 4 min",
    user: "A. Koné",
  },
  {
    id: "job-0089",
    keyword: "banque + Abidjan",
    sources: ["RCCM", "Google Maps", "Site Web"],
    status: "completed",
    progress: 100,
    results: 312,
    duration: "00:12:45",
    createdAt: "Il y a 1 h",
    user: "M. Traoré",
  },
  {
    id: "job-0088",
    keyword: "BTP + Yopougon",
    sources: ["Annuaire.ci", "Facebook"],
    status: "completed",
    progress: 100,
    results: 89,
    duration: "00:08:21",
    createdAt: "Il y a 2 h",
    user: "M. Traoré",
  },
  {
    id: "job-0087",
    keyword: "télécom + Bouaké",
    sources: ["Google Maps"],
    status: "queued",
    progress: 0,
    results: 0,
    duration: "--",
    createdAt: "Il y a 3 h",
    user: "S. Bamba",
  },
  {
    id: "job-0086",
    keyword: "hôtellerie + San-Pédro",
    sources: ["Google Maps", "Site Web"],
    status: "failed",
    progress: 45,
    results: 0,
    duration: "00:05:12",
    createdAt: "Il y a 5 h",
    user: "S. Bamba",
  },
]

export const dataSources: DataSource[] = [
  {
    id: "src-1",
    name: "Google Maps",
    type: "Cartographique",
    status: "active",
    records: 48213,
    successRate: 97.8,
    lastSync: "Il y a 2 min",
    icon: "🗺️",
  },
  {
    id: "src-2",
    name: "RCCM Côte d'Ivoire",
    type: "Registre officiel",
    status: "active",
    records: 24156,
    successRate: 99.4,
    lastSync: "Il y a 18 min",
    icon: "📋",
  },
  {
    id: "src-3",
    name: "Annuaire.ci",
    type: "Annuaire en ligne",
    status: "active",
    records: 18902,
    successRate: 94.2,
    lastSync: "Il y a 6 min",
    icon: "📖",
  },
  {
    id: "src-4",
    name: "Pages Jaunes CI",
    type: "Annuaire en ligne",
    status: "degraded",
    records: 12340,
    successRate: 78.1,
    lastSync: "Il y a 22 min",
    icon: "📒",
  },
  {
    id: "src-5",
    name: "Facebook Pages",
    type: "Réseau social",
    status: "active",
    records: 31078,
    successRate: 91.5,
    lastSync: "Il y a 4 min",
    icon: "👥",
  },
  {
    id: "src-6",
    name: "LinkedIn Entreprises",
    type: "Réseau social",
    status: "maintenance",
    records: 8765,
    successRate: 88.9,
    lastSync: "Il y a 2 h",
    icon: "💼",
  },
]

// Données pour les graphiques
export const scrapingTrend = [
  { date: "Lun", google: 420, annuaire: 280, social: 180 },
  { date: "Mar", google: 510, annuaire: 310, social: 220 },
  { date: "Mer", google: 680, annuaire: 380, social: 290 },
  { date: "Jeu", google: 590, annuaire: 340, social: 250 },
  { date: "Ven", google: 720, annuaire: 420, social: 310 },
  { date: "Sam", google: 480, annuaire: 260, social: 190 },
  { date: "Dim", google: 350, annuaire: 180, social: 140 },
]

export const sectorDistribution = [
  { name: "Restauration", value: 2840, fill: "var(--chart-1)" },
  { name: "Commerce", value: 2410, fill: "var(--chart-2)" },
  { name: "Télécom", value: 1820, fill: "var(--chart-3)" },
  { name: "BTP", value: 1560, fill: "var(--chart-4)" },
  { name: "Santé", value: 1320, fill: "var(--chart-5)" },
  { name: "Autres", value: 2980, fill: "oklch(0.7 0 0)" },
]

export const communeDistribution = [
  { commune: "Cocody", entreprises: 4210 },
  { commune: "Plateau", entreprises: 3890 },
  { commune: "Yopougon", entreprises: 2760 },
  { commune: "Marcory", entreprises: 2340 },
  { commune: "Treichville", entreprises: 1980 },
  { commune: "Koumassi", entreprises: 1620 },
  { commune: "Abobo", entreprises: 1450 },
  { commune: "Adjamé", entreprises: 1280 },
]

export const dedupStats = {
  total: 47283,
  duplicates: 8421,
  merged: 38862,
  rate: 17.8,
}

export const kpis = {
  totalCompanies: 38862,
  activeJobs: 12,
  activeSources: 6,
  dedupRate: 17.8,
  enrichmentRate: 84.2,
  apiCalls: 124530,
  quotaUsed: 68,
  quotaTotal: 100,
}
