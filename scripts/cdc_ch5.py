# -*- coding: utf-8 -*-
"""Chapitre 5 — Cas d'utilisation."""
from cdc_common import *  # noqa: F401,F403


def chapter5():
    chapter_title(5, "Cas d'utilisation")
    intro(
        "Ce chapitre décrit les cas d'utilisation (use cases) de la plateforme ScrapIQ CI "
        "pour chacun des cinq acteurs du système : Owner, Admin, Manager, Agent et Viewer. "
        "Chaque cas d'utilisation est présenté selon un format standardisé : identifiant, "
        "acteur principal, acteurs secondaires, préconditions, scénario nominal, scénarios "
        "alternatifs, postconditions et règles métier. Cette spécification sert de référence "
        "pour la conception détaillée, les tests fonctionnels et la documentation utilisateur."
    )

    # ---------------------------------------------------------------- 5.1
    h2("Acteurs du système")
    P(
        "Les acteurs de ScrapIQ CI sont de deux types : les acteurs humains (utilisateurs "
        "authentifiés selon leur rôle) et les acteurs systèmes (services externes et "
        "internes qui interagissent avec la plateforme de manière automatisée)."
    )
    h3("Acteurs humains")
    table(
        ["Acteur", "Description", "Objectifs principaux"],
        [
            ["Owner", "Propriétaire de l'organisation", "Gérer l'org, la facturation, piloter l'usage"],
            ["Admin", "Administrateur du workspace", "Configurer, gérer l'équipe, superviser la sécurité"],
            ["Manager", "Responsable d'équipe / d'activité", "Piloter le scraping, les exports, la BI, les agents IA"],
            ["Agent", "Opérateur / commercial", "Collecter et exporter des données rapidement"],
            ["Viewer", "Consultant / lecteur", "Consulter les données, la carte, la BI (lecture seule)"],
        ],
        col_widths=[2.0 * cm, 5.5 * cm, CONTENT_W - 7.5 * cm],
    )
    h3("Acteurs systèmes")
    table(
        ["Acteur", "Rôle"],
        [
            ["Service de scraping", "Collecte les données auprès des sources externes"],
            ["Orchestrateur d'agents IA", "Exécute le pipeline de 10 agents"],
            ["Service de notifications", "Délivre les notifications in-app/email/push/webhook"],
            ["Fournisseur LLM", "Fournit l'enrichissement, la classification, le scoring IA"],
            ["Sources externes", "Google Maps, Facebook, LinkedIn, sites web, RCCM"],
            ["Passerelle de paiement", "Mobile Money + carte pour la facturation SaaS"],
            ["Service OSM / Nominatim", "Géocodage des adresses et tuiles cartographiques"],
        ],
        col_widths=[4.5 * cm, CONTENT_W - 4.5 * cm],
    )

    # ---------------------------------------------------------------- 5.2
    h2("Cas d'utilisation Owner")
    h3("UC-O1 — Créer et configurer une organisation")
    kv_block([
        ("Acteur principal", "Owner"),
        ("Préconditions", "L'utilisateur s'est inscrit et a confirmé son email"),
        ("Scénario nominal", "1. Saisie du nom d'organisation 2. Choix du slug 3. Sélection du plan 4. Validation 5. Organisation créée, utilisateur devient Owner"),
        ("Postconditions", "Organisation existante avec un workspace par défaut"),
        ("Règles", "Slug unique ; 1 organisation par compte par défaut (extensible)"),
    ])
    h3("UC-O2 — Gérer la facturation et l'abonnement")
    kv_block([
        ("Acteur principal", "Owner"),
        ("Préconditions", "Organisation existante"),
        ("Scénario nominal", "1. Ouverture de l'onglet Facturation 2. Choix/changement de plan 3. Saisie du moyen de paiement (Mobile Money/carte) 4. Validation 5. Facture émise, quotas mis à jour"),
        ("Alternatives", "Échec paiement → retour au choix ; downgrad → ajustement des quotas en fin de période"),
        ("Postconditions", "Abonnement actif, facture disponible"),
    ])
    h3("UC-O3 — Gérer les licences et invitations")
    kv_block([
        ("Acteur principal", "Owner"),
        ("Scénario nominal", "1. Invitation d'un membre par email 2. Attribution d'un rôle 3. Envoi de l'invitation 4. Acceptation par l'invité 5. Membre ajouté au workspace"),
        ("Règles", "Nombre de membres limité par plan ; Owner peut transférer la propriété"),
    ])
    h3("UC-O4 — Transférer la propriété de l'organisation")
    kv_block([
        ("Acteur principal", "Owner"),
        ("Préconditions", "Au moins un autre membre Admin/Manager"),
        ("Scénario nominal", "1. Sélection du successeur 2. Confirmation (2FA requis) 3. Transfert effectif 4. Ancien Owner devient Admin"),
        ("Postconditions", "Nouveau Owner défini, journalisé dans l'audit"),
    ])
    h3("UC-O5 — Consulter la BI et les rapports consolidés")
    kv_block([
        ("Acteur principal", "Owner"),
        ("Scénario nominal", "1. Ouverture du module BI 2. Consultation des KPIs consolidés 3. (Option) Planification d'un rapport 4. Téléchargement"),
        ("Postconditions", "Insights disponibles pour la décision"),
    ])

    # ---------------------------------------------------------------- 5.3
    h2("Cas d'utilisation Admin")
    h3("UC-A1 — Gérer les membres et rôles")
    kv_block([
        ("Acteur principal", "Admin"),
        ("Préconditions", "Workspace existant, rôle Admin"),
        ("Scénario nominal", "1. Ouverture Équipe 2. Invitation / modification / suppression de membres 3. Attribution de rôles 4. Sauvegarde"),
        ("Alternatives", "Suppression d'un membre → ses données restent dans le workspace ; retrait de son propre rôle Admin interdit"),
        ("Postconditions", "Équipe à jour, modifications journalisées"),
    ])
    h3("UC-A2 — Configurer la sécurité du workspace")
    kv_block([
        ("Acteur principal", "Admin"),
        ("Scénario nominal", "1. Ouverture Sécurité 2. Activation/renforcement de la politique mot de passe 3. Obligation 2FA (option) 4. Configuration IP allowlist (option) 5. Sauvegarde"),
        ("Postconditions", "Politique de sécurité appliquée aux connexions suivantes"),
    ])
    h3("UC-A3 — Gérer les clés API et webhooks")
    kv_block([
        ("Acteur principal", "Admin"),
        ("Scénario nominal", "1. Création d'une clé API (nom, scopes, TTL) 2. Affichage unique de la clé 3. Configuration d'un webhook (URL, secret, événements) 4. Test 5. Activation"),
        ("Règles", "Clé affichée une seule fois ; hash stocké ; scopes limités par rôle"),
    ])
    h3("UC-A4 — Consulter les journaux d'audit")
    kv_block([
        ("Acteur principal", "Admin"),
        ("Scénario nominal", "1. Ouverture Audit 2. Filtrage par acteur/date/action 3. Consultation détaillée 4. (Option) Export du journal"),
        ("Postconditions", "Traçabilité des actions disponible"),
    ])
    h3("UC-A5 — Configurer les sources de scraping")
    kv_block([
        ("Acteur principal", "Admin"),
        ("Scénario nominal", "1. Ouverture configuration sources 2. Activation/désactivation de sources 3. Ajustement des rate limits 4. Sauvegarde"),
        ("Règles", "Respect des garde-fous globaux (robots.txt, délais minimaux)"),
    ])

    # ---------------------------------------------------------------- 5.4
    h2("Cas d'utilisation Manager")
    h3("UC-M1 — Lancer un job de scraping multi-sources")
    kv_block([
        ("Acteur principal", "Manager"),
        ("Préconditions", "Quota de jobs disponible"),
        ("Scénario nominal", "1. Ouverture Scraper 2. Saisie query + city + commune 3. Sélection sources 4. Lancement 5. Suivi progression temps réel 6. Notification de fin"),
        ("Alternatives", "Quota dépassé → proposition d'upgrade ; erreur scraping → retry automatique puis notification"),
        ("Postconditions", "Données collectées, nettoyées, indexées, consultables"),
    ])
    h3("UC-M2 — Lancer le pipeline d'agents IA")
    kv_block([
        ("Acteur principal", "Manager"),
        ("Scénario nominal", "1. Ouverture Agents IA 2. Saisie query + city + commune 3. Lancement pipeline 4. Suivi des 10 agents en temps réel 5. Consultation du résultat final"),
        ("Alternatives", "Échec d'un agent → retry puis skip/abort selon configuration"),
        ("Postconditions", "Pipeline terminé, données enrichies et scorées disponibles"),
    ])
    h3("UC-M3 — Créer et télécharger un export")
    kv_block([
        ("Acteur principal", "Manager"),
        ("Scénario nominal", "1. Sélection des données (filtre/recherche) 2. Choix du format 3. Sélection des champs 4. Lancement 5. Notification de disponibilité 6. Téléchargement"),
        ("Règles", "Limite de lignes par plan ; génération asynchrone ; retention 30 j"),
    ])
    h3("UC-M4 — Configurer des règles d'alerte")
    kv_block([
        ("Acteur principal", "Manager"),
        ("Scénario nominal", "1. Ouverture Alertes 2. Création d'une règle (type, secteur, zone, seuil) 3. Choix des canaux 4. Activation"),
        ("Postconditions", "Règle évaluée périodiquement, notifications déclenchées"),
    ])
    h3("UC-M5 — Consulter et planifier des rapports BI")
    kv_block([
        ("Acteur principal", "Manager"),
        ("Scénario nominal", "1. Ouverture BI 2. Consultation des tableaux de bord 3. Création d'un rapport planifié 4. Choix destinataires 5. Activation"),
    ])

    # ---------------------------------------------------------------- 5.5
    h2("Cas d'utilisation Agent")
    h3("UC-G1 — Rechercher des entreprises")
    kv_block([
        ("Acteur principal", "Agent"),
        ("Scénario nominal", "1. Ouverture Recherche 2. Saisie critères 3. Exécution 4. Consultation résultats (liste + carte) 5. (Option) Ouverture fiche détaillée"),
    ])
    h3("UC-G2 — Lancer un scraping simple")
    kv_block([
        ("Acteur principal", "Agent"),
        ("Scénario nominal", "1. Saisie query + localisation 2. Lancement 3. Consultation des résultats"),
        ("Règles", "Accès aux sources définies par l'Admin ; quota surveillé"),
    ])
    h3("UC-G3 — Exporter une sélection")
    kv_block([
        ("Acteur principal", "Agent"),
        ("Scénario nominal", "1. Sélection de résultats 2. Export (format, champs) 3. Téléchargement"),
        ("Règles", "Exports limités par plan ; pas d'accès aux exports avancés (PDF multi-onglets)"),
    ])
    h3("UC-G4 — Sauvegarder une recherche")
    kv_block([
        ("Acteur principal", "Agent"),
        ("Scénario nominal", "1. Exécution d'une recherche 2. Sauvegarde nommée 3. Réutilisation ultérieure"),
    ])

    # ---------------------------------------------------------------- 5.6
    h2("Cas d'utilisation Viewer")
    h3("UC-V1 — Consulter le tableau de bord")
    kv_block([
        ("Acteur principal", "Viewer"),
        ("Scénario nominal", "1. Connexion 2. Consultation des KPIs globaux 3. Navigation dans les modules en lecture"),
    ])
    h3("UC-V2 — Rechercher et consulter des entreprises")
    kv_block([
        ("Acteur principal", "Viewer"),
        ("Scénario nominal", "1. Recherche multi-critères 2. Consultation liste + carte 3. Ouverture fiche détaillée"),
        ("Règles", "Pas de lancement de scraping ni d'agents IA"),
    ])
    h3("UC-V3 — Consulter la BI (lecture)")
    kv_block([
        ("Acteur principal", "Viewer"),
        ("Scénario nominal", "1. Ouverture BI 2. Consultation des tableaux de bord 3. (Option) Téléchargement d'un rapport existant"),
        ("Règles", "Pas de création ni planification de rapports"),
    ])
    h3("UC-V4 — Exporter en lecture limitée")
    kv_block([
        ("Acteur principal", "Viewer"),
        ("Scénario nominal", "1. Sélection de résultats 2. Export CSV limité (ligne/quota réduit)"),
    ])
    h3("Synthèse croisée des cas d'utilisation par acteur")
    table(
        ["Cas d'utilisation", "Owner", "Admin", "Manager", "Agent", "Viewer"],
        [
            ["Gérer org & facturation", "✓", "—", "—", "—", "—"],
            ["Gérer membres & rôles", "✓", "✓", "—", "—", "—"],
            ["Configurer sécurité", "✓", "✓", "—", "—", "—"],
            ["Lancer scraping", "✓", "✓", "✓", "✓", "—"],
            ["Lancer agents IA", "✓", "✓", "✓", "—", "—"],
            ["Configurer alertes", "✓", "✓", "✓", "—", "—"],
            ["Créer exports avancés", "✓", "✓", "✓", "Limité", "Limité"],
            ["Consulter BI", "✓", "✓", "✓", "—", "✓"],
            ["Planifier rapports", "✓", "✓", "✓", "—", "—"],
            ["Consulter audit", "✓", "✓", "—", "—", "—"],
            ["Rechercher (lecture)", "✓", "✓", "✓", "✓", "✓"],
        ],
        col_widths=[5.6 * cm, 1.8 * cm, 1.8 * cm, 2.0 * cm, 1.8 * cm, CONTENT_W - 15.0 * cm],
        align_center_cols=[1, 2, 3, 4, 5],
    )
    info_box(
        "Synthèse du chapitre",
        "Les cas d'utilisation couvrent l'ensemble du périmètre fonctionnel pour les cinq "
        "rôles. Chaque use case est documenté avec préconditions, scénarios et "
        "postconditions, fournissant une base solide pour la conception, les tests et la "
        "formation. La matrice croisée récapitule les droits par acteur et use case.",
    )
