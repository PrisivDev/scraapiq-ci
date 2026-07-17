# -*- coding: utf-8 -*-
"""Chapitre 14 — Planning."""
from cdc_common import *  # noqa: F401,F403


def chapter14():
    chapter_title(14, "Planning")
    intro(
        "Ce chapitre présente le planning du projet ScrapIQ CI : les phases de "
        "développement, le diagramme de Gantt détaillé, et les jalons avec leurs livrables. "
        "Le projet est découpé en quatre phases principales (Cadrage, MVP, V1, V2) "
        "s'étalant sur 18 mois, avec une extension V3 sur 12 mois supplémentaires."
    )

    # ---------------------------------------------------------------- 14.1
    h2("Phases du projet")
    h3("Découpage par phases")
    table(
        ["Phase", "Durée", "Période", "Objectif", "Livrable clé"],
        [
            ["Phase 0 — Cadrage", "3 mois", "Mois 1–3", "Spec + architecture", "Document validé"],
            ["Phase 1 — MVP", "4 mois", "Mois 4–7", "Produit utilisable", "Bêta privée"],
            ["Phase 2 — V1", "5 mois", "Mois 8–12", "Produit commercial", "Lancement"],
            ["Phase 3 — V2", "6 mois", "Mois 13–18", "Agents IA + marketplace", "Release V2"],
            ["Phase 4 — V3", "12 mois", "Mois 19–30", "Expansion régionale", "Présence UEMOA"],
        ],
        col_widths=[3.4 * cm, 1.6 * cm, 2.2 * cm, 4.0 * cm, CONTENT_W - 11.2 * cm],
    )
    h3("Phase 0 — Cadrage (mois 1–3)")
    bullets([
        "Étude de marché approfondie (interviews, questionnaire)",
        "Analyse concurrentielle et positioning",
        "Rédaction du cahier des charges (ce document)",
        "Conception de l'architecture technique",
        "Maquettes UX/UI et validation personas",
        "Mise en place de l'environnement de développement",
    ])
    h3("Phase 1 — MVP (mois 4–7)")
    bullets([
        "Authentification + RBAC (5 rôles)",
        "Scraping Google Maps (Playwright)",
        "IA cleaner : nettoyage + dédoublonnage",
        "Recherche Elasticsearch + UI",
        "Exports Excel/CSV",
        "Tableau de bord + carte OSM",
        "Bêta privée avec 50 utilisateurs pilotes",
    ])
    h3("Phase 2 — V1 (mois 8–12)")
    bullets([
        "Multi-sources (Facebook, LinkedIn, Web)",
        "API REST publique + Swagger",
        "SaaS : plans, facturation, Mobile Money",
        "Notifications multi-canal + WebSocket",
        "Business Intelligence + rapports planifiés",
        "2FA + sécurité entreprise (WAF, audit)",
        "Lancement commercial (100 comptes payants)",
    ])
    h3("Phase 3 — V2 (mois 13–18)")
    bullets([
        "Agents IA multi-agents (10 agents orchestrés)",
        "Marketplace d'intégrations",
        "PWA offline + push natifs",
        "Alertes personnalisées avancées",
        "Scalabilité et optimisations performance",
        "Release V2 publique",
    ])
    h3("Phase 4 — V3 (mois 19–30)")
    bullets([
        "Expansion régionale UEMOA (Sénégal, Mali, Burkina)",
        "Adaptation contextuelle par pays",
        "Modèle de scoring IA personnalisable",
        "Connecteurs CRM/ERP natifs",
        "Module de data marketplace",
    ])

    # ---------------------------------------------------------------- 14.2
    h2("Diagramme de Gantt")
    code_block(
        "gantt\n"
        "    title Planning ScrapIQ CI — 30 mois\n"
        "    dateFormat YYYY-MM\n"
        "    axisFormat %m/%y\n"
        "\n"
        "    section Cadrage\n"
        "    Étude marché        :c1, 2024-01, 1M\n"
        "    Concurrentiel       :c2, after c1, 0.5M\n"
        "    Cahier des charges  :c3, after c2, 1M\n"
        "    Architecture        :c4, after c2, 1M\n"
        "    Maquettes UX        :c5, after c3, 0.5M\n"
        "\n"
        "    section MVP\n"
        "    Auth + RBAC         :m1, after c5, 1M\n"
        "    Scraping Maps       :m2, after m1, 1M\n"
        "    IA cleaner          :m3, after m1, 1M\n"
        "    Recherche ES        :m4, after m3, 0.5M\n"
        "    Exports             :m5, after m4, 0.5M\n"
        "    UI + carte          :m6, after m1, 1.5M\n"
        "    Beta privée         :milestone, mb, after m6, 0d\n"
        "\n"
        "    section V1\n"
        "    Multi-sources      :v1, after mb, 1.5M\n"
        "    API REST + Swagger :v2, after mb, 1M\n"
        "    SaaS + facturation :v3, after v1, 1M\n"
        "    Notifications WS   :v4, after v1, 0.5M\n"
        "    BI + rapports      :v5, after v2, 1M\n"
        "    Sécurité entreprise:v6, after v3, 0.5M\n"
        "    Lancement          :milestone, mc, after v5, 0d\n"
        "\n"
        "    section V2\n"
        "    Agents IA           :w1, after mc, 1.5M\n"
        "    Marketplace         :w2, after w1, 1.5M\n"
        "    PWA offline         :w3, after w1, 0.5M\n"
        "    Alertes avancées    :w4, after w3, 0.5M\n"
        "    Release V2          :milestone, md, after w2, 0d\n"
        "\n"
        "    section V3\n"
        "    Expansion Sénégal   :x1, after md, 3M\n"
        "    Expansion Mali      :x2, after x1, 3M\n"
        "    Expansion Burkina   :x3, after x2, 3M\n"
        "    Connecteurs CRM     :x4, after md, 4M",
        caption_text="Figure 14.1 — Diagramme de Gantt détaillé",
    )
    h3("Lecture du planning")
    table(
        ["Phase", "Mois", "Effectif moyen", "Charge (hommemois)"],
        [
            ["Cadrage", "1–3", "3", "9"],
            ["MVP", "4–7", "4", "16"],
            ["V1", "8–12", "5", "25"],
            ["V2", "13–18", "5", "30"],
            ["V3", "19–30", "6", "72"],
            ["Total", "30", "—", "152"],
        ],
        col_widths=[3.0 * cm, 2.2 * cm, 3.0 * cm, CONTENT_W - 8.2 * cm],
        align_center_cols=[1, 2, 3],
    )

    # ---------------------------------------------------------------- 14.3
    h2("Jalons et livrables")
    h3("Jalons majeurs")
    table(
        ["Jalon", "Mois", "Critère de validation", "Livrables"],
        [
            ["J0 — Cadrage validé", "3", "Comité de pilotage", "CDC, architecture, maquettes"],
            ["J1 — MVP en bêta", "7", "50 pilotes, NPS ≥ 30", "Produit MVP, doc utilisateur"],
            ["J2 — Lancement V1", "12", "100 comptes payants", "V1, API, SaaS, BI"],
            ["J3 — Release V2", "18", "1 800 comptes, agents IA", "V2, marketplace, PWA"],
            ["J4 — Expansion V3", "30", "Présence 3 pays UEMOA", "V3, connecteurs, marketplace data"],
        ],
        col_widths=[3.4 * cm, 1.2 * cm, 5.0 * cm, CONTENT_W - 9.6 * cm],
        align_center_cols=[1],
    )
    h3("Livrables par phase (détail)")
    table(
        ["Phase", "Livrables"],
        [
            ["Cadrage", "Étude marché · CDC · Doc architecture · Maquettes UX · Plan de test · Backlog initial"],
            ["MVP", "Code MVP · Doc API v0 · Guide utilisateur · Plan de bêta · Retours consolidés"],
            ["V1", "Code V1 · Doc API v1 (Swagger) · Doc SaaS · Guide admin · Rapport QA · Site marketing"],
            ["V2", "Code V2 · Doc agents IA · Doc marketplace · Guide intégrateur · Rapport perf"],
            ["V3", "Code V3 · Docs par pays · Connecteurs CRM · Doc marketplace data"],
        ],
        col_widths=[2.4 * cm, CONTENT_W - 2.4 * cm],
    )
    h3("Risques planning et mitigation")
    table(
        ["Risque", "Impact", "Probabilité", "Mitigation"],
        [
            ["Retard intégration multi-sources", "Moyen", "Moyenne", "Prioriser Maps, mock sources tôt"],
            ["Blocage IP d'une source", "Élevé", "Élevée", "Multi-sources, proxies, fallback"],
            ["Performance ES sous volume", "Moyen", "Moyenne", "Tests perf dès le MVP, sharding"],
            ["Adoption bêta lente", "Moyen", "Moyenne", "Programme early-adopter incitatif"],
            ["Dépendance LLM (coût/dispo)", "Moyen", "Moyenne", "Multi-fournisseur, cache, fallback règles"],
            ["Turnover équipe", "Moyen", "Faible", "Documentation, pair programming, Backup"],
        ],
        col_widths=[4.6 * cm, 1.8 * cm, 2.2 * cm, CONTENT_W - 8.6 * cm],
        align_center_cols=[1, 2],
    )
    h3("Gouvernance du projet")
    bullets([
        "Comité de pilotage mensuel (validation jalons, arbitrages)",
        "Revue hebdomadaire d'équipe (avancement, blocages)",
        "Stand-up quotidien (coordination)",
        "Rétrospective bimensuelle (amélioration continue)",
        "Gestion des risques mise à jour mensuellement",
        "Tableau de bord projet (avancement, charge, risques)",
    ])
    info_box(
        "Synthèse du chapitre",
        "Le projet ScrapIQ CI est planifié sur 30 mois en cinq phases (Cadrage, MVP, V1, "
        "V2, V3), jalonnées par des livrables clairs et des critères de validation. La "
        "charge totale est estimée à 152 homme-mois. La gouvernance et la gestion des "
        "risques encadrent l'exécution pour respecter les engagements.",
    )
