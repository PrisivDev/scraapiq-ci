# -*- coding: utf-8 -*-
"""Chapitre 7 — Diagrammes UML."""
from cdc_common import *  # noqa: F401,F403


def chapter7():
    chapter_title(7, "Diagrammes UML")
    intro(
        "Ce chapitre présente les diagrammes UML de la plateforme ScrapIQ CI : diagramme de "
        "cas d'utilisation, diagramme de classes, diagrammes de séquence, diagramme "
        "d'activité, diagramme d'état et diagramme de composants. Les diagrammes sont "
        "décrits en texte structuré accompagné de tables et de représentations ASCII pour "
        "leur lisibilité dans ce document. Les versions Mermaid exploitables figurent au "
        "chapitre 8."
    )

    # ---------------------------------------------------------------- 7.1
    h2("Diagramme de cas d'utilisation")
    P(
        "Le diagramme de cas d'utilisation représente les interactions entre les acteurs "
        "(humains et systèmes) et les cas d'utilisation de la plateforme. Il offre une vue "
        "macro du périmètre fonctionnel et des responsabilités de chaque acteur."
    )
    ascii_diagram([
        "          ┌──────────────────────── ScrapIQ CI ────────────────────────┐",
        "          │                                                             │",
        " Owner ───┤──(Gérer org & facturation)──(Transférer propriété)          │",
        "          │                                                             │",
        " Admin ───┤──(Gérer membres)──(Configurer sécurité)──(Gérer clés API)   │",
        "          │                                                             │",
        " Manager ─┤──(Lancer scraping)──(Lancer agents IA)──(Créer export)      │",
        "          │   «include»→ (Nettoyer IA)   «include»→ (Géocoder)          │",
        "          │                                                             │",
        " Agent ───┤──(Rechercher)──(Lancer scraping simple)──(Exporter limité)  │",
        "          │                                                             │",
        " Viewer ──┤──(Consulter dashboard)──(Rechercher lecture)──(Consulter BI)│",
        "          │                                                             │",
        "          │  Système :                                                   │",
        "          │  (Scraper sources) (Orchestrer agents) (Notifier)           │",
        "          │  (Géocoder OSM) (Facturer) (Indexer ES)                     │",
        "          └─────────────────────────────────────────────────────────────┘",
    ], caption_text="Figure 7.1 — Diagramme de cas d'utilisation (synthèse)")
    h3("Relations d'inclusion et d'extension")
    table(
        ["Cas de base", "Relation", "Cas cible", "Condition"],
        [
            ["Lancer scraping", "«include»", "Nettoyer IA", "Toujours"],
            ["Lancer scraping", "«include»", "Géocoder adresses", "Toujours"],
            ["Lancer agents IA", "«include»", "Lancer scraping", "Toujours"],
            ["Créer export", "«extend»", "Planifier rapport", "Optionnel"],
            ["Rechercher", "«extend»", "Sauvegarder recherche", "Optionnel"],
            ["Gérer membres", "«extend»", "Inviter membre", "Optionnel"],
        ],
        col_widths=[4.0 * cm, 2.4 * cm, 4.6 * cm, CONTENT_W - 11 * cm],
    )

    # ---------------------------------------------------------------- 7.2
    h2("Diagramme de classes")
    P(
        "Le diagramme de classes décrit la structure statique du modèle de données et les "
        "relations entre entités. Il est directement lié au schéma Prisma (chapitre 10)."
    )
    h3("Classes principales et relations")
    ascii_diagram([
        "  ┌──────────────┐      1   N   ┌──────────────┐",
        "  │ Organization │─────────────►│  Workspace   │",
        "  └──────┬───────┘              └──────┬───────┘",
        "         │ 1                            │ 1",
        "         │                              │",
        "         N                              N",
        "  ┌──────▼───────┐              ┌──────▼───────┐",
        "  │     User     │◄─────────────│    Member    │",
        "  └──────┬───────┘   (role)     └──────────────┘",
        "         │ 1                            │",
        "         N                              │",
        "  ┌──────▼───────┐                     │",
        "  │   Session    │                     │",
        "  └──────────────┘                     │",
        "                                       │",
        "  ┌──────────────┐    N   1   ┌────────▼───────┐",
        "  │   Company    │◄───────────│   Workspace   │",
        "  └──────┬───────┘             └────────────────┘",
        "         │ 1",
        "         N",
        "  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────┐",
        "  │  ScrapeJob   │  │  ApiKey      │  │ Notification │",
        "  └──────────────┘  └──────────────┘  └──────────────┘",
    ], caption_text="Figure 7.2 — Diagramme de classes (extrait)")
    h3("Attributs des classes clés")
    table(
        ["Classe", "Attributs principaux", "Relations"],
        [
            ["Organization", "id, name, slug, plan, ownerId, settings", "1→N Workspace, 1→1 User(owner)"],
            ["Workspace", "id, name, slug, organizationId", "N→1 Organization, 1→N Member, 1→N Company"],
            ["User", "id, email, passwordHash, 2FA, status, locale", "1→N Member, 1→N Session, 1→N ApiKey"],
            ["Member", "id, userId, workspaceId, role", "N→1 User, N→1 Workspace"],
            ["Company", "id, name, sector, city, commune, phone, email, gps, score, grade", "N→1 Workspace, 1→N ScrapeJobResult"],
            ["ScrapeJob", "id, query, city, sources, status, results, userId", "N→1 User, 1→N Company"],
            ["ApiKey", "id, name, hash, scopes, expiresAt, userId", "N→1 User"],
            ["Notification", "id, type, payload, channel, status, userId", "N→1 User"],
            ["Subscription", "id, orgId, plan, status, currentPeriodEnd", "N→1 Organization"],
            ["AuditLog", "id, actorId, action, target, metadata, ip, createdAt", "N→1 User"],
        ],
        col_widths=[2.6 * cm, 8.4 * cm, CONTENT_W - 11 * cm],
    )
    h3("Multiplicités et cardinalités")
    bullets([
        "Organization 1 — N Workspace (une org a plusieurs workspaces)",
        "User 1 — N Member (un user peut être membre de plusieurs workspaces)",
        "Workspace 1 — N Company (un workspace contient plusieurs entreprises)",
        "User 1 — N Session (un user a plusieurs sessions actives)",
        "ScrapeJob 1 — N Company (un job produit plusieurs entreprises)",
        "Subscription 1 — 1 Organization (une org a un abonnement courant)",
    ])

    # ---------------------------------------------------------------- 7.3
    h2("Diagrammes de séquence")
    P(
        "Les diagrammes de séquence décrivent les interactions temporelles entre objets pour "
        "réaliser un cas d'utilisation. Trois séquences clés sont détaillées : le lancement "
        "d'un job de scraping, l'authentification avec 2FA, et la création d'un export."
    )
    h3("Séquence 1 — Lancement d'un job de scraping")
    ascii_diagram([
        "User     UI       API      Orchestrator   Worker(Scrap)    ES/DB    NotifWS",
        " │       │        │            │              │             │          │",
        " │──lancer──►│     │            │              │             │          │",
        " │       │──POST /scraping/jobs►│             │             │          │",
        " │       │        │──create job─►│             │             │          │",
        " │       │        │◄──jobId──────│             │             │          │",
        " │       │◄──201──│             │              │             │          │",
        " │       │        │            │──enqueue────►│             │          │",
        " │       │        │            │              │──scrape────►│          │",
        " │       │        │            │              │◄──raw data──│          │",
        " │       │        │            │              │──clean/dedupe           │",
        " │       │        │            │              │──upsert────►│          │",
        " │       │◄───────│────────────│──────────────│──event notif──────────►│",
        " │◄──push WS───────────────────────────────────────────────────────────│",
    ], caption_text="Figure 7.3 — Séquence : lancement d'un job de scraping")
    h3("Séquence 2 — Authentification avec 2FA")
    ascii_diagram([
        "User      UI           API          DB          TOTP",
        " │        │             │            │            │",
        " │──login(email,pwd)──►│             │            │",
        " │        │──verify pwd►│            │            │",
        " │        │             │──load user─►│            │",
        " │        │             │◄──user──────│            │",
        " │        │◄──2FA req───│             │            │",
        " │◄──prompt 2FA         │             │            │",
        " │──submit code───────────────────────────────────►│",
        " │        │             │──verify TOTP│            │",
        " │        │             │◄──ok────────│            │",
        " │        │◄──JWT────────│            │            │",
        " │◄──session            │             │            │",
    ], caption_text="Figure 7.4 — Séquence : authentification 2FA")
    h3("Séquence 3 — Création d'un export")
    table(
        ["Étape", "Émetteur", "Récepteur", "Action"],
        [
            ["1", "User", "UI", "Sélectionne données + format"],
            ["2", "UI", "API", "POST /exports"],
            ["3", "API", "DB", "Crée l'enregistrement Export (status=queued)"],
            ["4", "API", "BullMQ", "Publie le job d'export"],
            ["5", "API", "UI", "Retourne 202 (export en cours)"],
            ["6", "Worker", "DB/ES", "Récupère les données"],
            ["7", "Worker", "FS/Storage", "Génère le fichier (XLSX/CSV/PDF/JSON)"],
            ["8", "Worker", "DB", "Marque Export status=ready, stocke l'URL"],
            ["9", "Worker", "NotifWS", "Émet event export.ready"],
            ["10", "NotifWS", "User", "Push in-app + email"],
        ],
        col_widths=[1.2 * cm, 2.6 * cm, 2.8 * cm, CONTENT_W - 6.6 * cm],
        align_center_cols=[0],
    )

    # ---------------------------------------------------------------- 7.4
    h2("Diagramme d'activité")
    P(
        "Le diagramme d'activité décrit le flux d'activités du pipeline d'agents IA, depuis "
        "la requête utilisateur jusqu'à l'export final."
    )
    ascii_diagram([
        "          ┌─────────────────────┐",
        "          │ Requête utilisateur │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 1 — Sources   │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 2 — Scraping  │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 3 — Nettoyage │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 4 — Dédup     │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "        ┌────────────┴────────────┐  (fork)",
        "        ▼                         ▼",
        " ┌──────────────┐         ┌──────────────┐",
        " │ Agent 5      │         │ Agent 6      │",
        " │ Enrichissement│        │ Validation   │",
        " └──────┬───────┘         └──────┬───────┘",
        "        └────────────┬────────────┘  (join)",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 7 — Géocodage │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 8 — Classif.  │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 9 — Scoring   │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "          ┌─────────────────────┐",
        "          │ Agent 10 — Export   │",
        "          └──────────┬──────────┘",
        "                     ▼",
        "              ◉ (fin)",
    ], caption_text="Figure 7.5 — Diagramme d'activité du pipeline agents IA")

    # ---------------------------------------------------------------- 7.5
    h2("Diagramme d'état")
    P(
        "Le diagramme d'état décrit le cycle de vie d'un job de scraping, de sa création à "
        "sa terminaison."
    )
    ascii_diagram([
        "                ┌──────────┐",
        "        ┌───────│ created  │───────┐ (init)",
        "        │       └──────────┘       │",
        "        ▼                          ▼",
        "  ┌──────────┐   (worker pick)  ┌──────────┐",
        "  │  queued  │─────────────────►│ running  │",
        "  └──────────┘                  └────┬─────┘",
        "        ▲                            │",
        "        │ (retry)                    ├──────►┌──────────┐",
        "        │                            │       │ completed│",
        "        │            (error)         │       └──────────┘",
        "        │       ┌─────────────────►  │",
        "        └───────┤                    │",
        "                ▼                    ├──────►┌──────────┐",
        "           ┌──────────┐              │       │ failed   │",
        "           │  error   │──────────────┘       └──────────┘",
        "           └──────────┘                            │",
        "                                                   │ (abort)",
        "                                                   ▼",
        "                                              ┌──────────┐",
        "                                              │ aborted  │",
        "                                              └──────────┘",
    ], caption_text="Figure 7.6 — Diagramme d'état d'un job de scraping")
    h3("Transitions d'état")
    table(
        ["De", "Vers", "Événement", "Garde"],
        [
            ["—", "created", "POST /scraping/jobs", "Quota suffisant"],
            ["created", "queued", "Publication BullMQ", "—"],
            ["queued", "running", "Worker consomme le job", "—"],
            ["running", "completed", "Succès du pipeline", "—"],
            ["running", "error", "Échec d'une étape", "Retry < 3"],
            ["error", "queued", "Retry avec backoff", "Retry < 3"],
            ["error", "failed", "Épuisement des retries", "Retry ≥ 3"],
            ["running", "aborted", "Annulation utilisateur", "—"],
            ["failed", "queued", "Relance manuelle", "—"],
        ],
        col_widths=[2.4 * cm, 2.4 * cm, 5.0 * cm, CONTENT_W - 9.8 * cm],
    )

    # ---------------------------------------------------------------- 7.6
    h2("Diagramme de composants")
    P(
        "Le diagramme de composants montre les composants logiciels et leurs interfaces "
        "(fournies / requises). Il complète le diagramme d'architecture du chapitre 4."
    )
    ascii_diagram([
        "  ┌──────────────────────┐        ┌──────────────────────┐",
        "  │   Web App (Next.js)   │        │  Notifications WS    │",
        "  │  ─ provides: UI, API  │        │  ─ provides: Push    │",
        "  │  ─ requires: Auth,    │◄──────►│  ─ requires: Events  │",
        "  │    Data, Jobs, Search │        └──────────────────────┘",
        "  └─────┬──────────┬──────┘",
        "        │          │",
        "   ┌────▼────┐ ┌───▼────────┐ ┌─────────────┐",
        "   │  Auth   │ │ Data Layer │ │  Job Queue   │",
        "   │ Service │ │ (Prisma/ES)│ │  (BullMQ)    │",
        "   └─────────┘ └────────────┘ └──────┬──────┘",
        "                                      │",
        "              ┌───────────────────────┼────────────────────┐",
        "              ▼                       ▼                    ▼",
        "  ┌──────────────────┐    ┌────────────────────┐  ┌─────────────────┐",
        "  │ Scraping Workers │    │ Agents Orchestrator│  │ Export Workers  │",
        "  │ ─ req: Sources   │    │ ─ req: LLM, Data   │  │ ─ req: Data, FS │",
        "  └──────────────────┘    └────────────────────┘  └─────────────────┘",
    ], caption_text="Figure 7.7 — Diagramme de composants")
    h3("Interfaces fournies et requises")
    table(
        ["Composant", "Interfaces fournies", "Interfaces requises"],
        [
            ["Web App", "UI, REST API", "Auth, Data, Jobs, Search, Push"],
            ["Auth Service", "AuthN/AuthZ, JWT, OAuth, 2FA", "Data (users)"],
            ["Data Layer", "CRUD, Search", "PostgreSQL, Elasticsearch, Redis"],
            ["Job Queue", "Enqueue, Schedule", "Redis"],
            ["Scraping Workers", "ScrapeResult", "Sources externes, Data"],
            ["Agents Orchestrator", "PipelineResult", "LLM, Data, Jobs"],
            ["Notifications WS", "Push (WS)", "Events (Jobs/Workers)"],
            ["Export Workers", "FileReady", "Data, FS/Storage"],
        ],
        col_widths=[3.4 * cm, 5.0 * cm, CONTENT_W - 8.4 * cm],
    )
    info_box(
        "Synthèse du chapitre",
        "Les six types de diagrammes UML offrent une vue complète et complémentaire du "
        "système : structure statique (classes, composants), comportement dynamique "
        "(séquences, activité, état) et périmètre fonctionnel (cas d'utilisation). "
        "Ensemble, ils constituent la documentation de conception de référence de "
        "ScrapIQ CI.",
    )
