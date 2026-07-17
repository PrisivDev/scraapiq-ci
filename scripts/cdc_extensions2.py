# -*- coding: utf-8 -*-
"""Extensions massives supplémentaires pour atteindre 300+ pages."""
from generate_cdc import (
    story, P, SP, PB, hr, h2, h3, h4, intro, bullets,
    table, make_table, caption, code_block, info_box,
    STYLES, CONTENT_W, cm, PageBreak,
)

def extend_more():
    extend_more_ch3()
    extend_more_ch4()
    extend_more_ch9()
    extend_more_ch10()
    extend_more_ch11()

def extend_more_ch3():
    PB()
    h2("3.16 Spécifications des modules complémentaires (suite)")
    h3("3.16.1 Module Sécurité Enterprise — Détail des 9 couches")
    P("""Le module de sécurité Enterprise implémente 9 couches de protection complémentaires qui fonctionnent en synergie pour garantir la confidentialité, l'intégrité et la disponibilité de la plateforme. Chaque couche est indépendamment configurable et monitorée en temps réel.""")
    for i, (name, desc, detail) in enumerate([
        ("Rate Limiting", "6 configurations par endpoint", "Token bucket par IP+endpoint, blocage automatique, retry-after. Configurations: default (60/min), login (5/15min), register (3/1h), api (100/min), scraping (20/h), export (30/h). Chaque config a un windowMs, maxRequests, et blockDurationMs distincts."),
        ("WAF", "10 règles de protection", "Détection: SQL injection (UNION, OR 1=1, DROP), XSS (script, event handlers), Path traversal, SSRF, Command injection, XXE, LFI. Action: block (9 règles) ou log (1 règle). Sanitization automatique des inputs. Logs dans securityEvents."),
        ("DDoS", "Détection de pics de trafic", "Seuil: 100 requêtes/seconde par IP. Blocage: 1 heure. Tracking automatique de toutes les IPs. Blacklist dynamique. Stats: total IPs, blocked IPs, recent IPs. Liste des IPs bloquées avec timestamp."),
        ("Captcha", "Challenge après échecs", "Déclenché après 3 tentatives échouées. Types: addition, multiplication, recopiage de mot. TTL: 5 minutes. Max 3 tentatives par challenge. clearedFailedAttempts après succès. Stats: challenges actifs, IPs avec échecs, IPs requiring captcha."),
        ("Journalisation", "Événements de sécurité structurés", "SecurityEvent avec type, severity (info/warn/error/critical), source, details, metadata. 1000 événements max (rolling). Filtres par type et sévérité. Stockage en mémoire avec rotation automatique."),
        ("Audit", "Blockchain immuable", "AuditEntry avec hash chaîné SHA-256. Chaque entrée contient le hash de la précédente. verifyAuditIntegrity() vérifie la chaîne complète. Catégories: auth, security, data, api, admin, rgpd. 5000 entrées max. Immuable (pas de UPDATE/DELETE)."),
        ("Chiffrement", "AES-256-GCM", "Algorithme: AES-256-GCM avec IV (16 bytes) + AuthTag. Clé: 256 bits (env var). Mots de passe: bcrypt 12 rounds. Masquage: email (ad****@domain), téléphone (+225****1234), CB (************4242). Champs chiffrés: passwords, 2FA secrets, API keys, refresh tokens, session cookies, OAuth tokens."),
        ("RGPD/APIPD", "Conformité loi n°2013-450", "8 droits implémentés: accès, effacement, portabilité, rectification, restriction, registre, notification 72h, pseudonymisation. GdprRequest model avec type, status (pending/processing/completed/rejected). Conforme APIPD (Autorité de Protection des Données de Côte d'Ivoire)."),
        ("Protection API", "7 headers + CORS + CSP", "Headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, Referrer-Policy, Permissions-Policy, CSP. CORS: 3 origines autorisées. CSP: 9 directives. Validation: method, body size (10 Mo), WAF sur URL+body. Sanitization automatique."),
    ], 1):
        P(f"""<b>{i}. {name}</b> — {desc}. {detail}""")
        SP(4)

    h3("3.16.2 Module Architecture Distribuée — Détail des 5 queues")
    P("""L'architecture distribuée repose sur 5 queues BullMQ spécialisées, chacune avec sa propre configuration de concurrence, retry, backoff et priorité. Redis est utilisé comme message broker (fallback mémoire si Redis indisponible).""")
    for queue_name, conc, retry, backoff, prio, max_dur, desc in [
        ("scraping", 3, 3, "exponential 2s", 10, "5 min", "Jobs de scraping Google Maps, Facebook, LinkedIn, Sites web. Le retry gère les blocages temporaires (429, timeout). Le backoff exponentiel évite d'aggraver le blocage."),
        ("ai-cleaner", 2, 2, "exponential 3s", 5, "3 min", "Nettoyage IA: déduplication (embeddings + Jaro-Winkler + GPS), enrichissement LLM, scoring qualité, détection fermetures. Priorité haute car les données nettoyées alimentent tous les autres modules."),
        ("export", 2, 2, "fixed 1s", 10, "2 min", "Génération d'exports multi-format (xlsx, csv, pdf, json, zip). Backoff fixe car les échecs sont généralement liés à la mémoire, pas au réseau."),
        ("notifications", 5, 3, "exponential 0.5s", 1, "30s", "Envoi multi-canal: email, SMS, WhatsApp, push, webhook, in-app. Priorité critique (1) car les notifications d'alerte doivent être livrées rapidement. Concurrency élevée (5) car les envois sont indépendants."),
        ("reports", 1, 1, "fixed 5s", 20, "5 min", "Rapports automatiques planifiés (daily, weekly, monthly). Priorité basse (20) car ce sont des tâches de fond. Concurrency 1 car les rapports sont lourds (génération PDF + envoi)."),
    ]:
        P(f"""<b>{queue_name}</b> — Workers: {conc}, Retry: {retry}, Backoff: {backoff}, Priorité: {prio}, Max durée: {max_dur}. {desc}""")
        SP(4)

    h3("3.16.3 Module Business Intelligence — Détail des 6 vues")
    P("""Le module BI propose 6 vues analytiques avec 7 types de graphiques Recharts, conçues pour être directement exploitables dans Power BI Desktop via l'API REST.""")
    for view_name, desc in [
        ("Vue d'ensemble", "6 KPIs avec sparklines (entreprises totales, croissance mensuelle, score qualité, taux complétude, sources actives, couverture géo). Composed chart croissance 12 mois (area + bar). Pie chart répartition secteurs. Tableau top 10 entreprises."),
        ("Prévisions", "Forecast chart avec réel (5 mois) + prévision (3 mois) et intervalle de confiance à 95%. 3 cards prévisions mensuelles. Bar chart prévisions par secteur (actuel vs +3 mois)."),
        ("Secteurs", "Bar chart horizontal volume par secteur (10 secteurs colorés). Bar chart horizontal croissance par secteur. Scatter chart matrice qualité × croissance (taille = nombre entreprises). Tableau détaillé avec CA estimé."),
        ("Géographie", "Bar chart 8 communes Abidjan. Bar chart horizontal 8 villes CI. Composed chart communes (count + growth + quality, double axe Y). Tableau villes avec part %, croissance, qualité."),
        ("Qualité", "4 KPIs (score global, complétude, doublons, fiches enrichies). Radar 7 dimensions (actuel vs objectif). Line chart évolution 12 mois (3 métriques). Barres détaillées par dimension."),
        ("Power BI Ready", "5 tables (Companies 38862, Sectors 10, Communes 12, ScrapingJobs 4821, AuditLogs 12450). 6 mesures DAX. 4 endpoints REST. Guide connexion Power BI Desktop en 4 étapes."),
    ]:
        P(f"""<b>{view_name}</b> — {desc}""")
        SP(4)

def extend_more_ch4():
    PB()
    h2("4.12 Architecture détaillée — Flux de données end-to-end")
    P("""Le flux de données complet de ScrapIQ CI, depuis la requête utilisateur jusqu'à l'export final, traverse 10 étapes orchestrées par les 10 agents IA spécialisés. Voici le détail de chaque étape avec les volumes, latences et technologies impliquées.""")
    table(
        ["Étape", "Composant", "Volume typique", "Latence", "Technologie"],
        [
            ["1. Requête", "Assistant IA / Search", "1 requête", "2-5s (LLM)", "z-ai GLM-4"],
            ["2. Sources", "Agent 1", "3-5 sources", "< 1s", "Règles + heuristiques"],
            ["3. Scraping", "Agent 2 (Playwright)", "50-100 entreprises", "30-120s", "Playwright + stealth"],
            ["4. Nettoyage", "Agent 3", "50-100 items", "1-3s", "Regex + normalize"],
            ["5. Dédup", "Agent 4", "10-30 doublons", "1-5s", "pgvector + Jaro-Winkler"],
            ["6. Enrichissement", "Agent 5 (LLM)", "20-50 champs", "5-30s", "z-ai GLM-4"],
            ["7. Validation", "Agent 6", "50-100 items", "2-10s", "Regex + HTTP checks"],
            ["8. Géocodage", "Agent 7", "50-100 adresses", "5-20s", "OSM Nominatim"],
            ["9. Classification", "Agent 8 (LLM)", "50-100 items", "5-20s", "Règles + z-ai"],
            ["10. Export", "Agent 10", "50-100 lignes", "2-10s", "xlsx + json2csv"],
        ],
        col_widths=[2.5*cm, 3.5*cm, 3*cm, 2.5*cm, 3*cm],
    )

    h2("4.13 Architecture — Schéma réseau détaillé")
    code_block("""Schéma réseau détaillé (ASCII art)

                    Internet
                       │
                ┌──────┴──────┐
                │  Cloudflare  │  CDN + WAF + DDoS protection
                │  (Edge DNS)  │  TLS 1.3, HTTP/3
                └──────┬──────┘
                       │
                ┌──────┴──────┐
                │   Caddy      │  Reverse proxy + gateway
                │   Gateway    │  XTransformPort routing
                └──────┬──────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
    ┌──────┴──┐  ┌─────┴────┐  ┌──┴──────┐
    │ Next.js  │  │ Mini-svc │  │ Socket  │
    │ :3000    │  │ :3003   │  │ :3003   │
    │ (App)    │  │ (Worker)│  │ (WS)    │
    └──────┬──┘  └─────┬────┘  └─────────┘
           │           │
    ┌──────┴───────────┴──────┐
    │     Prisma (SQLite)     │  ORM + connection pool
    │     db/custom.db        │  30+ models
    └─────────────────────────┘
           │
    ┌──────┴──────┐
    │  z-ai SDK   │  LLM (GLM-4), VLM, TTS, ASR
    │  (external) │  API calls (backend only)
    └─────────────┘""")

def extend_more_ch9():
    PB()
    h2("9.12 API — Schéma de données des réponses")
    h3("9.12.1 Format de réponse standard")
    code_block("""// Format succès
{
  "success": true,
  "data": T,
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 38862,
    "totalPages": 1944,
    "hasNext": true,
    "hasPrev": false
  },
  "message": "Optional message"
}

// Format erreur
{
  "success": false,
  "error": "Description de l'erreur",
  "code": "OPTIONAL_ERROR_CODE"
}

// Format pagination
GET /api/v1/companies?page=2&limit=10
→ meta.totalPages = ceil(total / limit)
→ meta.hasNext = page < totalPages
→ meta.hasPrev = page > 1""")

    h3("9.12.2 Codes de statut HTTP")
    table(
        ["Code", "Signification", "Quand"],
        [
            ["200", "OK", "GET, PUT, DELETE réussi"],
            ["201", "Created", "POST réussi (ressource créée)"],
            ["202", "Accepted", "Job asynchrone lancé (scraping, export)"],
            ["400", "Bad Request", "Paramètres invalides ou manquants"],
            ["401", "Unauthorized", "Token JWT manquant ou invalide"],
            ["403", "Forbidden", "Rôle insuffisant (RBAC)"],
            ["404", "Not Found", "Ressource introuvable"],
            ["409", "Conflict", "Ressource déjà existante (email, slug)"],
            ["422", "Unprocessable Entity", "Validation échouée (format, longueur)"],
            ["429", "Too Many Requests", "Rate limit dépassé (retry-after)"],
            ["500", "Internal Server Error", "Erreur serveur non gérée"],
            ["503", "Service Unavailable", "Mode maintenance ou overload"],
        ],
        col_widths=[1.5*cm, 4*cm, 8.5*cm],
    )

def extend_more_ch10():
    PB()
    h2("10.7 Modèle de données — Schéma Prisma complet (30+ modèles)")
    P("""ScrapIQ CI utilise Prisma ORM avec SQLite (dev) / PostgreSQL (prod). Le schéma contient 30+ modèles organisés en 7 domaines fonctionnels.""")
    table(
        ["Domaine", "Modèles", "Tables"],
        [
            ["Auth & Users", "User, UserSession, Account, RefreshToken, JwtBlacklist", "5"],
            ["Organisation", "Organization, Workspace, Member", "3"],
            ["API & Security", "ApiKey, AuditLog, RestApiLog", "3"],
            ["Scraping", "SearchJob, JobTask, ScrapeRawResult, Company, CompanySourceRef", "5"],
            ["Contacts", "Contact, Geolocation, Tag, CompanyTag", "4"],
            ["IA & Dédup", "DedupCluster, DedupClusterMember, DedupDecision, CompanyEmbedding, AiEnrichment, AiModelLog", "6"],
            ["SaaS & Billing", "License, Subscription, Invoice, QuotaUsage, Plan", "5"],
            ["Notifications", "Notification, Webhook, WebhookDelivery, AlertRule, ScheduledReport, ReportExecution", "6"],
            ["Sources & Export", "Source, ExportJob, ExportItem", "3"],
        ],
        col_widths=[3*cm, 8*cm, 1.5*cm],
    )
    P("""Total : 30+ modèles avec index optimisés, contraintes d'intégrité, relations cascade, et Row-Level Security (RLS) pour l'isolation multi-tenant.""")

    h3("10.7.1 Index et optimisations")
    table(
        ["Table", "Index", "Type", "Justification"],
        [
            ["companies", "(tenant_id) WHERE deleted_at IS NULL", "B-tree partiel", "Filtrage tenant + exclusion soft-deleted"],
            ["companies", "gin(name gin_trgm_ops)", "GIN trigramme", "Recherche floue par nom"],
            ["companies", "(tenant_id, sector_id)", "B-tree composite", "Filtres secteur + tenant"],
            ["contacts", "(company_id, type) WHERE is_primary", "Partial unique", "1 contact primaire par type"],
            ["company_embeddings", "hnsw(embedding vector_cosine_ops)", "HNSW vectoriel", "Recherche ANN dédup IA"],
            ["search_jobs", "(status, priority) WHERE status IN ('queued','running')", "Partial", "Queue du scheduler"],
            ["api_call_logs", "(tenant_id, created_at DESC)", "B-tree", "Logs récents par tenant"],
            ["audit_logs", "(entity_type, entity_id)", "B-tree", "Traçabilité entité"],
        ],
        col_widths=[2.5*cm, 5.5*cm, 2.5*cm, 4*cm],
    )

def extend_more_ch11():
    PB()
    h2("11.10 Sécurité — Checklist complète de conformité")
    P("""La checklist suivante récapitule toutes les mesures de sécurité implémentées dans ScrapIQ CI, classées par catégorie.""")
    table(
        ["Catégorie", "Mesure", "Statut", "Détail"],
        [
            ["Auth", "JWT HS256 (15min access, 30j refresh)", "✅ Implémenté", "jose + rotation + blacklist JTI"],
            ["Auth", "OAuth Google + Microsoft", "✅ Implémenté", "Passport + state CSRF + code exchange"],
            ["Auth", "2FA TOTP (RFC 6238)", "✅ Implémenté", "otpauth + 10 backup codes"],
            ["Auth", "Rate limiting login (5/15min)", "✅ Implémenté", "Token bucket + lockout 15min"],
            ["RBAC", "5 rôles hiérarchiques", "✅ Implémenté", "Owner > Admin > Manager > Agent > Viewer"],
            ["RBAC", "22 permissions granulaires", "✅ Implémenté", "6 catégories, matrice rôle×permission"],
            ["RBAC", "Sidebar filtrée par rôle", "✅ Implémenté", "canAccess() + 3 niveaux protection"],
            ["WAF", "10 règles (SQL, XSS, path, SSRF, cmd, XXE, LFI)", "✅ Implémenté", "Regex + block/log + sanitization"],
            ["DDoS", "Détection 100 req/s + blocage 1h", "✅ Implémenté", "Tracking IPs + blacklist dynamique"],
            ["Captcha", "Challenge après 3 échecs", "✅ Implémenté", "Math + word, TTL 5min"],
            ["Chiffrement", "AES-256-GCM (données sensibles)", "✅ Implémenté", "IV + AuthTag, bcrypt 12 rounds"],
            ["Chiffrement", "TLS 1.3 (transit)", "✅ Configuré", "Caddy + Cloudflare"],
            ["Audit", "Blockchain immuable (SHA-256)", "✅ Implémenté", "Hash chaîné + verifyIntegrity()"],
            ["RGPD", "8 droits APIPD (loi 2013-450)", "✅ Implémenté", "Access, erasure, portability, rectification"],
            ["API", "7 security headers", "✅ Implémenté", "X-Content-Type, X-Frame, CSP, HSTS, etc."],
            ["API", "CORS (3 origines)", "✅ Implémenté", "scraapiq.ci, app.scraapiq.ci, localhost"],
            ["API", "CSP (9 directives)", "✅ Implémenté", "default-src, script-src, style-src, etc."],
            ["API", "Validation requêtes (method, body, WAF)", "✅ Implémenté", "10 Mo max, 5 méthodes, WAF URL+body"],
            ["PWA", "Service Worker (cache, offline, sync)", "✅ Implémenté", "3 stratégies: cache-first, SWR, network-first"],
            ["Session", "Révocation tous devices", "✅ Implémenté", "blacklistAllUserTokens + revoke sessions"],
        ],
        col_widths=[2*cm, 5.5*cm, 2*cm, 5*cm],
    )
