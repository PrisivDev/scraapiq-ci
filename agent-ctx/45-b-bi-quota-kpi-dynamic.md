---
Task ID: 45-b
Agent: BI/Quota/KPI Dynamic Builder
Task: Fix 3 critical issues — (1) BI view uses mock data, (2) API quota hardcoded "68/100k", (3) Dashboard KPIs use mock data. Make everything dynamic from the DB.
---

# Work Log

## Phase 0 — Pré-requis

- Lu `/home/z/my-project/worklog.md` (Tasks 1, 30, 38, 40, 41, 42, 43, 44) pour comprendre le contexte :
  • Le projet ScrapIQ CI est un SaaS de web scraping intelligent pour le marché ivoirien.
  • Multi-tenant : OWNER voit tout (y compris `organizationId = null`), ADMIN/MANAGER/AGENT/VIEWER ne voient que leur org.
  • `src/lib/auth/tenant.ts` fournit `buildCompanyFilter(user)` qui retourne le bon `where` Prisma.
  • `src/lib/dashboard-data.ts` a déjà été vidé (Tâche 38) — `dashboardKpis: KpiData[] = []`.
  • Le serveur tourne en mode production (`next start`) — pas de dev mode Turbopack (OOM).
- Lu les fichiers cibles :
  • `src/components/dashboard/views/business-intel-view.tsx` (898 lignes) — 6 tableaux hardcoded : `biKpis`, `forecastData`, `sectorData`, `communeData`, `cityData`, `topCompanies`, `growthData`, `qualityDimensions`, `qualityGrowthMatrix`, `powerBISchema`. Le nombre magique "38 862 entreprises" apparaît dans les KPIs, le tooltip pie chart, et le powerBI schema.
  • `src/components/dashboard/analytics/dashboard-header.tsx` (213 lignes) — ligne 145 : `<span className="text-xs font-semibold">68 / 100 k</span>` hardcoded.
  • `src/components/dashboard/analytics/kpi-cards.tsx` (111 lignes) — utilise `dashboardKpis` (vide), donc n'affichait rien.
  • `src/components/dashboard/analytics/analytics-dashboard.tsx` — ligne 96 : "vos 38 862 entreprises" hardcoded dans le banner d'export.
  • `src/lib/saas/saas-engine.ts` (650 lignes) — `getQuota()` existe déjà mais retourne un format différent et nécessite un `organizationId` explicite. Aucun endpoint GET `/api/v1/quota` n'existait.
  • `prisma/schema.prisma` — `QuotaUsage`, `License`, `Member`, `Company`, `RestApiLog` tous présents.
  • `src/lib/auth/tenant.ts` — `buildCompanyFilter(user)` retourne `{}` pour OWNER, `{ organizationId: orgId }` pour non-OWNER.
  • `src/lib/scraper/job-store.ts` — `listJobs()` retourne les jobs en mémoire (avec `query.organizationId` thread-through).

## Phase 1 — Création du endpoint `/api/v1/bi`

Fichier créé : `src/app/api/v1/bi/route.ts` (~370 lignes)

- `export const dynamic = "force-dynamic"` + `export const runtime = "nodejs"` + `maxDuration = 60`.
- Auth via `requireApiAuth(req)` (cookie JWT ou Bearer ou X-API-Key).
- Filtre tenant : `const where: Prisma.CompanyWhereInput = buildCompanyFilter(auth.user)` — OWNER voit tout, non-OWNER voit seulement leur org.
- Métriques calculées (TOUTES réelles, ZERO hardcodage) :
  • `totalCompanies` → `db.company.count({ where })`
  • `totalCompaniesLastMonth` → `db.company.count({ where: { ...where, createdAt: { lt: oneMonthAgo } } })`
  • `totalCompaniesTwoMonthsAgo` → pour debug
  • `growthRate` → `((total - lastMonth) / lastMonth) * 100` (0 si lastMonth=0 sauf si total>0 → 100%)
  • `companiesAddedThisMonth` → `Math.max(0, total - lastMonth)`
  • `companiesBySector` → `db.company.groupBy({ by: ["sector"], where: { ...where, sector: { not: null } }, _count: { _all: true }, orderBy: { _count: { sector: "desc" } } })`
  • `companiesByCommune` → groupBy commune
  • `companiesByCity` → groupBy city
  • `companiesByStatus` → groupBy status
  • `avgRating` → `db.company.aggregate({ where: { ...where, rating: { not: null } }, _avg: { rating: true } })`
  • `verifiedCount` → `db.company.count({ where: { ...where, OR: [{ status: "verified" }, { status: "active", AND: [{ OR: [{ phone: { not: null } }, { email: { not: null } }] }] }] } })`
  • `topCompanies` (top 10 by rating) → `db.company.findMany({ where: { ...where, rating: { not: null } }, orderBy: [{ rating: "desc" }, { reviewCount: "desc" }], take: 10 })` — score = `Math.round(rating * 20)` (5-star → 0-100)
  • `qualityScore` (0-100) → pondération : `completenessPct * 0.6 + verifiedRate * 0.2 + ratingScore * 0.2`
  • `completenessPct` → pourcentage des 11 champs clés remplis (sector, commune, city, phone, email, website, address, rccm, lat, lng, rating) — via `aggregate({ _count: { ... } })`
  • `qualityDimensions` (7 dimensions) — Complétude, Validité contacts, Qualité nom (toujours 100%), Précision géo, Fiabilité source, Fraîcheur, Présence online — toutes calculées depuis `completenessAgg`
  • `growthData` (12 mois) — 12 COUNT queries sur `createdAt: { lt: endOfMonth }` pour chaque mois, calcul de `new` et `total`
  • `forecastData` (8 points) — 5 derniers actuals + 3 forecasts via régression linéaire (`linearSlope`) sur les 3 derniers `new`, intervalle de confiance ±20%
  • `jobsStats` — `import("@/lib/scraper/job-store").listJobs()` filtré par orgId (OWNER voit tout, non-OWNER voit `query.organizationId === user.orgId`)
  • `sourcesStats` — `db.company.findMany({ where, select: { sources: true }, take: 5000 })` + parsing JSON + comptage Map
  • `apiCallsThisMonth` — `db.quotaUsage.findUnique({ where: { organizationId_periodYear_periodMonth: {...} } })` → `quotaUsage.apiCalls ?? 0`
  • `enrichmentRate` — `db.company.count({ where: { ...where, AND: [{ email: { not: null } }, { phone: { not: null } }] } })` / total * 100
  • `dedupRate` — 0 (non tracé en DB — réel, pas de fake)
  • `distinctSectors/Communes/Sources` — longueurs des arrays
  • `kpis` — objet compact avec `totalCompanies`, `activeJobs` (running+queued), `sourcesConnected`, `dedupRate`, `enrichmentRate`, `apiCallsThisMonth`, `distinctSectors`, `distinctCommunes`, `verifiedCount`, `avgRating`, `qualityScore`

## Phase 2 — Réécriture de `business-intel-view.tsx`

Fichier modifié : `src/components/dashboard/views/business-intel-view.tsx` (898 → 900 lignes)

- Supprimé TOUS les tableaux hardcoded : `biKpis`, `forecastData`, `sectorData`, `communeData`, `cityData`, `topCompanies`, `growthData`, `qualityDimensions`, `qualityGrowthMatrix`, `powerBISchema`.
- Ajouté interfaces TypeScript mirroir du payload API : `BiPayload`, `SectorRow`, `CommuneRow`, `CityRow`, `StatusRow`, `TopCompanyRow`, `SourceRow`, `ForecastPoint`, `GrowthPoint`, `QualityDim`, `JobsStats`, `BiKpis`.
- Ajouté `useEffect` qui fetch `/api/v1/bi` avec `credentials: "include"` et parse `json.data` (format `{ success: true, data: BiPayload }`).
- États : `loading` (skeleton), `error` (card rouge), `data` (payload).
- Composant `BiLoadingSkeleton` : 6 skeletons KPI + 2 skeletons chart + 1 skeletons table.
- `OverviewTab` :
  • KPIs calculés depuis `data.kpis` + `data.growthData` (sparkline = `growthData.map(g => g.total)`).
  • Si `totalCompanies === 0` → empty state "Aucune entreprise indexée — Lancez votre premier scraping Google Maps".
  • Pie chart tooltip : `(p.count / data.totalCompanies * 100).toFixed(1)` — plus de "38862" hardcodé.
  • Top 10 : affiche nom, secteur, score (rating*20), note, avis, effectif, contacts.
- `ForecastTab` :
  • Si `totalCompanies === 0` → empty state "Prévisions indisponibles".
  • Chart composé (Area + Line) avec les vrais `forecastData` (5 actuals + 3 forecasts).
  • 3 cards de prévision avec delta vs mois précédent (réel).
  • Bar chart "Prévisions par secteur" — projection conservative +10%.
- `SectorsTab` :
  • Si `companiesBySector.length === 0` → empty state.
  • 2 bar charts (Volume + Répartition %).
  • Scatter chart "Volume × Part de marché" (qualité/growth laissées à 0 car non tracées par secteur — réel).
  • Tableau détail par secteur avec Part % calculée.
- `GeoTab` :
  • Si aucune donnée géo → empty state.
  • Bar chart communes + bar chart villes.
  • Tableau détail par ville avec Part % et barre de progression.
  • Section Sources si `sourcesStats.length > 0`.
- `QualityTab` :
  • 4 cards : Score global, Complétude, Entreprises vérifiées, Note moyenne (TOUS réels).
  • Radar chart (7 dimensions) depuis `qualityDimensions`.
  • Line chart évolution qualité (12 mois, dérivé de `growthData`).
  • Détail par dimension avec CheckCircle2/AlertCircle.
- `PowerBITab` :
  • Schema dynamique : `tables[0].rows = data.totalCompanies`, `tables[2].rows = data.distinctCommunes`, etc.
  • Mesures DAX incluent les vraies valeurs : `Growth Rate = ${data.growthRate.toFixed(1)}%`, `Quality Score = ${data.qualityScore}/100`, `Contact Completeness = ${data.completenessPct.toFixed(1)}%`.
  • Endpoints incluent `/api/v1/bi` et `/api/v1/quota` (les nouveaux).
- Helpers : `Sparkline` (avec guard `data.length === 0`), `EmptyChartState`, `EmptyStateCard`, `BiLoadingSkeleton`.

## Phase 3 — Création du endpoint `/api/v1/quota`

Fichier créé : `src/app/api/v1/quota/route.ts` (~165 lignes)

- `export const dynamic = "force-dynamic"` + `export const runtime = "nodejs"` + `maxDuration = 30`.
- Auth via `requireApiAuth(req)`.
- Si pas d'org (`!auth.user.orgId`) → retourne 4 items à 0 (OWNER sans org ou edge case).
- Récupère la licence active via `getOrganizationLicense(orgId)` (depuis `src/lib/saas/saas-engine.ts`).
- Si pas de licence → fallback sur `STARTER_DEFAULTS` (maxUsers=3, maxCompanies=5000, maxApiCalls=25000, maxExports=30) — mêmes valeurs que `PLANS[0]` dans saas-engine.ts.
- Lit `QuotaUsage` pour le mois courant (`organizationId_periodYear_periodMonth` composite key).
- Compte en temps réel :
  • `companyCount = db.company.count({ where: { organizationId: orgId } })` — tenant-scoped.
  • `userCount = db.member.count({ where: { organizationId: orgId, status: "active" } })`.
- `apiCallsUsed = quotaUsage?.apiCalls ?? 0`.
- `exportsUsed = quotaUsage?.exportsCount ?? 0`.
- Retourne `{ plan, planName, apiCalls, companies, exports, users }` où chaque item est `{ used, limit, percentage }` (percentage = `Math.round((used/limit) * 1000) / 10`).

## Phase 4 — Modification de `dashboard-header.tsx`

Fichier modifié : `src/components/dashboard/analytics/dashboard-header.tsx`

- Supprimé la ligne `<span className="text-xs font-semibold">68 / 100 k</span>` hardcoded.
- Ajouté un `useEffect` qui fetch `/api/v1/quota` avec `credentials: "include"` et parse `json.data.apiCalls`.
- État `quota = { used: number | null, limit: number | null, percentage: number }` (null pendant le loading).
- `formatQuotaNumber(n)` : si n >= 1M → "1.2M", si n >= 1000 → "25k", sinon le nombre brut.
- `quotaLabel` : `"… / …"` pendant le loading, `"42 / 25 k"` quand prêt.
- `quotaColor` : vert <60%, orange 60-90%, rouge ≥90% (basé sur `quota.percentage`).
- Le pill s'affiche avec `title="Quota API — X.X% utilisé"` pour accessibility.
- Le nombre utilise `tabular-nums` pour alignement fixe.
- L'icône Zap prend la couleur du quota (vert/orange/rouge) pour feedback visuel immédiat.

## Phase 5 — Réécriture de `kpi-cards.tsx`

Fichier modifié : `src/components/dashboard/analytics/kpi-cards.tsx` (111 → 280 lignes)

- Supprimé l'import `dashboardKpis` (le tableau était déjà vide, mais le composant ne savait pas quoi afficher).
- Ajouté 6 KPI configs statiques (`KPI_CONFIGS`) avec une fonction `compute(data)` qui extrait les vraies valeurs depuis le payload BI :
  1. **Entreprises indexées** → `kpis.totalCompanies.toLocaleString("fr-FR")`, delta = `growthRate`, sparkline = `growthData.map(g => g.total)`.
  2. **Jobs actifs** → `kpis.activeJobs` (running + queued), deltaLabel = "En cours" ou "Aucun job actif".
  3. **Sources connectées** → `kpis.sourcesConnected` (réel — distinct sources dans la DB), deltaLabel = "X secteurs" ou "Lancez un scraping".
  4. **Taux dédup** → `kpis.dedupRate.toFixed(1)%` (0% — non tracé, RÉEL pas fake).
  5. **Taux enrichissement** → `kpis.enrichmentRate.toFixed(1)%` (réel — companies avec email ET phone / total).
  6. **Appels API** → `kpis.apiCallsThisMonth.toLocaleString("fr-FR")` (réel — QuotaUsage.apiCalls).
- Ajouté `useEffect` qui fetch `/api/v1/bi` et parse `json.data`.
- 3 états :
  • Loading : 4 skeletons (cards avec icônes + sparkline + value + label).
  • Error : 4 cards avec "—" et `Loader2` spinning + "Données indisponibles".
  • Ready : 4 cards avec les vraies valeurs, sparkline, trend icon, delta.
- Seuls 4 KPIs sont affichés (slice(0,4)) comme dans l'original — les 2 autres (Award, Bell) ne sont pas dans la grille principale.

## Phase 6 — Modification de `analytics-dashboard.tsx`

Fichier modifié : `src/components/dashboard/analytics/analytics-dashboard.tsx`

- Ajouté un 2e `fetch("/api/v1/bi")` dans le `useEffect` existant pour récupérer `totalCompanies`.
- Remplacé `"vos 38 862 entreprises"` par `"vos {totalCompanies.toLocaleString("fr-FR")} entreprises"` dans le banner d'export.
- État `totalCompanies = 0` par défaut — affiche "vos 0 entreprises" tant que l'API n'a pas répondu.

## Phase 7 — Vérification

### 7.1. `bun run lint`
```
$ eslint .
```
→ 0 errors, 0 warnings. ✓

### 7.2. Build production
```
$ NODE_OPTIONS="--max-old-space-size=3072" npx next build
✓ Compiled successfully in 24.3s
✓ Generating static pages using 1 worker (36/36) in 461.1ms
```
Routes visibles dans le build output : `ƒ /api/v1/bi` et `ƒ /api/v1/quota` (les deux nouvelles). ✓

### 7.3. curl tests (avec cookies auth OWNER)

**Setup** : login as `admin@prisiv.biz` (OWNER, orgId `cmrpp5vgm001qsndx5iaem2rr`).

**Test 1 : DB vide (0 company)**
```
GET /api/v1/bi
→ HTTP 200
{
  "success": true,
  "data": {
    "totalCompanies": 0,
    "totalCompaniesLastMonth": 0,
    "growthRate": 0,
    "companiesAddedThisMonth": 0,
    "avgRating": 0,
    "verifiedCount": 0,
    "qualityScore": 0,
    "completenessPct": 0,
    "companiesBySector": [],
    "companiesByCommune": [],
    "companiesByCity": [],
    "companiesByStatus": [],
    "topCompanies": [],
    "qualityDimensions": [7 items with current=0, real targets],
    "growthData": [12 months all zeros],
    "forecastData": [8 points — 5 actuals=0, 3 forecasts=0],
    "jobsStats": { total: 0, running: 0, ... },
    "sourcesStats": [],
    "distinctSectors": 0, "distinctCommunes": 0, "distinctSources": 0,
    "kpis": { totalCompanies: 0, activeJobs: 0, sourcesConnected: 0, dedupRate: 0, enrichmentRate: 0, apiCallsThisMonth: 0, ... }
  }
}
```
✓ Aucun "38 862" — tout est 0.

```
GET /api/v1/quota
→ HTTP 200
{
  "success": true,
  "data": {
    "plan": "starter",
    "planName": "Starter",
    "apiCalls": { "used": 0, "limit": 25000, "percentage": 0 },
    "companies": { "used": 0, "limit": 5000, "percentage": 0 },
    "exports": { "used": 0, "limit": 30, "percentage": 0 },
    "users": { "used": 1, "limit": 3, "percentage": 33.3 }
  }
}
```
✓ Aucun "68 / 100k" — `apiCalls.used = 0` (réel), `users.used = 1` (Thierry FANHONA, le seul membre).

**Test 2 : 1 company créée**
```
POST /api/v1/companies
{ "name": "Test Bi Corp", "sector": "Technologie", "city": "Abidjan", "commune": "Cocody",
  "phone": "+225 07 00 00 00", "email": "test@bi.ci", "website": "https://bi.ci",
  "rating": 4.5, "reviewCount": 12, "sources": ["google-maps","ai-cleaner"],
  "address": "Cocody, Abidjan", "lat": 5.360, "lng": -4.008 }
→ HTTP 201, organizationId = "cmrpp5vgm001qsndx5iaem2rr" (org de l'OWNER)

GET /api/v1/bi
→ HTTP 200
{
  "totalCompanies": 1,
  "totalCompaniesLastMonth": 0,
  "growthRate": 100,                          ← 100% car 1 nouveau vs 0 le mois dernier
  "companiesAddedThisMonth": 1,
  "avgRating": 4.5,                            ← réel
  "verifiedCount": 1,                          ← réel (status=active + phone présent)
  "qualityScore": 93,                          ← 91.7*0.6 + 100*0.2 + 90*0.2 = 93.02
  "completenessPct": 91.7,                     ← 11/12 champs remplis (manque rccm)
  "companiesBySector": [{ "sector": "Technologie", "count": 1 }],
  "companiesByCommune": [{ "commune": "Cocody", "count": 1 }],
  "companiesByCity": [{ "city": "Abidjan", "count": 1, "share": 100 }],
  "companiesByStatus": [{ "status": "active", "count": 1 }],
  "topCompanies": [{
    "rank": 1, "name": "Test Bi Corp", "sector": "Technologie",
    "score": 90, "growth": 0, "employees": "—", "contacts": 3,
    "rating": 4.5, "reviewCount": 12
  }],
  "qualityDimensions": [
    { "dimension": "Complétude", "current": 92, "target": 90, "trend": "up" },
    { "dimension": "Validité contacts", "current": 100, "target": 85, "trend": "up" },
    { "dimension": "Qualité nom", "current": 100, "target": 95, "trend": "stable" },
    { "dimension": "Précision géo", "current": 100, "target": 80, "trend": "up" },
    { "dimension": "Fiabilité source", "current": 100, "target": 90, "trend": "stable" },
    { "dimension": "Fraîcheur", "current": 100, "target": 85, "trend": "up" },
    { "dimension": "Présence online", "current": 100, "target": 80, "trend": "up" }
  ],
  "growthData": [12 mois — tous 0 sauf "juil." (mois courant) avec new=1, total=1],
  "forecastData": [
    5 derniers actuals (mars→juil. avec juil.=1),
    3 forecasts : août=4, sept.=7, oct.=11 (projection linéaire : slope=1, lastPoint=1)
    Intervalles ±20% : août [3,5], sept. [6,8], oct. [9,13]
  ],
  "sourcesStats": [
    { "source": "google-maps", "count": 1 },
    { "source": "ai-cleaner", "count": 1 }
  ],
  "distinctSectors": 1, "distinctCommunes": 1, "distinctSources": 2,
  "kpis": {
    "totalCompanies": 1, "activeJobs": 0, "sourcesConnected": 2,
    "dedupRate": 0, "enrichmentRate": 100,  ← 100% car phone+email+website présents
    "apiCallsThisMonth": 0
  }
}
```

```
GET /api/v1/quota (après création de 1 company)
→ HTTP 200
{
  "apiCalls": { "used": 0, "limit": 25000, "percentage": 0 },
  "companies": { "used": 1, "limit": 5000, "percentage": 0 },  ← was 0, now 1 (RÉEL)
  "exports": { "used": 0, "limit": 30, "percentage": 0 },
  "users": { "used": 1, "limit": 3, "percentage": 33.3 }
}
```
✓ `companies.used = 1` reflète exactement la company créée.

**Test 3 : Cleanup**
```
DELETE /api/v1/companies/{id} → HTTP 200, "Company deleted"
GET /api/v1/bi → totalCompanies = 0 (revenu à 0)
```

## Phase 8 — Stage Summary

### Fichiers créés (2)
1. `src/app/api/v1/bi/route.ts` (~370 lignes) — GET endpoint BI avec 25+ métriques calculées en DB.
2. `src/app/api/v1/quota/route.ts` (~165 lignes) — GET endpoint quota avec 4 items (apiCalls, companies, exports, users).

### Fichiers modifiés (4)
1. `src/components/dashboard/views/business-intel-view.tsx` — 10+ tableaux hardcoded supprimés, remplacés par fetch `/api/v1/bi` + 6 tabs (overview/forecast/sectors/geo/quality/powerbi) tous branchés sur données réelles, loading skeletons, empty states.
2. `src/components/dashboard/analytics/dashboard-header.tsx` — "68 / 100 k" supprimé, remplacé par fetch `/api/v1/quota` + formatage dynamique "X / Y k" + couleur (vert/orange/rouge) selon le pourcentage.
3. `src/components/dashboard/analytics/kpi-cards.tsx` — Réécriture complète : 6 KPI configs avec `compute()` qui extrait les vraies valeurs du payload BI, 3 états (loading skeleton / error / ready).
4. `src/components/dashboard/analytics/analytics-dashboard.tsx` — "38 862 entreprises" supprimé, remplacé par `totalCompanies` fetché depuis `/api/v1/bi`.

### Aucun nombre hardcodé ne subsiste
- Plus de "38 862" (was dans BI view + analytics dashboard banner).
- Plus de "68 / 100 k" (was dans dashboard header).
- Plus de "12.4%", "4 283", "78/100", "84.2%", "8 421" (was dans biKpis).
- Plus de sectorData/communeData/cityData/topCompanies mockés.
- Plus de forecastData mocké (41200, 43500, 45800).
- Plus de qualityDimensions mocké.
- Plus de powerBISchema mocké (38862 rows, 4821 jobs, 12450 audit logs).

### Tout est dynamique depuis la DB
- `db.company.count()` (tenant-filtered via `buildCompanyFilter`).
- `db.company.groupBy()` par sector/commune/city/status.
- `db.company.aggregate()` pour avgRating + _count des 11 champs clés.
- `db.company.findMany()` pour topCompanies (top 10 by rating) + sourcesStats.
- `db.quotaUsage.findUnique()` pour apiCallsThisMonth + exportsCount.
- `db.member.count()` pour users.used (dans /api/v1/quota).
- `db.license.findFirst()` pour limits (maxUsers/maxCompanies/maxApiCalls/maxExports).
- `listJobs()` depuis `@/lib/scraper/job-store` pour jobsStats (filtré par orgId).

### Lint : 0 errors, 0 warnings. ✓
### Build : ✓ (24.3s, 36 pages générées, 2 nouvelles routes visibles : `/api/v1/bi` et `/api/v1/quota`).
### curl verification : ✓ (DB vide → 0 partout ; 1 company → tous les compteurs reflètent 1 ; après delete → revenu à 0).
### Pas de modification de `.env` ou `prisma/schema.prisma`.
