# -*- coding: utf-8 -*-
"""Chapitre 2 — Objectifs du projet."""
from cdc_common import *  # noqa: F401,F403


def chapter2():
    chapter_title(2, "Objectifs du projet")
    intro(
        "Ce chapitre formalise les objectifs du projet ScrapIQ CI sur quatre dimensions "
        "complémentaires : fonctionnelle, technique, business et qualité. Il définit "
        "ensuite les indicateurs de performance (KPIs) qui permettront de mesurer l'atteinte "
        "de ces objectifs ainsi que les critères de succès qui encadrent la validation du "
        "projet. Ces objectifs servent de référence tout au long du cycle de vie du projet, "
        "de la conception à la mise en production, et orientent les arbitrages techniques "
        "et fonctionnels."
    )

    # ---------------------------------------------------------------- 2.1
    h2("Objectifs fonctionnels")
    P(
        "Les objectifs fonctionnels décrivent ce que la plateforme doit permettre de réaliser "
        "du point de vue métier. Ils sont exprimés en termes de capacités offerte aux "
        "utilisateurs et traduisent directement les besoins identifiés lors de l'étude de "
        "marché (chapitre 1)."
    )
    table(
        ["Code", "Objectif fonctionnel", "Description", "Module"],
        [
            ["OF-01", "Scraping multi-sources", "Collecter des données business depuis Google Maps, Facebook, LinkedIn, sites web et le RCCM en une seule requête", "Scraping"],
            ["OF-02", "Nettoyage IA", "Normaliser automatiquement numéros (+225), emails, noms d'entreprises et adresses", "IA Cleaner"],
            ["OF-03", "Dédoublonnage intelligent", "Détecter et fusionner les fiches dupliquées avec scoring de confiance", "IA Cleaner"],
            ["OF-04", "Enrichissement", "Compléter description, site web, horaires, réseaux sociaux pour chaque entreprise", "IA Cleaner"],
            ["OF-05", "Classification sectorielle", "Classer chaque entreprise dans l'un des 18 secteurs économiques ivoiriens", "IA Cleaner"],
            ["OF-06", "Scoring de qualité", "Calculer un score 0–100 sur 7 dimensions et une catégorie A/B/C/D", "IA Cleaner"],
            ["OF-07", "Géolocalisation", "Géocoder les adresses et afficher les entreprises sur OpenStreetMap", "Cartographie"],
            ["OF-08", "Recherche multi-critères", "Rechercher par secteur, ville, commune, mot-clé, score, rayon géographique", "Recherche"],
            ["OF-09", "Exports multi-formats", "Exporter en Excel, CSV, PDF, JSON avec sélection de champs", "Exports"],
            ["OF-10", "Notifications", "Notifier l'utilisateur par email, in-app, webhook et push sur les événements clés", "Notifications"],
            ["OF-11", "API REST publique", "Exposer une API versionnée, documentée (Swagger), authentifiée par clé API/JWT", "API REST"],
            ["OF-12", "Authentification sécurisée", "JWT, OAuth Google/Microsoft, 2FA TOTP, gestion de sessions", "Auth"],
            ["OF-13", "RBAC multi-tenant", "Gérer organisations, workspaces, et 5 rôles (Owner, Admin, Manager, Agent, Viewer)", "RBAC"],
            ["OF-14", "PWA mobile", "Offrir une expérience installable, hors-ligne, responsive sur mobile", "PWA"],
            ["OF-15", "Business Intelligence", "Fournir tableaux de bord, heatmaps, rapports planifiés", "BI"],
            ["OF-16", "Plateforme SaaS", "Proposer abonnements, quotas, facturation, licences, marketplace", "SaaS"],
            ["OF-17", "Agents IA multi-agents", "Orchestrer 10 agents spécialisés avec monitoring temps réel", "Agents IA"],
            ["OF-18", "Sécurité globale", "WAF, anti-DDoS, captcha, chiffrement, audit, rate limiting", "Sécurité"],
        ],
        col_widths=[1.2 * cm, 3.6 * cm, 8.4 * cm, CONTENT_W - 13.2 * cm],
    )

    # ---------------------------------------------------------------- 2.2
    h2("Objectifs techniques")
    P(
        "Les objectifs techniques encadrent les choix d'architecture, de performance, de "
        "fiabilité et de maintenabilité. Ils garantissent que la plateforme soit "
        "industrialisable, scalable et capable de supporter la montée en charge prévue par "
        "la roadmap."
    )
    table(
        ["Code", "Objectif technique", "Cible / Métrique"],
        [
            ["OT-01", "Stack moderne et maintainable", "Next.js 16, TypeScript 5, Tailwind 4, shadcn/ui"],
            ["OT-02", "Temps de réponse API (P95)", "< 300 ms pour les endpoints de recherche"],
            ["OT-03", "Temps de scraping moyen", "< 90 s pour 100 entreprises multi-sources"],
            ["OT-04", "Disponibilité (uptime)", "≥ 99,5 % en production"],
            ["OT-05", "Scalabilité horizontale", "Workers BullMQ et API scalable à 10x sans refonte"],
            ["OT-06", "Capacité de la base", "≥ 5 millions d'entreprises indexées sans dégradation"],
            ["OT-07", "Recherche full-text", "Latence < 150 ms sur Elasticsearch, recherche fuzzy + facets"],
            ["OT-08", "Conformité OWASP Top 10", "0 vulnérabilité critique en production"],
            ["OT-09", "Couverture de tests", "≥ 75 % sur la logique métier critique"],
            ["OT-10", "CI/CD automatisé", "Pipeline build + test + déploiement < 15 min"],
            ["OT-11", "Observabilité", "Logs centralisés, métriques, tracing sur 100 % des services"],
            ["OT-12", "Architecture distribuée", "Mini-services indépendants + file BullMQ + Redis"],
            ["OT-13", "Multi-tenant isolé", "Isolation des données par organisation au niveau DB"],
            ["OT-14", "PWA installable", "Lighthouse PWA ≥ 90, support hors-ligne"],
            ["OT-15", "Internationalisation", "i18n FR par défaut, extensible EN"],
        ],
        col_widths=[1.2 * cm, 6.5 * cm, CONTENT_W - 7.7 * cm],
    )
    h3("Principes directeurs de l'architecture")
    bullets([
        ("Séparation des responsabilités", ["Frontend / API / Workers / IA clairement découplés"]),
        ("API-first", ["Toute fonctionnalité exposée via API REST versionnée avant l'UI"]),
        ("Résilience par défaut", ["Retry, circuit breaker, dégradation gracieuse, idempotence"]),
        ("Observabilité native", ["Logging structuré, métriques, tracing dès la conception"]),
        ("Sécurité par conception", ["RBAC, chiffrement, audit, conformité intégrés"]),
        ("Évolutivité", ["Modularité permettant d'ajouter sources, agents et modules sans refonte"]),
    ])

    # ---------------------------------------------------------------- 2.3
    h2("Objectifs business")
    P(
        "Les objectifs business mesurent le succès commercial de ScrapIQ CI. Ils couvrent "
        "l'acquisition, la rétention, la récurrence des revenus et la rentabilité, sur un "
        "horizon de 36 mois."
    )
    table(
        ["Horizon", "Objectif business", "Cible"],
        [
            ["6 mois", "Comptes actifs payants", "150 comptes"],
            ["6 mois", "MRR (Monthly Recurring Revenue)", "≥ 9 M FCFA"],
            ["6 mois", "Taux de conversion essai → payant", "≥ 18 %"],
            ["12 mois", "Comptes actifs payants", "650 comptes"],
            ["12 mois", "MRR", "≥ 45 M FCFA"],
            ["12 mois", "Net Revenue Retention", "≥ 110 %"],
            ["18 mois", "Comptes actifs payants", "1 800 comptes"],
            ["18 mois", "MRR", "≥ 135 M FCFA"],
            ["18 mois", "Marges brutes", "≥ 70 %"],
            ["24 mois", "Comptes actifs payants", "4 500 comptes"],
            ["24 mois", "MRR", "≥ 360 M FCFA"],
            ["24 mois", "Break-even opérationnel", "Atteint"],
            ["36 mois", "Comptes actifs payants", "12 000 comptes"],
            ["36 mois", "ARR", "≥ 6 Mds FCFA"],
            ["36 mois", "Expansion régionale", "Présence dans 3 pays UEMOA"],
        ],
        col_widths=[2.2 * cm, 8.0 * cm, CONTENT_W - 10.2 * cm],
    )
    h3("Objectifs de positionnement et de marque")
    bullets([
        "Devenir la référence du « data business en Côte d'Ivoire » d'ici 24 mois",
        "Être reconnu par l'APIPD comme une solution conforme et exemplaire",
        "Construire une communauté d'utilisateurs et de développeurs (API publique)",
        "Établir des partenariats avec au moins 5 acteurs institutionnels majeurs",
    ])

    # ---------------------------------------------------------------- 2.4
    h2("Indicateurs de performance (KPIs)")
    P(
        "Les KPIs permettent de suivre en continu l'atteinte des objectifs. Ils sont "
        "organisés en cinq familles : acquisition, engagement produit, qualité de la donnée, "
        "performance technique et financier. Chaque KPI possède une cible, une fréquence de "
        "mesure et un responsable."
    )
    h3("KPIs d'acquisition et de croissance")
    table(
        ["KPI", "Définition", "Cible annuelle", "Fréquence"],
        [
            ["Nouveaux comptes", "Comptes créés (tous plans)", "≥ 5 000", "Hebdo"],
            ["MRR", "Revenu récurrent mensuel", "+15 %/mois", "Mensuel"],
            ["ARR", "Revenu récurrent annuel", "Croissance 3x", "Trimestriel"],
            ["CAC", "Coût d'acquisition client", "< 45 000 FCFA", "Mensuel"],
            ["LTV", "Vie utile client (revenu)", "≥ 270 000 FCFA", "Trimestriel"],
            ["LTV/CAC", "Ratio de rentabilité acquisition", "≥ 6", "Trimestriel"],
            ["Taux de churn", "Annulations / total", "< 3 %/mois", "Mensuel"],
        ],
        col_widths=[3.0 * cm, 6.5 * cm, 4.0 * cm, CONTENT_W - 13.5 * cm],
        align_center_cols=[2, 3],
    )
    h3("KPIs d'engagement produit")
    table(
        ["KPI", "Définition", "Cible", "Fréquence"],
        [
            ["DAU/MAU", "Ratio d'utilisation quotidienne", "≥ 25 %", "Hebdo"],
            ["Jobs de scraping / compte", "Nombre moyen par mois", "≥ 12", "Mensuel"],
            ["Exports générés / compte", "Nombre moyen par mois", "≥ 8", "Mensuel"],
            ["Requêtes API / compte", "Consommation API moyenne", "≥ 500", "Mensuel"],
            ["Adoption 2FA", "Comptes avec 2FA activé", "≥ 35 %", "Mensuel"],
            ["NPS", "Net Promoter Score", "≥ 40", "Trimestriel"],
        ],
        col_widths=[3.4 * cm, 6.1 * cm, 3.2 * cm, CONTENT_W - 12.7 * cm],
        align_center_cols=[2, 3],
    )
    h3("KPIs de qualité de la donnée")
    table(
        ["KPI", "Définition", "Cible", "Fréquence"],
        [
            ["Taux de remplissage", "Champs non vides / champs attendus", "≥ 85 %", "Hebdo"],
            ["Taux de doublons résiduels", "Doublons après traitement IA", "< 2 %", "Hebdo"],
            ["Taux de géocodage", "Adresses géocodées avec succès", "≥ 92 %", "Hebdo"],
            ["Taux de numéros valides", "Numéros +225 au format valide", "≥ 95 %", "Hebdo"],
            ["Score qualité moyen", "Moyenne des scores 0–100", "≥ 72", "Mensuel"],
            ["Fraîcheur moyenne", "Ancienneté moyenne des données", "< 90 jours", "Mensuel"],
        ],
        col_widths=[3.6 * cm, 5.9 * cm, 3.2 * cm, CONTENT_W - 12.7 * cm],
        align_center_cols=[2, 3],
    )
    h3("KPIs de performance technique")
    table(
        ["KPI", "Définition", "Cible", "Fréquence"],
        [
            ["Uptime", "Disponibilité mensuelle", "≥ 99,5 %", "Mensuel"],
            ["Latence API P95", "95e percentile temps de réponse", "< 300 ms", "Quotidien"],
            ["Taux d'erreur API", "Réponses 5xx / total", "< 0,5 %", "Quotidien"],
            ["Taux de succès scraping", "Jobs terminés sans erreur", "≥ 96 %", "Quotidien"],
            ["MTTR", "Temps moyen de résolution incident", "< 2 h", "Par incident"],
            ["Couverture tests", "Couverture code métier", "≥ 75 %", "Par release"],
        ],
        col_widths=[3.2 * cm, 6.3 * cm, 3.2 * cm, CONTENT_W - 12.7 * cm],
        align_center_cols=[2, 3],
    )

    # ---------------------------------------------------------------- 2.5
    h2("Critères de succès")
    P(
        "Les critères de succès définissent les conditions objectives d'acceptation du "
        "projet à ses principales étapes. Ils sont validés par le comité de pilotage et "
        "conditionnent le passage d'une phase à la suivante (voir chapitre 14 — Planning)."
    )
    table(
        ["Jalon", "Critère de succès", "Validation"],
        [
            ["MVP prêt", "Scraping Google Maps + nettoyage + export Excel + auth + 1 rôle", "Démo + tests"],
            ["Bêta privée", "50 utilisateurs pilotes, NPS ≥ 30, uptime ≥ 99 %", "Retours utilisateurs"],
            ["Lancement commercial", "Plan SaaS opérationnel, paiements Mobile Money, 100 comptes payants", "Revenus"],
            ["V1 stabilisée", "Multi-sources (4), API publique, BI, 650 comptes", "KPIs atteints"],
            ["V2 — Scale", "Agents IA, marketplace d'intégrations, 1 800 comptes", "KPIs atteints"],
            ["V3 — Expansion", "Présence dans 2 pays UEMOA supplémentaires", "Revenus internationaux"],
        ],
        col_widths=[3.2 * cm, 9.5 * cm, CONTENT_W - 12.7 * cm],
    )
    h3("Facteurs clés de succès (CSF)")
    bullets([
        ("Excellence technique", ["Pipeline IA robuste, architecture scalable, sécurité de bout en bout"]),
        ("Qualité de la donnée", ["La valeur perçue dépend directement de la fiabilité des données restituées"]),
        ("Conformité réglementaire", ["Confiance des institutions et entreprises, différenciateur majeur"]),
        ("Expérience utilisateur", ["Simplicité de prise en main, instantanéité des résultats"]),
        ("Réactivité opérationnelle", ["Support réactif, gestion des incidents, mise à jour des sources"]),
        ("Go-to-market ciblé", ["Focus initial sur les segments à fort ROI et récurrents"]),
    ])
    h3("Risques principaux et mitigation")
    table(
        ["Risque", "Probabilité", "Impact", "Mitigation"],
        [
            ["Blocage IP / anti-scraping des sources", "Élevée", "Élevé", "Rotation de proxies, respect robots.txt, multi-sources"],
            ["Évolution défavorable réglementaire", "Faible", "Élevé", "Veille APIPD, conformité par conception"],
            ["Dégradation qualité des sources", "Moyenne", "Moyen", "Validation IA, scoring, sources multiples"],
            ["Adoption lente du marché", "Moyenne", "Élevé", "Éducation, freemium, partenariats"],
            ["Fuite de données / incident sécurité", "Faible", "Très élevé", "Chiffrement, audit, WAF, tests sécurité"],
            ["Dépendance fournisseur cloud", "Moyenne", "Moyen", "Architecture portable, multi-cloud possible"],
        ],
        col_widths=[5.5 * cm, 2.2 * cm, 2.2 * cm, CONTENT_W - 9.9 * cm],
        align_center_cols=[1, 2],
    )
    info_box(
        "Synthèse du chapitre",
        "Les objectifs de ScrapIQ CI sont précis, mesurables et hiérarchisés. Ils couvrent "
        "les dimensions fonctionnelle, technique, business et qualité, et sont suivis par une "
        "trentaine de KPIs. Les critères de succès jalonnent le projet et permettent de "
        "valider chaque phase. Le tableau de bord BI (chapitre 3.11) assure le suivi temps "
        "réel de ces indicateurs.",
    )
