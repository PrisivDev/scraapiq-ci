# -*- coding: utf-8 -*-
"""Chapitre 4 — Architecture technique."""
from cdc_common import *  # noqa: F401,F403


def chapter4():
    chapter_title(4, "Architecture technique")
    intro(
        "Ce chapitre décrit l'architecture technique de ScrapIQ CI sous plusieurs angles "
        "complémentaires : vue d'ensemble, architecture logique (couches et responsabilités), "
        "architecture physique (déploiement et infrastructure), microservices et distribution, "
        "flux de données, et diagrammes d'architecture (rendus en ASCII art et tableaux "
        "structurés). L'architecture vise la scalabilité, la résilience, la sécurité et la "
        "maintenabilité, tout en restant pragmatique pour une mise en œuvre progressive."
    )

    # ---------------------------------------------------------------- 4.1
    h2("Vue d'ensemble")
    P(
        "ScrapIQ CI est une plateforme distribuée construite autour d'une application "
        "Next.js 16 (App Router) qui sert à la fois le frontend React et l'API REST, "
        "complétée par des mini-services spécialisés (workers de scraping, orchestrateur "
        "d'agents IA, service de notifications temps réel via WebSocket) et un ensemble de "
        "stores de données (PostgreSQL via Prisma, Elasticsearch, Redis). L'orchestration "
        "des tâches asynchrones est assurée par BullMQ au-dessus de Redis."
    )
    ascii_diagram([
        "┌─────────────────────────────────────────────────────────────────────┐",
        "│                        CLIENTS (PWA / Navigateur)                   │",
        "│            Desktop · Mobile · API consumers (CRM, ERP)              │",
        "└──────────────────────────────┬──────────────────────────────────────┘",
        "                               │  HTTPS (TLS 1.3)",
        "                ┌──────────────▼──────────────┐",
        "                │   Edge : WAF · Anti-DDoS     │",
        "                │   Rate limiting · Captcha    │",
        "                └──────────────┬──────────────┘",
        "                               │",
        "        ┌──────────────────────▼──────────────────────┐",
        "        │          Application Next.js 16 (App Router) │",
        "        │  ┌────────────┐  ┌─────────────┐  ┌────────┐ │",
        "        │  │  Frontend  │  │  API REST   │  │  Auth  │ │",
        "        │  │  React SSR │  │  /api/v1/*  │  │ JWT/OAuth│ │",
        "        │  └────────────┘  └─────────────┘  └────────┘ │",
        "        └──┬─────────────┬───────────────┬─────────────┘",
        "           │             │               │",
        "   ┌───────▼──────┐ ┌────▼─────┐ ┌────────▼─────────┐",
        "   │  PostgreSQL  │ │  Redis   │ │ Elasticsearch    │",
        "   │  (Prisma)    │ │ (BullMQ) │ │ (recherche/data) │",
        "   └──────────────┘ └────┬─────┘ └──────────────────┘",
        "                         │ jobs",
        "        ┌────────────────┼─────────────────────┐",
        "        ▼                ▼                     ▼",
        "  ┌──────────┐    ┌─────────────┐      ┌──────────────┐",
        "  │ Scraping │    │ Agents IA   │      │ Notifications│",
        "  │ Workers  │    │ Orchestrateur│     │ WebSocket Svc│",
        "  │ (Playwright)│ │ (10 agents) │      │  (port 3003) │",
        "  └────┬─────┘    └──────┬──────┘      └──────────────┘",
        "       │                 │",
        "       ▼                 ▼",
        "  Sources externes    LLM Provider",
        "  (Maps, FB, LI, Web) (enrichissement/scoring)",
    ], caption_text="Figure 4.1 — Architecture globale de ScrapIQ CI")
    h3("Principes d'architecture")
    bullets([
        ("Modularité", ["Frontend, API, workers et services clairement séparés mais co-déployés dans Next.js pour la partie synchrone"]),
        ("Asynchrone par défaut", ["Toutes les tâches longues (scraping, IA, exports) passent par BullMQ pour ne pas bloquer l'API"]),
        ("Résilience", ["Retry, circuit breaker, idempotence, dégradation gracieuse à tous les niveaux"]),
        ("Observabilité", ["Logs structurés JSON, métriques Prometheus, tracing distribué"]),
        ("Sécurité multicouche", ["Edge (WAF/DDoS), application (RBAC/2FA), données (chiffrement)"]),
        ("Scalabilité horizontale", ["Stateless partout où possible, workers scalables indépendamment"]),
    ])

    # ---------------------------------------------------------------- 4.2
    h2("Architecture logique")
    P(
        "L'architecture logique organise le système en couches aux responsabilités "
        "distinctes. Cette séparation facilite la maintenance, les tests et l'évolution. "
        "Chaque couche ne communique qu'avec la couche immédiatement inférieure ou avec des "
        "services latéraux clairement identifiés."
    )
    h3("Les six couches logiques")
    table(
        ["Couche", "Responsabilité", "Technologies"],
        [
            ["Présentation", "UI React, rendu SSR/CSR, PWA", "Next.js 16, React 19, Tailwind 4, shadcn/ui"],
            ["API / Application", "Endpoints REST, validation, orchestration synchrone", "Next.js Route Handlers, Zod"],
            ["Domaine / Métier", "Logique métier : scraping, IA, scoring, RBAC", "Modules TypeScript, agents IA"],
            ["Accès données", "Persistance, recherche, cache", "Prisma, Elasticsearch client, Redis"],
            ["Infrastructure", "Files de jobs, workers, services temps réel", "BullMQ, mini-services Bun"],
            ["Sécurité transverse", "Auth, autorisation, audit, chiffrement", "JWT, OAuth, bcrypt, WAF"],
        ],
        col_widths=[3.0 * cm, 6.5 * cm, CONTENT_W - 9.5 * cm],
    )
    h3("Flux logique d'une requête métier")
    P(
        "Lorsqu'un utilisateur lance un job de scraping, la requête traverse successivement "
        "la couche présentation (formulaire React), la couche API (validation Zod, "
        "authentification JWT, contrôle RBAC), la couche domaine (construction du job, "
        "appel à l'orchestrateur), puis la couche infrastructure qui publie le job dans "
        "BullMQ. Un worker asynchrone consomme le job, exécute le pipeline (scraping + IA), "
        "écrit les résultats en base et dans Elasticsearch, puis émet une notification via "
        "le service WebSocket temps réel. La couche présentation est informée en direct via "
        "WebSocket et rafraîchit l'UI."
    )
    ascii_diagram([
        "  [Présentation]  →  [API REST]  →  [Domaine]  →  [Infrastructure: BullMQ]",
        "        ↑                                              │",
        "        │ WebSocket                              [Worker]",
        "        │                                              │",
        "  [Service Notif. WS]  ←  [Domaine]  ←  [Accès données]",
        "                                              (PG · ES · Redis)",
    ], caption_text="Figure 4.2 — Flux logique d'une requête de scraping")

    # ---------------------------------------------------------------- 4.3
    h2("Architecture physique")
    P(
        "L'architecture physique décrit le déploiement concret des composants sur "
        "l'infrastructure. ScrapIQ CI est conçu pour un déploiement conteneurisé (Docker) "
        "orchestré par Kubernetes, avec une séparation nette entre les services stateless "
        "(scalables horizontalement) et les stores stateful (base, cache, search)."
    )
    h3("Composants déployés")
    table(
        ["Composant", "Type", "Instances (prod)", "Ressources (par instance)"],
        [
            ["App Next.js (web + API)", "Stateless", "3", "1 vCPU, 1 GiB"],
            ["Worker scraping", "Stateless", "2–6 (autoscale)", "1 vCPU, 1,5 GiB"],
            ["Orchestrateur agents IA", "Stateless", "1–3", "1 vCPU, 1 GiB"],
            ["Service notifications WS", "Stateless", "2", "0,5 vCPU, 0,5 GiB"],
            ["PostgreSQL", "Stateful", "1 primaire + 1 réplique", "2 vCPU, 4 GiB"],
            ["Redis", "Stateful", "1 (+ sentinel)", "1 vCPU, 2 GiB"],
            ["Elasticsearch", "Stateful", "3 nœuds", "2 vCPU, 4 GiB"],
            ["Edge (WAF / LB)", "Managé", "—", "—"],
        ],
        col_widths=[4.2 * cm, 2.3 * cm, 4.0 * cm, CONTENT_W - 10.5 * cm],
    )
    h3("Topologie réseau")
    ascii_diagram([
        "                    Internet",
        "                       │",
        "            ┌──────────▼──────────┐",
        "            │  Edge / WAF / LB     │  (TLS termination)",
        "            └──────────┬──────────┘",
        "                       │",
        "        ┌──────────────┴───────────────┐",
        "        ▼                              ▼",
        "  ┌──────────┐                   ┌──────────────┐",
        "  │ Ingress  │                   │  Ingress WS  │",
        "  │  (HTTP)  │                   │  (WebSocket) │",
        "  └────┬─────┘                   └──────┬───────┘",
        "       │                                │",
        "  ┌────▼────┐  ┌────────┐  ┌──────────┐ │",
        "  │ App x3  │  │Worker xN│ │ Orchest. │ │",
        "  │ Next.js │  │Scraping │ │ Agents IA│ │",
        "  └────┬────┘  └────┬────┘  └────┬─────┘ │",
        "       └────────────┼────────────┘       │",
        "                    │                    │",
        "       ┌────────────┼────────────┐       │",
        "       ▼            ▼            ▼       ▼",
        "   ┌────────┐  ┌────────┐  ┌──────────┐ ┌──────────┐",
        "   │  PG    │  │ Redis  │  │  ES x3   │ │ Notif WS │",
        "   └────────┘  └────────┘  └──────────┘ └──────────┘",
    ], caption_text="Figure 4.3 — Topologie réseau physique")
    P(
        "La segmentation réseau isole les stores de données dans un sous-réseau privé non "
        "exposé à Internet ; seuls les services applicatifs y accèdent. Le service de "
        "notifications WebSocket écoute sur un port dédié (3003) exposé via l'Ingress "
        "approprié. Les workers de scraping sortent vers Internet via un NAT avec rotation "
        "d'IP / proxies pour limiter les blocages."
    )

    # ---------------------------------------------------------------- 4.4
    h2("Microservices et distribution")
    P(
        "ScrapIQ CI adopte une approche « modulaire monolithe + mini-services » : l'application "
        "principale (Next.js) est un monolithe modulaire pour la partie synchrone (UI + API), "
        "tandis que les composants intensifs ou temps réel sont extraits en mini-services "
        "indépendants (workers BullMQ, orchestrateur d'agents, service WebSocket). Ce "
        "compromis évite la complexité d'un microservices complet tout en permettant la "
        "scalabilité ciblée des points chauds."
    )
    h3("Mini-services")
    table(
        ["Mini-service", "Rôle", "Port", "Runtime", "Scaling"],
        [
            ["queue-worker", "Consommation des jobs BullMQ (scraping, exports, IA)", "—", "Bun", "Horizontal"],
            ["notifications-ws", "Notifications temps réel via Socket.io", "3003", "Bun", "Horizontal (sticky)"],
            ["agents-orchestrator", "Exécution du pipeline 10 agents", "—", "Worker BullMQ", "Horizontal"],
        ],
        col_widths=[3.6 * cm, 6.0 * cm, 1.5 * cm, 1.8 * cm, CONTENT_W - 12.9 * cm],
        align_center_cols=[2],
    )
    h3("Communication inter-services")
    bullets([
        ("Synchrone", ["API REST interne pour les appels directs entre l'app et les services"]),
        ("Asynchrone", ["BullMQ / Redis pour la file de jobs et les événements"]),
        ("Temps réel", ["Socket.io pour les notifications push vers les clients connectés"]),
        ("Partage d'état", ["Redis pour l'état partagé éphémère (blackboard agents, sessions)"]),
    ])
    h3("Pattern blackboard pour les agents IA")
    P(
        "L'orchestrateur d'agents IA utilise un pattern blackboard : un espace d'état "
        "partagé (objet TypeScript enrichi au fil du pipeline) sert de tableau noir que "
        "chaque agent lit et écrit. Ce découplage permet d'ajouter, réordonner ou "
        "paralléliser des agents sans coupler fortement leurs entrées/sorties. L'état "
        "partagé est également exposé en lecture dans l'UI pour le monitoring temps réel."
    )

    # ---------------------------------------------------------------- 4.5
    h2("Flux de données")
    P(
        "Le flux de données décrit le cheminement d'une donnée depuis sa collecte jusqu'à "
        "sa restitution à l'utilisateur, en passant par toutes les étapes de traitement. "
        "Comprendre ce flux est essentiel pour diagnostiquer les problèmes de qualité et "
        "optimiser les performances."
    )
    h3("Cycle de vie d'une donnée entreprise")
    table(
        ["Étape", "Source → Destination", "Transformation", "Lieu"],
        [
            ["1. Collecte", "Sources → Worker", "Extraction brute (Playwright)", "Worker scraping"],
            ["2. Normalisation", "Brut → Intermédiaire", "Format commun (nom, tél, GPS…)", "Worker"],
            ["3. Nettoyage", "Intermédiaire → Nettoyé", "Normalisation +225, email, nom", "Agent 3"],
            ["4. Dédoublonnage", "Nettoyé → Unique", "Fusion par similarité", "Agent 4"],
            ["5. Enrichissement", "Unique → Enrichi", "LLM + règles", "Agent 5"],
            ["6. Validation", "Unique → Validé", "Regex, MX, HTTP HEAD", "Agent 6"],
            ["7. Géocodage", "Enrichi+Validé → Géocodé", "Nominatim OSM", "Agent 7"],
            ["8. Classification", "Géocodé → Classifié", "Règles + LLM (18 secteurs)", "Agent 8"],
            ["9. Scoring", "Classifié → Scoré", "7 dimensions pondérées", "Agent 9"],
            ["10. Persistance", "Scoré → PostgreSQL + ES", "Upsert + indexation", "Agent 10"],
            ["11. Restitution", "ES → UI / API", "Recherche, carte, export", "App"],
        ],
        col_widths=[2.6 * cm, 4.2 * cm, 4.6 * cm, CONTENT_W - 11.4 * cm],
    )
    h3("Diagramme de flux")
    ascii_diagram([
        "  Sources (Maps/FB/LI/Web)",
        "        │",
        "        ▼",
        "  [Scraper Playwright] ── brut ──► [Normalisation]",
        "                                        │",
        "                                        ▼",
        "                               [Nettoyage IA] ──► [Dédoublonnage]",
        "                                                          │",
        "                          ┌───────────────────────────────┤",
        "                          ▼                               ▼",
        "                   [Enrichissement LLM]          [Validation tech]",
        "                          └───────────────┬───────────────┘",
        "                                          ▼",
        "                                  [Géocodage OSM]",
        "                                          │",
        "                          ┌───────────────┼───────────────┐",
        "                          ▼               ▼               ▼",
        "                  [Classification]   [Scoring]      [Export]",
        "                          └───────┬───────┘               │",
        "                                  ▼                       ▼",
        "                          PostgreSQL + ES            Fichier/Notif",
        "                                  │                       │",
        "                                  ▼                       ▼",
        "                          UI / API REST            Téléchargement",
    ], caption_text="Figure 4.4 — Flux de données de bout en bout")
    h3("Gestion de la cohérence")
    P(
        "La persistance suit un modèle « source de vérité PostgreSQL, index de recherche "
        "Elasticsearch ». Chaque écriture en base déclenche une indexation Elasticsearch "
        "(via événement BullMQ) pour garantir la cohérence à terme. En cas de désynchronisation, "
        "un job de réindexation complet peut être déclenché. Le cache Redis accélère les "
        "lectures fréquentes (sessions, quotas, résultats de recherche courte durée) avec "
        "une TTL adaptée à chaque type de donnée."
    )

    # ---------------------------------------------------------------- 4.6
    h2("Diagrammes d'architecture")
    P(
        "Cette section présente plusieurs diagrammes d'architecture complémentaires, rendus "
        "en ASCII art pour leur lisibilité dans ce document. Les versions Mermaid "
        "exploitables sont disponibles au chapitre 8."
    )
    h3("Diagramme de composants")
    ascii_diagram([
        "┌──────────────────────────────────────────────────────────────┐",
        "│                       ScrapIQ CI (App)                       │",
        "│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │",
        "│  │   UI React  │ │   API REST   │ │   Auth Service         │ │",
        "│  │  (App Router)│ │ /api/v1/*    │ │ JWT·OAuth·2FA·RBAC    │ │",
        "│  └──────┬──────┘ └──────┬───────┘ └───────────┬────────────┘ │",
        "│         │               │                     │              │",
        "│  ┌──────▼───────────────▼─────────────────────▼────────────┐ │",
        "│  │              Domain Services (métier)                   │ │",
        "│  │  Scraping · IA · Search · Map · Export · Notify · SaaS  │ │",
        "│  └──────┬────────────────────────────────────┬─────────────┘ │",
        "│         │                                    │               │",
        "│  ┌──────▼─────────┐                ┌────────▼─────────┐      │",
        "│  │  Data Access    │                │  Job Publisher    │     │",
        "│  │ Prisma·ES·Redis │                │  (BullMQ)         │     │",
        "│  └─────────────────┘                └────────┬─────────┘     │",
        "└──────────────────────────────────────────────┼───────────────┘",
        "                                               │",
        "                              ┌────────────────▼────────────────┐",
        "                              │       Workers (BullMQ)          │",
        "                              │  Scraping · Agents · Exports    │",
        "                              └────────────────┬────────────────┘",
        "                                               │ push",
        "                              ┌────────────────▼────────────────┐",
        "                              │   Notifications Service (WS)    │",
        "                              └─────────────────────────────────┘",
    ], caption_text="Figure 4.5 — Diagramme de composants")
    h3("Diagramme de déploiement (Kubernetes)")
    ascii_diagram([
        "┌─────────────────────── Kubernetes Cluster ───────────────────────┐",
        "│                                                                   │",
        "│  namespace: scraapiq-prod                                         │",
        "│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────────┐  │",
        "│  │ Deployment  │  │ Deployment  │  │   Deployment              │  │",
        "│  │  app-next   │  │  worker-sc  │  │   agents-orchestrator     │  │",
        "│  │  replicas:3 │  │  replicas:3 │  │   replicas:2              │  │",
        "│  └──────┬──────┘  └──────┬──────┘  └────────────┬──────────────┘  │",
        "│         │                │                      │                 │",
        "│  ┌──────▼──────────────────▼──────────────────────▼─────────────┐ │",
        "│  │                     Services / ConfigMaps                    │ │",
        "│  └──────┬──────────────────┬──────────────────────┬─────────────┘ │",
        "│         │                  │                      │               │",
        "│  ┌──────▼─────┐    ┌───────▼──────┐    ┌──────────▼──────────┐    │",
        "│  │ StatefulSet│    │ StatefulSet  │    │   StatefulSet       │    │",
        "│  │ PostgreSQL │    │    Redis     │    │  Elasticsearch x3   │    │",
        "│  └────────────┘    └──────────────┘    └─────────────────────┘    │",
        "│                                                                   │",
        "│  namespace: scraapiq-infra  (Ingress, Cert-Manager, Monitoring)   │",
        "└───────────────────────────────────────────────────────────────────┘",
    ], caption_text="Figure 4.6 — Diagramme de déploiement Kubernetes")
    h3("Matrice de dépendances technologies")
    table(
        ["Besoin", "Technologie choisie", "Justification"],
        [
            ["Framework fullstack", "Next.js 16 (App Router)", "SSR/CSR, API routes, écosystème React"],
            ["Typage", "TypeScript 5", "Sûreté, DX, refactoring"],
            ["UI", "Tailwind 4 + shadcn/ui", "Cohérence visuelle, rapidité"],
            ["Scraping", "Playwright", "Multi-browser, robuste sur sites dynamiques"],
            ["Recherche", "Elasticsearch", "Full-text, fuzzy, géo, agrégations"],
            ["Carte", "Leaflet + OpenStreetMap", "Libre, gratuit, performant"],
            ["Files de jobs", "BullMQ + Redis", "Performant, retries, schedules"],
            ["ORM", "Prisma", "Typé, migrations, multi-DB"],
            ["Auth", "NextAuth.js v4", "Intégré Next.js, OAuth, JWT"],
            ["State client", "Zustand + TanStack Query", "Léger + server state"],
            ["Runtime services", "Bun", "Rapide, TS natif, hot reload"],
            ["Conteneurs", "Docker", "Standard de fait"],
            ["Orchestration", "Kubernetes", "Scalabilité, écosystème"],
            ["Monitoring", "Prometheus + Grafana", "Open source, standard"],
        ],
        col_widths=[3.6 * cm, 4.4 * cm, CONTENT_W - 8 * cm],
    )
    h3("Choix d'architecture justifiés")
    P(
        "Le choix d'un monolithe modulaire Next.js plutôt que des microservices purs dès le "
        "départ s'explique par la volonté de minimiser la complexité opérationnelle tout en "
        "gardant la possibilité d'extraire des services. Les seuls composants extraits en "
        "mini-services sont ceux qui en ont réellement besoin : les workers de scraping "
        "(intensifs CPU/réseau, scalables indépendamment), l'orchestrateur d'agents (longue "
        "durée) et le service WebSocket (connexions persistantes). Cette approche pragmatique "
        "accélère le time-to-market tout en préservant l'évolutivité."
    )
    info_box(
        "Synthèse du chapitre",
        "L'architecture de ScrapIQ CI combine un monolithe modulaire Next.js pour la partie "
        "synchrone et des mini-services spécialisés pour l'asynchrone et le temps réel, le "
        "tout orchestré par BullMQ au-dessus de Redis, avec PostgreSQL comme source de "
        "vérité et Elasticsearch comme moteur de recherche. Cette architecture est "
        "scalable, résiliente, observable et sécurisée, tout en restant pragmatique.",
    )
