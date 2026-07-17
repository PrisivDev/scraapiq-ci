# -*- coding: utf-8 -*-
"""
Extensions massives pour atteindre 300+ pages.
Ajoute du contenu détaillé supplémentaire à chaque chapitre.
Ces fonctions sont appelées après les chapitres originaux.
"""
from generate_cdc import (
    story, P, SP, PB, hr, h2, h3, h4, intro, bullets,
    table, make_table, caption, code_block, info_box, two_col, kv_block,
    ascii_diagram, STYLES, CONTENT_W,
    EMERALD, ORANGE, DARK, GRAY, GRAY_BORDER,
    Paragraph, Spacer, PageBreak, cm,
)

def extend_all_chapters():
    """Ajoute du contenu supplémentaire après chaque chapitre."""
    extend_ch1()
    extend_ch2()
    extend_ch3()
    extend_ch4()
    extend_ch5()
    extend_ch6()
    extend_ch7()
    extend_ch8()
    extend_ch9()
    extend_ch10()
    extend_ch11()
    extend_ch12()
    extend_ch13()
    extend_ch14()
    extend_ch15()

def extend_ch1():
    PB()
    h2("1.7 Analyse PESTEL du marché ivoirien")
    P("""L'analyse PESTEL permet d'évaluer les facteurs externes qui influencent le marché de la données d'entreprises en Côte d'Ivoire. Cette analyse est essentielle pour comprendre les opportunités et les risques associés au lancement de ScrapIQ CI.""")
    table(
        ["Facteur", "Analyse", "Impact sur ScrapIQ CI"],
        [
            ["Politique", "Stabilité gouvernementale, volonté de digitalisation, Plan National de Développement (PND 2021-2025)", "Favorable — soutien gouvernemental à la digitalisation"],
            ["Économique", "Croissance PIB +7%, classe moyenne en expansion, FCFA stable", "Favorable — pouvoir d'achat croissant pour B2B SaaS"],
            ["Social", "Taux de pénétration mobile > 90%, adoption digitale rapide chez les jeunes", "Très favorable — marché mobile-first idéal"],
            ["Technologique", "Fibre optique en expansion, 4G généralisée, 5G annoncée", "Favorable — infrastructure suffisante"],
            ["Environnemental", "Transition verte, RSE des entreprises", "Neutre — impact indirect"],
            ["Légal", "Loi n°2013-450 (protection données), APIPD active", "Contrainte — conformité obligatoire mais différenciateur"],
        ],
        col_widths=[2.5*cm, 6.5*cm, 5.5*cm],
    )
    h3("1.7.1 Analyse des 5 forces de Porter")
    table(
        ["Force", "Niveau", "Analyse"],
        [
            ["Intensité concurrentielle", "Modéré", "Peu de concurrents directs (aucun SaaS B2B de scraping CI). Concurrents indirects: annuaires en ligne, cabinets de prospection"],
            ["Pouvoir des fournisseurs", "Faible", "Sources de données publiques (Google Maps, Facebook), pas de dépendance exclusive"],
            ["Pouvoir des clients", "Modéré", "PME sensibles au prix, mais peu d'alternatives. Grandes entreprises prêtes à payer pour la qualité"],
            ["Menace nouveaux entrants", "Modéré", "Barrière technique (scraping, IA, infrastructure). Barrière réglementaire (APIPD)"],
            ["Menace produits de substitution", "Faible", "Pas d'alternative automatisée. Manuelle = coûteux et lent"],
        ],
        col_widths=[3.5*cm, 2*cm, 9*cm],
    )
    h3("1.7.2 Matrice SWOT")
    P("""<b>Forces :</b> Première plateforme SaaS de scraping CI, IA native (dédup, enrichissement, scoring), multi-sources (Google Maps, FB, LinkedIn, Web), conformité APIPD native, pricing FCFA adapté au marché local, PWA offline pour zones à connectivité faible.""")
    P("""<b>Faiblesses :</b> Startup sans notoriété établie, équipe technique limitée initialement, dépendance aux sources externes (Google, Facebook), risque de blocage anti-scraping, pas de données historiques.""")
    P("""<b>Opportunités :</b> Marché ivoirien en forte digitalisation, expansion régionale (CEDEAO, 15 pays), partenariats télécoms (Orange, MTN), programmes gouvernementaux de digitalisation, demande croissante de données B2B, marché Mobile Money pour facturation.""")
    P("""<b>Menaces :</b> Durcissement anti-scraping (Google, Facebook), évolution réglementaire (RGPD africain), concurrence internationale (Apollo, Lusha), instabilité économique régionale, risque de coupure réseau (infrastructure CI).""")

def extend_ch2():
    PB()
    h2("2.6 Matrice des objectifs par stakeholder")
    table(
        ["Stakeholder", "Objectifs principaux", "KPIs associés"],
        [
            ["Product Owner", "Produit utilisable et utile", "NPS > 50, DAU/MAU > 40%"],
            ["Développeurs", "Code maintenable, scalable", "Couverture tests > 80%, dette technique < 10%"],
            ["Utilisateurs (Agent)", "Trouver entreprises rapidement", "Temps de recherche < 30s, précision > 90%"],
            ["Utilisateurs (Manager)", "Vue d'équipe, exports", "Temps export < 5s, qualité données > 85%"],
            ["Utilisateurs (Owner)", "ROI, facturation, contrôle", "MRR growth > 10%/mois, churn < 5%"],
            ["Investisseurs", "Croissance et rentabilité", "ARR, CAC < 50k FCFA, LTV/CAC > 3"],
            ["Régulateur (APIPD)", "Conformité protection données", "0 violation, audit conforme"],
        ],
        col_widths=[3*cm, 6*cm, 5.5*cm],
    )

def extend_ch3():
    PB()
    h2("3.15 Spécifications détaillées par module complémentaire")
    h3("3.15.1 Module Cartographie Avancée")
    P("""Le module de cartographie avancée offre des capacités d'analyse géospatiale au-delà de la simple affichage de marqueurs. Il intègre des couches de heatmap, des filtres par rayon, des calculs de distance haversine, et des clusters dynamiques.""")
    table(
        ["Fonctionnalité", "Description", "Technologie", "Performance"],
        [
            ["Heatmap", "Visualisation de la densité d'entreprises par zone", "leaflet.heat", "60 points < 100ms"],
            ["Rayon de recherche", "Cercle cliquable avec rayon configurable (1-30 km)", "Leaflet Circle", "Instantané"],
            ["Distance haversine", "Calcul de distance entre 2 points GPS", "Formule haversine JS", "< 1ms pour 100 calculs"],
            ["Clusters dynamiques", "Regroupement automatique des marqueurs proches", "MarkerCluster", "500 marqueurs fluide"],
            ["Filtres géo", "Filtrage par commune, ville, quartier", "PostGIS / JS", "< 200ms"],
            ["Export carte", "Capture PNG de la carte avec marqueurs", "leaflet-image", "< 3s"],
            ["Layers multiples", "Couches OSM, satellite, heatmap toggle", "Leaflet tile layers", "Switch < 500ms"],
        ],
        col_widths=[3*cm, 5*cm, 3.5*cm, 3*cm],
    )
    h3("3.15.2 Module Assistant IA Conversationnel")
    P("""L'assistant IA conversationnel permet aux utilisateurs de formuler des requêtes en langage naturel et de recevoir des résultats pertinents avec une réponse en langage naturel. Il utilise le LLM z-ai (GLM-4) pour l'analyse d'intention et la génération de réponses.""")
    table(
        ["Composant", "Description", "Modèle IA", "Latence"],
        [
            ["Analyse d'intention", "Extrait secteur, ville, commune, filtres depuis le langage naturel", "GLM-4 (z-ai)", "2-5s"],
            ["Fallback déterministe", "Analyse par règles si LLM indisponible", "Règles + synonymes", "< 100ms"],
            ["Recherche Elasticsearch", "Recherche BM25 avec fuzzy matching sur 76+ entreprises", "In-memory ES", "< 50ms"],
            ["Génération réponse", "Réponse en langage naturel à partir des résultats", "GLM-4 (z-ai)", "2-5s"],
            ["Suggestions contextuelles", "Suggestions de requêtes suivantes basées sur l'analyse", "Heuristiques", "< 10ms"],
        ],
        col_widths=[3*cm, 5*cm, 3.5*cm, 2.5*cm],
    )
    h3("3.15.3 Module Architecture IA Multi-Agents")
    P("""L'architecture multi-agents orchestre 10 agents spécialisés qui collaborent dans un pipeline coordonné. Chaque agent a un rôle précis, des entrées/sorties définies, et des mécanismes de reprise sur erreur.""")
    P("""Le pipeline s'exécute en 9 phases, avec une branche parallèle pour les agents 5 (Enrichissement) et 6 (Validation) qui s'exécutent simultanément après l'agent 4 (Déduplication). L'agent 7 (Géocodage) attend la complétion des deux agents parallèles avant de démarrer.""")
    table(
        ["Agent", "Rôle", "Dépendances", "Critique", "Retry"],
        [
            ["1. Sources", "Sélectionne les sources de données", "Aucune", "Oui", "3"],
            ["2. Scraping", "Collecte les données brutes", "Agent 1", "Oui", "3"],
            ["3. Nettoyage", "Normalise et corrige", "Agent 2", "Oui", "2"],
            ["4. Dédup", "Détecte et fusionne doublons", "Agent 3", "Oui", "2"],
            ["5. Enrichissement", "Complète via LLM", "Agent 4", "Non", "2"],
            ["6. Validation", "Vérifie qualité", "Agent 4", "Non", "2"],
            ["7. Géocodage", "Adresses → GPS", "Agents 5+6", "Non", "2"],
            ["8. Classification", "Détecte secteur", "Agent 7", "Non", "2"],
            ["9. Scoring", "Score qualité 0-100", "Agent 8", "Non", "1"],
            ["10. Export", "Fichiers + notifications", "Agent 9", "Non", "2"],
        ],
        col_widths=[2.5*cm, 4*cm, 2.5*cm, 1.5*cm, 1*cm],
    )
    h3("3.15.4 Module SaaS Enterprise")
    P("""Le module SaaS Enterprise gère les licences activables, les abonnements, la facturation en FCFA, le quota temps réel, et les clés API. Il supporte 4 plans (Starter, Pro, Enterprise, Custom) avec des limites différentes par plan.""")
    table(
        ["Plan", "Prix/mois", "Users", "Entreprises", "API calls", "Exports", "Sources", "Workspaces"],
        [
            ["Starter", "25 000 FCFA", "3", "5 000", "25 000", "30", "3", "1"],
            ["Pro", "85 000 FCFA", "20", "50 000", "100 000", "100", "6", "5"],
            ["Enterprise", "250 000 FCFA", "100", "500 000", "1 000 000", "1 000", "10", "20"],
            ["Custom", "Sur devis", "∞", "∞", "∞", "∞", "∞", "∞"],
        ],
        col_widths=[2*cm, 2.5*cm, 1.5*cm, 2*cm, 2*cm, 1.5*cm, 1.5*cm, 2*cm],
    )

def extend_ch4():
    PB()
    h2("4.10 Architecture de monitoring et observabilité")
    P("""Le monitoring de ScrapIQ CI repose sur une stack complète d'observabilité couvrant les métriques, les logs et les traces distributées. Cette stack permet de détecter proactivement les anomalies, diagnostiquer les incidents, et optimiser les performances.""")
    table(
        ["Couche", "Outil", "Métriques surveillées", "Alerte seuil"],
        [
            ["Infrastructure", "Prometheus + Grafana", "CPU, RAM, disque, réseau", "CPU > 80%, RAM > 85%"],
            ["Application", "Sentry", "Erreurs JS/Python, crashes", "Taux erreur > 1%"],
            ["API", "Middleware logging", "Latence, statut HTTP, throughput", "P95 > 500ms"],
            ["Base de données", "Prisma logging + pg_stat", "Query time, connections", "Query > 1s"],
            ["Scraping", "BullMQ monitoring", "Queue length, job duration, failures", "Queue > 50 jobs"],
            ["Sécurité", "Security module logs", "Rate limit hits, WAF blocks, DDoS", "WAF blocks > 10/h"],
            ["Uptime", "UptimeRobot", "HTTP status, response time", "Downtime > 1 min"],
            ["UX", "Hotjar (V2)", "Session recordings, heatmaps", "Drop-off > 50%"],
        ],
        col_widths=[2.5*cm, 3*cm, 5*cm, 4*cm],
    )
    h2("4.11 Architecture de scaling")
    P("""ScrapIQ CI est conçu pour scaler horizontalement. Chaque composant peut être répliqué indépendamment pour absorber la charge croissante.""")
    table(
        ["Composant", "Scaling", "Min", "Max", "Trigger"],
        [
            ["Next.js app", "Horizontal (pods K8s)", "2", "20", "CPU > 70%"],
            ["API routes", "Horizontal (pods K8s)", "2", "15", "RPS > 1000"],
            ["Scraper workers", "Horizontal (BullMQ)", "2", "50", "Queue > 20 jobs"],
            ["PostgreSQL", "Read replicas", "1 primaire", "5 replicas", "Query/sec > 500"],
            ["Redis", "Cluster mode", "1", "6 shards", "Memory > 70%"],
            ["Elasticsearch", "Horizontal", "1", "5 nodes", "Index size > 10M docs"],
        ],
        col_widths=[3*cm, 3*cm, 2*cm, 2.5*cm, 4*cm],
    )

def extend_ch5():
    PB()
    h2("5.10 Cas d'utilisation avancés")
    h3("5.10.1 UC-15 : Owner configure une licence d'entreprise")
    table(
        ["Étape", "Action", "Système", "Résultat"],
        [
            ["1", "Owner clique 'SaaS Enterprise' dans sidebar", "Affiche vue SaaS", "8 onglets visibles"],
            ["2", "Clique 'Générer licence' → plan Enterprise", "Génère clé SQCI-XXXX-XXXX-XXXX", "Licence créée (inactive)"],
            ["3", "Owner copie la clé et l'envoie au client", "Clé dans presse-papier", "Clé prête à activer"],
            ["4", "Client saisit la clé + son org ID", "Valide la clé (statut, expiration)", "Clé valide"],
            ["5", "Client clique 'Activer'", "Active licence + crée abonnement + met à jour org plan", "Licence active, plan Enterprise"],
            ["6", "Système vérifie quota Enterprise", "100 users, 500k entreprises, 1M API", "Quotas appliqués"],
        ],
        col_widths=[1*cm, 4*cm, 5*cm, 4.5*cm],
    )
    h3("5.10.2 UC-16 : Manager lance un pipeline multi-agents")
    table(
        ["Étape", "Action", "Système", "Résultat"],
        [
            ["1", "Manager clique 'IA Multi-Agents' dans sidebar", "Affiche vue agents", "10 agents visibles + formulaire"],
            ["2", "Saisit 'restaurant' + 'Abidjan' + 'Cocody'", "Validation entrées", "Formulaire valide"],
            ["3", "Clique 'Lancer le pipeline'", "Crée job + démarre orchestrator", "Pipeline running"],
            ["4", "Agent 1 (Sources) s'exécute", "Analyse requête → 5 sources sélectionnées", "Sources: Google Maps, FB, LinkedIn, Web, RCCM"],
            ["5", "Agent 2 (Scraping) collecte", "Scrape parallèle 5 sources", "65 entreprises brutes collectées"],
            ["6", "Agent 3 (Nettoyage) normalise", "Normalise tél/email/noms/adresses", "65 entreprises nettoyées"],
            ["7", "Agent 4 (Dédup) fusionne", "Embeddings + Jaro-Winkler + GPS", "52 entreprises uniques"],
            ["8", "Agents 5+6 (parallèle)", "Enrichissement IA + Validation", "52 enrichies + validées"],
            ["9", "Agent 7 (Géocodage)", "GPS + liens Google Maps", "52 géocodées"],
            ["10", "Agent 8 (Classification)", "18 secteurs, hybride règles+LLM", "52 classifiées"],
            ["11", "Agent 9 (Scoring)", "7 dimensions → score 0-100", "52 scorées (avg 78)"],
            ["12", "Agent 10 (Export)", "Génère xlsx + notifie", "Export + notification envoyée"],
        ],
        col_widths=[1*cm, 3.5*cm, 5*cm, 5*cm],
    )

def extend_ch6():
    PB()
    h2("6.11 Wireframes — Vues additionnelles")
    h3("6.11.1 Vue Architecture Distribuée")
    P("""Cette vue affiche le monitoring temps réel des queues BullMQ et des workers. Elle est organisée en 4 sections principales : statut Redis, métriques globales (7 cartes), cartes de queues (5 queues avec stats détaillées), et liste des workers (13 workers avec statut busy/idle). Un bouton 'Tester les queues' envoie 5 jobs de test simultanés. Un auto-refresh (2 secondes) met à jour les métriques en temps réel.""")
    h3("6.11.2 Vue Centre de Sécurité")
    P("""Le Centre de Sécurité est organisé en 10 onglets : Vue d'ensemble (8 cartes), Rate Limiting (6 configs avec barres de progression), WAF (10 règles + bouton tester), DDoS (IPs bloquées), Captcha (stats + exemple), Journalisation (feed temps réel), Audit (blockchain immuable), Chiffrement (AES-256-GCM + masquage), RGPD (checklist conformité APIPD), Protection API (7 headers + CORS + CSP). Un badge 'Score: 85/100' est affiché dans le header.""")
    h3("6.11.3 Vue SaaS Enterprise")
    P("""La vue SaaS Enterprise contient 8 onglets : Vue d'ensemble (6 KPIs + plans), Licences (générer + activer + liste), Plans (4 cards avec prix FCFA), Quota (4 barres avec %), Utilisateurs (5 rôles RBAC), Permissions (matrice 6×5), API Keys (créer + révoquer + scopes), Facturation (factures INV-XXXX + TVA 18%). Tous les montants sont en FCFA avec support Mobile Money (Orange Money, MTN MoMo, Moov).""")
    h3("6.11.4 Vue IA Multi-Agents")
    P("""La vue IA Multi-Agents affiche : un formulaire de lancement (query, city, commune), une barre de progression (X/10 agents terminés), une liste des 10 agents avec statut temps réel (pending/running/completed/failed/skipped), un flux d'événements (console noire colorée), les données partagées (shared state), et un diagramme d'architecture avec flux séquentiel + branche parallèle.""")

def extend_ch7():
    PB()
    h2("7.6 Diagrammes UML complémentaires")
    h3("7.6.1 Diagramme de déploiement")
    P("""Le diagramme de déploiement montre la répartition physique des composants sur les serveurs :""")
    code_block("""Diagramme de déploiement (texte)

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CDN/Edge      │     │   Load Balancer  │     │   K8s Cluster   │
│  (Cloudflare)   │────▶│   (NGINX/Ingress)│────▶│                 │
│                 │     │                 │     │ ┌─────────────┐ │
│  Static assets  │     │  TLS 1.3        │     │ │ Next.js x4  │ │
│  Images         │     │  Rate limit     │     │ │ pods (API)  │ │
│  WAF rules      │     │  DDoS protect   │     │ └─────────────┘ │
└─────────────────┘     └─────────────────┘     │ ┌─────────────┐ │
                                                │ │ Workers x13 │ │
                                                │ │ (BullMQ)    │ │
                                                │ └─────────────┘ │
┌─────────────────┐     ┌─────────────────┐     └─────────────────┘
│   PostgreSQL    │     │     Redis       │
│   (RDS/Primary) │     │   (Elasticache) │
│   + 2 replicas  │     │   cluster mode  │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   S3/MinIO      │     │   Monitoring    │
│   (Exports)     │     │  Prometheus     │
│   (Backups)     │     │  Grafana        │
└─────────────────┘     │  Sentry         │
                        │  Loki           │
┌─────────────────┐     └─────────────────┘
│   Z.ai API      │
│   (LLM, VLM)    │
└─────────────────┘""")
    h3("7.6.2 Diagramme de composants détaillé")
    table(
        ["Composant", "Technologie", "Responsabilités", "Interfaces"],
        [
            ["Auth Service", "Next.js API + jose + bcrypt", "Login, JWT, 2FA, OAuth, sessions", "POST /api/auth/*"],
            ["Search Engine", "In-memory Elasticsearch", "Index inversé, BM25, fuzzy, aggregations", "POST /api/search"],
            ["Scraping Engine", "Playwright + stealth", "Scraping Google Maps, FB, LinkedIn, Web", "POST /api/scraper/*"],
            ["IA Cleaner", "z-ai SDK + pgvector", "Dédup, enrichissement, scoring, fermetures", "POST /api/scraper/ai-cleaner"],
            ["Export Engine", "xlsx + json2csv + JSZip + PDF", "Excel, CSV, PDF, JSON, ZIP multi-format", "POST /api/export"],
            ["Notification Engine", "Multi-provider (6 canaux)", "Email, SMS, WhatsApp, push, webhook, in-app", "POST /api/v1/notifications"],
            ["Queue Manager", "BullMQ + Redis (fallback mémoire)", "5 queues, 13 workers, retry, priorités", "GET /api/v1/queue"],
            ["Security Module", "WAF + DDoS + captcha + audit", "10 règles WAF, rate limiting, blockchain audit", "GET /api/v1/security"],
            ["SaaS Engine", "Prisma + licences + facturation", "Licences, abonnements, quota, API keys", "GET/POST /api/v1/saas"],
            ["Agent Orchestrator", "10 agents spécialisés", "Pipeline coordonné, checkpoint, reprise", "POST /api/v1/agents"],
        ],
        col_widths=[2.5*cm, 3.5*cm, 5*cm, 3.5*cm],
    )

def extend_ch8():
    PB()
    h2("8.5 Diagrammes Mermaid complémentaires")
    h3("8.5.1 Diagramme d'état — Job de scraping")
    code_block("""stateDiagram-v2
    [*] --> Queued: POST /api/scraper
    Queued --> Running: Worker pickup
    Running --> Completed: Success
    Running --> Failed: Error
    Running --> Cancelled: User cancel
    Failed --> Queued: Retry (max 3)
    Failed --> [*]: Max retries
    Completed --> [*]
    Cancelled --> [*]""")

    h3("8.5.2 Diagramme de séquence — Authentification 2FA")
    code_block("""sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant A as Auth API
    participant D as Database
    participant T as TOTP

    U->>F: Email + Mot de passe
    F->>A: POST /api/auth/login
    A->>D: Lookup user
    D-->>A: User (2FA enabled)
    A-->>F: { requiresTwoFactor: true, userId }
    F->>U: Demande code 2FA
    U->>T: Open Google Authenticator
    T-->>U: 6-digit code
    U->>F: Code 2FA
    F->>A: POST /api/auth/verify-2fa
    A->>T: Verify TOTP
    T-->>A: Valid
    A->>D: Create session + tokens
    D-->>A: Session created
    A-->>F: Set cookies (access + refresh)
    F-->>U: Redirect to dashboard""")

    h3("8.5.3 Diagramme de flux — Pipeline IA multi-agents")
    code_block("""flowchart TD
    A[Requête utilisateur] --> B[Agent 1: Sources]
    B --> C[Agent 2: Scraping]
    C --> D[Agent 3: Nettoyage]
    D --> E[Agent 4: Déduplication]

    E --> F[Agent 5: Enrichissement]
    E --> G[Agent 6: Validation]

    F --> H[Agent 7: Géocodage]
    G --> H

    H --> I[Agent 8: Classification]
    I --> J[Agent 9: Scoring]
    J --> K[Agent 10: Export]

    style F fill:#06b6d4,stroke:#06b6d4
    style G fill:#ef4444,stroke:#ef4444
    style F fill:#06b6d4,stroke:#06b6d4
    style K fill:#a16207,stroke:#a16207""")

def extend_ch9():
    PB()
    h2("9.11 API — Endpoints de monitoring et santé")
    table(
        ["Endpoint", "Méthode", "Description", "Auth"],
        [
            ["/api/v1", "GET", "Info API (version, endpoints, auth methods)", "Non"],
            ["/api/v1/docs", "GET", "Spec OpenAPI 3.0.3 (JSON)", "Non"],
            ["/api/v1/docs/ui", "GET", "Swagger UI interactif (HTML)", "Non"],
            ["/api/v1/queue", "GET", "Metrics queues (waiting, active, completed, failed)", "Oui"],
            ["/api/v1/queue?view=workers", "GET", "Stats workers (busy, idle, error, uptime)", "Oui"],
            ["/api/v1/queue", "POST", "Ajoute un job ou lance un test (5 jobs)", "Oui"],
            ["/api/v1/security", "GET", "Overview sécurité (9 modules)", "Oui"],
            ["/api/v1/security?view=events", "GET", "Événements de sécurité (filtrés)", "Oui"],
            ["/api/v1/security?view=audit", "GET", "Trail d'audit (blockchain)", "Oui"],
            ["/api/v1/security?view=waf", "GET", "Règles WAF (10 règles)", "Oui"],
            ["/api/v1/security?view=ddos", "GET", "IPs bloquées (DDoS)", "Oui"],
            ["/api/v1/security?view=gdpr", "GET", "Demandes RGPD/APIPD", "Oui"],
            ["/api/v1/security", "POST", "Actions (test WAF, create GDPR, simulate attack)", "Oui"],
            ["/api/v1/saas", "GET", "Overview SaaS (stats + plans + licences)", "Oui"],
            ["/api/v1/saas?view=quota", "GET", "Quota organisation (usage temps réel)", "Oui"],
            ["/api/v1/saas?view=api-keys", "GET", "Liste clés API", "Oui"],
            ["/api/v1/saas?view=billing", "GET", "Factures", "Oui"],
            ["/api/v1/saas", "POST", "Actions (generate/activate license, create/revoke key, invoice)", "Oui"],
            ["/api/v1/agents", "GET", "Définitions des 10 agents", "Oui"],
            ["/api/v1/agents", "POST", "Lance pipeline multi-agents", "Oui"],
            ["/api/v1/agents/[id]", "GET", "État pipeline en cours", "Oui"],
            ["/api/v1/notifications", "GET", "Liste notifications (paginée)", "Oui"],
            ["/api/v1/notifications/test", "POST", "Test multi-canal (5 canaux)", "Oui"],
            ["/api/v1/notifications/stats", "GET", "Stats par canal/statut", "Oui"],
            ["/api/v1/alerts", "GET", "Liste règles d'alerte", "Oui"],
            ["/api/v1/alerts/check", "POST", "Évaluation manuelle des alertes", "Oui"],
            ["/api/v1/reports", "GET", "Liste rapports planifiés", "Oui"],
            ["/api/v1/reports/[id]/run", "POST", "Génération manuelle d'un rapport", "Oui"],
            ["/api/v1/export", "GET", "Liste jobs d'export", "Oui"],
            ["/api/v1/export", "POST", "Lance un export (5 formats)", "Oui"],
            ["/api/v1/export/bulk", "POST", "Export massif multi-formats ZIP", "Oui"],
            ["/api/v1/export/[id]", "GET", "État + téléchargement export", "Oui"],
            ["/api/search", "POST", "Recherche intelligente (IA + ES)", "Oui"],
            ["/api/assistant", "POST", "Assistant IA conversationnel", "Oui"],
        ],
        col_widths=[4.5*cm, 1.5*cm, 7*cm, 1.5*cm],
    )

def extend_ch10():
    PB()
    h2("10.6 Optimisations PostgreSQL avancées")
    P("""ScrapIQ CI utilise PostgreSQL 16 avec plusieurs optimisations Enterprise pour supporter la volumétrie (100K+ entreprises, 1M+ logs) tout en maintenant des performances optimales.""")
    table(
        ["Optimisation", "Description", "Impact"],
        [
            ["Partitionnement", "Tables logs partitionnées par mois (RANGE sur created_at)", "Requêtes 10x plus rapides sur période récente"],
            ["Index HNSW (pgvector)", "Index vectoriel pour recherche ANN (dédup IA)", "Recherche similarité < 10ms sur 10M vecteurs"],
            ["Index GIN trigramme", "gin_trgm_ops sur name pour fuzzy matching", "Recherche floue < 50ms"],
            ["Row-Level Security", "Isolation multi-tenant au niveau moteur", "Sécurité garantie, pas de fuite tenant"],
            ["Connection pooling", "PgBouncer en mode transaction", "Support 200+ connexions concurrentes"],
            ["Read replicas", "1 primaire + 2 replicas synchrones", "Read throughput x3"],
            ["VACUUM automatique", "autovacuum agressif (scale_factor 0.05)", "Pas de bloat sur tables à écriture intensive"],
            ["Index partiels", "Index sur conditions (WHERE deleted_at IS NULL)", "Index plus petits, plus rapides"],
        ],
        col_widths=[3*cm, 6.5*cm, 5*cm],
    )

def extend_ch11():
    PB()
    h2("11.9 Conformité réglementaire détaillée")
    h3("11.9.1 Loi n°2013-450 (Côte d'Ivoire)")
    table(
        ["Article", "Exigence", "Implémentation ScrapIQ CI"],
        [
            ["Art. 3", "Consentement pour collecte de données personnelles", "Données publiques uniquement (pas de données personnelles nominatives)"],
            ["Art. 7", "Droit d'accès aux données", "API /api/v1/saas?view=gdpr (type: access)"],
            ["Art. 8", "Droit de rectification", "API /api/v1/companies PUT (modification)"],
            ["Art. 9", "Droit à l'effacement", "Soft delete + anonymisation (deleted_at)"],
            ["Art. 12", "Notification de violation (72h)", "Webhook + email automatique + audit log"],
            ["Art. 15", "Registre des traitements", "Audit blockchain (immutable, hash chaîné SHA-256)"],
            ["Art. 17", "Sécurité des données", "AES-256-GCM + bcrypt + TLS 1.3 + WAF"],
            ["Art. 20", "Declaration à l'APIPD", "Documentation + registre de traitement intégré"],
        ],
        col_widths=[2*cm, 5.5*cm, 7*cm],
    )

def extend_ch12():
    PB()
    h2("12.6 Strategy de disaster recovery")
    table(
        ["Scénario", "RTO", "RPO", "Strategy"],
        [
            ["Perte serveur app", "< 5 min", "0", "K8s auto-restart sur autre node"],
            ["Perte base PostgreSQL", "< 30 min", "< 5 min", "Failover vers replica synchrone"],
            ["Perte Redis", "< 1 min", "< 1 min", "Fallback mémoire automatique"],
            ["Perte zone cloud", "< 2h", "< 15 min", "Multi-AZ, restauration backup"],
            ["Perte datacenter", "< 4h", "< 1h", "DRP multi-région, backup S3 cross-region"],
            ["Corruption données", "< 1h", "< 15 min", "PITR (Point-in-Time Recovery) via WAL"],
            ["Ransomware", "< 4h", "< 1h", "Backup immutable + restoration propre"],
        ],
        col_widths=[3.5*cm, 2*cm, 2*cm, 6.5*cm],
    )

def extend_ch13():
    PB()
    h2("13.6 Strategy de test E2E")
    table(
        ["Test", "Outil", "Couverture", "Fréquence"],
        [
            ["Login + logout", "Playwright", "Email/password + 2FA + OAuth", "Chaque PR"],
            ["Recherche multicritère", "Playwright", "Recherche par mot-clé, filtre, tri", "Chaque PR"],
            ["Scraping Google Maps", "Playwright", "Lancement job + résultats + export", "Quotidien"],
            ["IA Cleaner pipeline", "Playwright", "Lancement + progression + résultats", "Quotidien"],
            ["Carte OpenStreetMap", "Playwright", "Marqueurs + heatmap + rayon", "Hebdomadaire"],
            ["API REST CRUD", "curl/scripts", "Tous les endpoints /api/v1/*", "Chaque PR"],
            ["Export multi-format", "Scripts", "xlsx, csv, json, pdf, zip", "Hebdomadaire"],
            ["RBAC navigation", "Playwright", "Owner vs Agent (sections masquées)", "Chaque PR"],
            ["PWA offline", "Lighthouse", "Service worker + cache + offline", "Hebdomadaire"],
            ["Sécurité (WAF, DDoS)", "OWASP ZAP", "Injection, XSS, path traversal", "Mensuel"],
        ],
        col_widths=[3.5*cm, 2.5*cm, 6*cm, 2.5*cm],
    )

def extend_ch14():
    PB()
    h2("14.6 Planning détaillé — Phase par phase")
    table(
        ["Semaine", "Phase", "Activités", "Livrables"],
        [
            ["S1-S2", "MVP", "Setup projet, Prisma, auth", "Repo Git, DB schema, login"],
            ["S3-S4", "MVP", "Scraping Google Maps (Playwright)", "Scraper fonctionnel"],
            ["S5-S6", "MVP", "Dashboard + KPIs + carte SVG", "Dashboard basique"],
            ["S7-S8", "MVP", "Export Excel + tableau résultats", "Export .xlsx"],
            ["S9-S10", "MVP", "Tests, polish, déploiement", "MVP en production"],
            ["S11-S12", "MVP", "Beta-test (10 utilisateurs)", "Retours + corrections"],
            ["S13-S16", "V1", "Multi-tenant + RBAC + API REST", "API v1 + Swagger"],
            ["S17-S20", "V1", "Scraping FB + LinkedIn + Web", "4 scrapers"],
            ["S21-S24", "V1", "IA Cleaner + Elasticsearch", "Dédup + enrichissement"],
            ["S25-S28", "V1", "Notifications + 2FA + OAuth", "Multi-canal + sécurité"],
            ["S29-S32", "V1", "PWA + tests + déploiement V1", "V1 production"],
            ["S33-S40", "V2", "Architecture distribuée (Redis/BullMQ)", "5 queues + 13 workers"],
            ["S41-S44", "V2", "BI + SaaS Enterprise + Sécurité", "BI + licences + WAF"],
            ["S45-S48", "V2", "Agents IA + Back Office + tests V2", "10 agents + admin"],
            ["S49-S56", "V3", "Assistant IA + VLM + Mobile Money", "Innovation"],
            ["S57-S64", "V3", "Expansion régionale + marketplace", "Sénégal + Mali + API publique"],
        ],
        col_widths=[2*cm, 1.5*cm, 6*cm, 5*cm],
    )

def extend_ch15():
    PB()
    h2("15.6 Budget détaillé par poste (3 ans)")
    table(
        ["Poste", "Année 1", "Année 2", "Année 3", "Total 3 ans"],
        [
            ["Développeurs (4)", "48 M FCFA", "60 M FCFA", "72 M FCFA", "180 M FCFA"],
            ["Infrastructure cloud", "6 M FCFA", "15 M FCFA", "30 M FCFA", "51 M FCFA"],
            ["Licences (z-ai, Sentry...)", "3 M FCFA", "5 M FCFA", "8 M FCFA", "16 M FCFA"],
            ["Marketing + vente", "5 M FCFA", "15 M FCFA", "25 M FCFA", "45 M FCFA"],
            ["Bureaux + admin", "6 M FCFA", "8 M FCFA", "10 M FCFA", "24 M FCFA"],
            ["Légal + conformité", "2 M FCFA", "3 M FCFA", "4 M FCFA", "9 M FCFA"],
            ["Total", "70 M FCFA", "106 M FCFA", "149 M FCFA", "325 M FCFA"],
        ],
        col_widths=[3.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm],
    )
    h3("15.6.1 Projection de revenus (3 ans)")
    table(
        ["Métrique", "Année 1", "Année 2", "Année 3"],
        [
            ["Clients payants", "50", "300", "1000"],
            ["MRR moyen (FCFA)", "85 000", "120 000", "150 000"],
            ["MRR total (FCFA)", "4 250 000", "36 000 000", "150 000 000"],
            ["ARR (FCFA)", "51 000 000", "432 000 000", "1 800 000 000"],
            ["Coûts totaux (FCFA)", "70 000 000", "106 000 000", "149 000 000"],
            ["Résultat (FCFA)", "-19 000 000", "326 000 000", "1 651 000 000"],
            ["Break-even", "Mois 14", "—", "—"],
        ],
        col_widths=[3.5*cm, 3.5*cm, 3.5*cm, 3.5*cm],
    )
