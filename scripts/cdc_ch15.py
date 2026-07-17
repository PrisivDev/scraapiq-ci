# -*- coding: utf-8 -*-
"""Chapitre 15 — Budget."""
from cdc_common import *  # noqa: F401,F403


def chapter15():
    chapter_title(15, "Budget")
    intro(
        "Ce chapitre présente le budget du projet ScrapIQ CI : coûts de développement, "
        "coûts d'infrastructure, licences et services tiers, maintenance et exploitation, "
        "et enfin l'analyse de retour sur investissement (ROI). Les montants sont exprimés "
        "en FCFA (XOF) et constituent des estimations de référence, à affiner lors de la "
        "phase de cadrage opérationnelle."
    )

    # ---------------------------------------------------------------- 15.1
    h2("Coûts de développement")
    P(
        "Les coûts de développement couvrent la rémunération de l'équipe sur les 18 premiers "
        "mois (Cadrage + MVP + V1 + V2). L'équipe est composée de profils techniques et "
        "produit, avec un effectif moyen de 4–5 personnes."
    )
    h3("Composition de l'équipe")
    table(
        ["Rôle", "Effectif", "Coût mensuel (FCFA)", "Mois", "Total (FCFA)"],
        [
            ["Lead Tech / Architecte", "1", "1 200 000", "18", "21 600 000"],
            ["Développeur Fullstack", "2", "800 000", "18", "28 800 000"],
            ["Développeur IA / Data", "1", "900 000", "15", "13 500 000"],
            ["UX/UI Designer", "1", "700 000", "8", "5 600 000"],
            ["Product Manager", "1", "900 000", "18", "16 200 000"],
            ["QA / Test", "1", "600 000", "12", "7 200 000"],
            ["Total développement", "7 ETP", "—", "—", "92 900 000"],
        ],
        col_widths=[4.2 * cm, 1.6 * cm, 3.2 * cm, 1.4 * cm, CONTENT_W - 10.4 * cm],
        align_center_cols=[1, 2, 3, 4],
    )
    h3("Coûts annexes de développement")
    table(
        ["Poste", "Détail", "Montant (FCFA)"],
        [
            ["Outils de dev", "Licences IDE, GitHub, Figma, Notion", "3 500 000"],
            ["Formation", "Veille, certifications, ateliers", "2 000 000"],
            ["Prestations externes", "Audit sécurité, UX research", "5 000 000"],
            ["Legal & admin", "Statuts, marques, contrats", "2 500 000"],
            ["Contingence (10 %)", "Imprévus", "10 590 000"],
            ["Total annexes", "—", "23 590 000"],
        ],
        col_widths=[4.0 * cm, 7.0 * cm, CONTENT_W - 11 * cm],
        align_center_cols=[2],
    )
    h3("Total développement (18 mois)")
    P("Le coût total de développement sur 18 mois s'élève à environ <b>116,5 millions "
      "FCFA</b> (92,9 M équipe + 23,6 M annexes).")

    # ---------------------------------------------------------------- 15.2
    h2("Coûts d'infrastructure")
    h3("Infrastructure cloud (annuelle)")
    table(
        ["Composant", "Spécification", "Coût annuel (FCFA)"],
        [
            ["Cluster Kubernetes", "3 nœuds managed", "4 800 000"],
            ["PostgreSQL", "Managed, 4 vCPU, 8 Go", "3 600 000"],
            ["Elasticsearch", "3 nœuds, 8 Go", "5 400 000"],
            ["Redis", "Managed, 2 Go", "1 200 000"],
            ["Stockage objets", "1 To + trafic", "900 000"],
            ["CDN / Edge / WAF", "Cloudflare Business", "1 800 000"],
            ["DNS + certificats", "Managés", "300 000"],
            ["Monitoring", "Grafana Cloud / self-hosted", "1 200 000"],
            ["Backups", "Stockage + PITR", "600 000"],
            ["Sortie réseau (egress)", "Trafic scraping", "2 400 000"],
            ["Total infra annuel", "—", "22 200 000"],
        ],
        col_widths=[4.2 * cm, 6.0 * cm, CONTENT_W - 10.2 * cm],
        align_center_cols=[2],
    )
    h3("Évolution des coûts d'infrastructure")
    table(
        ["Année", "Charge estimée", "Coût infra (FCFA)", "Ratio CA"],
        [
            ["Année 1 (lancement)", "Faible", "22 200 000", "≈ 25 %"],
            ["Année 2 (croissance)", "Moyenne", "38 000 000", "≈ 18 %"],
            ["Année 3 (scale)", "Élevée", "62 000 000", "≈ 12 %"],
        ],
        col_widths=[4.2 * cm, 3.0 * cm, 4.0 * cm, CONTENT_W - 11.2 * cm],
        align_center_cols=[2, 3],
    )

    # ---------------------------------------------------------------- 15.3
    h2("Licences et services tiers")
    table(
        ["Service", "Usage", "Coût annuel (FCFA)"],
        [
            ["Fournisseur LLM", "Enrichissement, classification, scoring IA", "12 000 000"],
            ["Proxy rotating", "Rotation IP pour scraping", "3 600 000"],
            ["Passerelle paiement", "Mobile Money + carte (commission incluse)", "2 400 000"],
            ["Email transactionnel", "Notifications email", "1 200 000"],
            ["Service de cartes", "Tuiles OSM premium (option)", "1 800 000"],
            ["Service captcha", "Anti-bot", "900 000"],
            ["Error monitoring", "Sentry", "900 000"],
            ["Analytics produit", "PostHog / Mixpanel", "1 200 000"],
            ["Total tiers annuel", "—", "24 000 000"],
        ],
        col_widths=[4.2 * cm, 6.0 * cm, CONTENT_W - 10.2 * cm],
        align_center_cols=[2],
    )

    # ---------------------------------------------------------------- 15.4
    h2("Maintenance et exploitation")
    P(
        "Au-delà du développement initial, l'exploitation et la maintenance représentent un "
        "coût récurrent. Elles couvrent l'équipe d'exploitation (SRE, support), la "
        "maintenance corrective et évolutive, et les évolutions continues."
    )
    table(
        ["Poste", "Détail", "Coût annuel (FCFA)"],
        [
            ["Équipe d'exploitation", "1 SRE + 1 support (partiel)", "18 000 000"],
            ["Maintenance corrective", "Bugs, correctifs sécurité", "6 000 000"],
            ["Maintenance évolutive", "Petites évolutions, optimisations", "9 000 000"],
            ["Veille & mises à jour", "Sources, dépendances, LLM", "3 000 000"],
            ["Support client", "Outils, processus", "2 000 000"],
            ["Total maintenance annuel", "—", "38 000 000"],
        ],
        col_widths=[4.2 * cm, 6.0 * cm, CONTENT_W - 10.2 * cm],
        align_center_cols=[2],
    )

    # ---------------------------------------------------------------- 15.5
    h2("Retour sur investissement (ROI)")
    h3("Hypothèses de revenus")
    table(
        ["Année", "Comptes payants", "MRR moyen (FCFA)", "ARR (FCFA)"],
        [
            ["Année 1", "650", "70 000", "546 000 000"],
            ["Année 2", "1 800", "75 000", "1 620 000 000"],
            ["Année 3", "4 500", "80 000", "4 320 000 000"],
        ],
        col_widths=[2.6 * cm, 3.0 * cm, 3.4 * cm, CONTENT_W - 9 * cm],
        align_center_cols=[1, 2, 3],
    )
    h3("Coûts totaux par année")
    table(
        ["Année", "Développement", "Infra", "Tiers", "Maintenance", "Total (FCFA)"],
        [
            ["Année 1", "92 900 000", "22 200 000", "24 000 000", "—", "139 100 000"],
            ["Année 2", "23 600 000", "38 000 000", "24 000 000", "38 000 000", "123 600 000"],
            ["Année 3", "—", "62 000 000", "30 000 000", "48 000 000", "140 000 000"],
        ],
        col_widths=[2.2 * cm, 2.8 * cm, 2.2 * cm, 1.8 * cm, 2.4 * cm, CONTENT_W - 11.4 * cm],
        align_center_cols=[1, 2, 3, 4, 5],
    )
    h3("Projection de rentabilité")
    table(
        ["Année", "Revenus (FCFA)", "Coûts (FCFA)", "Résultat (FCFA)", "Cumul (FCFA)"],
        [
            ["Année 1", "546 000 000", "139 100 000", "+406 900 000", "+406 900 000"],
            ["Année 2", "1 620 000 000", "123 600 000", "+1 496 400 000", "+1 903 300 000"],
            ["Année 3", "4 320 000 000", "140 000 000", "+4 180 000 000", "+6 083 300 000"],
        ],
        col_widths=[2.2 * cm, 3.4 * cm, 3.0 * cm, 3.4 * cm, CONTENT_W - 12 * cm],
        align_center_cols=[1, 2, 3, 4],
    )
    info_box(
        "Synthèse budgétaire",
        "Le projet ScrapIQ CI représente un investissement de développement d'environ "
        "116,5 millions FCFA sur 18 mois, complété par des coûts d'infrastructure et de "
        "tiers d'environ 46 millions FCFA par an. Le retour sur investissement est "
        "atteint dès la première année grâce à un modèle SaaS récurrent à forte marge "
        "(> 70 %), avec une projection de résultat cumulé dépassant 6 milliards FCFA à "
        "3 ans.",
        color=EMERALD,
    )
    info_box(
        "Sensibilités",
        "Le scénario présenté est central. Un scénario pessimiste (adoption 30 % plus "
        "lente) reste rentable dès l'année 1. Le risque principal est la montée en charge "
        "des coûts LLM, mitigée par la mise en cache, le fallback sur règles et la "
        "négociation de volume.",
        color=ORANGE,
    )
