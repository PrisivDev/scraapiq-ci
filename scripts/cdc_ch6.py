# -*- coding: utf-8 -*-
"""Chapitre 6 — Wireframes."""
from cdc_common import *  # noqa: F401,F403


def chapter6():
    chapter_title(6, "Wireframes")
    intro(
        "Ce chapitre décrit textuellement et en détail les wireframes de chacun des écrans "
        "majeurs de la plateforme ScrapIQ CI. Pour chaque écran sont précisés : la structure "
        "globale (en-tête, navigation, zone principale, pied), les composants clés, les "
        "interactions principales, les états (vide, chargement, erreur, succès) et les "
        "considérations responsive (mobile / desktop). Ces descriptions servent de référence "
        "aux designers et développeurs frontend."
    )
    h3("Conventions de description")
    P(
        "Chaque wireframe est décrit selon une grille standardisée : objectif de l'écran, "
        "structure visuelle (du haut vers le bas), composants shadcn/ui utilisés, "
        "interactions, états et règles d'accès (rôle minimum). Une maquette ASCII synthétique "
        "illustre l'agencement général."
    )

    # ---------------------------------------------------------------- 6.1
    h2("Tableau de bord")
    P("L'écran de tableau de bord est la page d'accueil après connexion. Il offre une vue "
      "synthétique de l'activité du workspace.")
    ascii_diagram([
        "┌─────────────────────────────────────────────────────────────┐",
        "│ [☰] ScrapIQ CI    [Recherche…]  [▾ Abidjan]   [🔔][▾ Profil] │",
        "├───────┬─────────────────────────────────────────────────────┤",
        "│ Side  │  KPIs : Entreprises · Jobs · Exports · Score moyen  │",
        "│ bar   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │",
        "│       │  │ 12k  │ │  48  │ │  120 │ │  74  │                │",
        "│ Dash  │  └──────┘ └──────┘ └──────┘ └──────┘                │",
        "│ Rech  │  ┌────────────────────┐  ┌────────────────────┐     │",
        "│ Carte │  │ Activité scraping   │  │ Répartition sect.  │     │",
        "│ Ent.  │  │ (graphique lignes)  │  │ (graphique barres) │     │",
        "│ Jobs  │  └────────────────────┘  └────────────────────┘     │",
        "│ Scrap │  ┌──────────────────────────────────────────────┐   │",
        "│ Exp.  │  │ Derniers jobs (tableau)                       │   │",
        "│ API   │  └──────────────────────────────────────────────┘   │",
        "│ …     │                                                       │",
        "└───────┴─────────────────────────────────────────────────────┘",
    ], caption_text="Figure 6.1 — Wireframe tableau de bord")
    h3("Composants et interactions")
    bullets([
        "Sidebar de navigation (collapsible sur mobile) avec icônes Lucide",
        "Barre de recherche globale (command palette Cmd+K)",
        "Sélecteur de ville/commune (filtre global)",
        "Cloche de notifications avec badge compteur",
        "Cartes KPI (Card) avec tendance vs période précédente",
        "Graphiques (Recharts) : activité scraping, répartition sectorielle",
        "Tableau des derniers jobs (statut, source, durée, résultats)",
        "Accès : tous les rôles (contenu adapté au rôle)",
    ])

    # ---------------------------------------------------------------- 6.2
    h2("Recherche")
    P("L'écran de recherche permet de trouver des entreprises selon des critères "
      "multi-dimensionnels et bascule entre vue liste et vue carte.")
    ascii_diagram([
        "┌─────────────────────────────────────────────────────────────┐",
        "│ [☰] … [Recherche avancée]                                  │",
        "├───────┬──────────────────────────────────┬──────────────────┤",
        "│ Filtres │ q: [pharmacie____]            │ Résultats : 142  │",
        "│ Secteur │ ▾ Secteur  ▾ Commune ▾ Score  │ ┌──────────────┐ │",
        "│ Commune │                               │ │ Pharmacie X  │ │",
        "│ Score   │                               │ │ Cocody · A   │ │",
        "│ Source  │                               │ │ +225 07…     │ │",
        "│ Fraîch. │                               │ └──────────────┘ │",
        "│         │                               │ ┌──────────────┐ │",
        "│ [Appl.] │                               │ │ Pharmacie Y  │ │",
        "│ [Réinit]│                               │ └──────────────┘ │",
        "└───────┴──────────────────────────────────┴──────────────────┘",
    ], caption_text="Figure 6.2 — Wireframe recherche (vue liste)")
    h3("Détails")
    bullets([
        "Panneau de filtres latéral (Sidebar) : secteur, commune, score min, source, fraîcheur",
        "Barre de recherche full-text avec suggestions (autocomplete)",
        "Bascule vue liste / vue carte (Toggle Group)",
        "Tri (pertinence, score, nom, date, distance)",
        "Carte de résultat : nom, secteur, commune, catégorie (badge coloré), téléphone, score",
        "Pagination ou scroll infini (20 par page)",
        "Sélection multiple pour export groupé",
        "Accès : tous les rôles",
    ])

    # ---------------------------------------------------------------- 6.3
    h2("Carte interactive")
    P("La carte affiche les entreprises géolocalisées avec heatmap, clusters et filtres "
      "géographiques.")
    ascii_diagram([
        "┌─────────────────────────────────────────────────────────────┐",
        "│ [☰] …   [Vue Carte]                              [Heatmap ▾]│",
        "├───────┬─────────────────────────────────────────────────────┤",
        "│ Filtres│                                                     │",
        "│ Rayon  │           ┌──────────────────────────────┐          │",
        "│ [5 km] │           │       Leaflet + OSM          │          │",
        "│ Commune│           │   • • •   • •                │          │",
        "│ Secteur│           │  • • •• • •• • •             │          │",
        "│        │           │   • • • • • •                │          │",
        "│ [Appl.]│           └──────────────────────────────┘          │",
        "└───────┴─────────────────────────────────────────────────────┘",
    ], caption_text="Figure 6.3 — Wireframe carte interactive")
    h3("Détails")
    bullets([
        "Carte Leaflet plein écran avec tuiles OpenStreetMap",
        "Marqueurs colorés par catégorie (A vert, B émeraude clair, C orange, D gris)",
        "Mode heatmap (densité) basculable",
        "Outil rayon (cercle draggable, rayon ajustable)",
        "Clusters au zoom arrière (marker cluster)",
        "Popup au clic : fiche résumée + lien vers fiche complète",
        "Filtres latéraux : rayon, commune, secteur, score",
        "Export de la vue (PNG) et de la sélection",
    ])

    # ---------------------------------------------------------------- 6.4
    h2("Entreprises")
    P("L'écran Entreprises liste l'ensemble des entreprises du workspace avec gestion "
      "détaillée et fiche complète.")
    bullets([
        "Tableau dense (DataTable) avec colonnes triables : nom, secteur, ville, commune, tél, score, catégorie, MAJ",
        "Recherche, filtres, sélection multiple, actions groupées (export, tag, supprimer)",
        "Fiche détaillée (drawer latéral ou page) : tous les champs, sources, historique, score détaillé par dimension",
        "Édition (rôle Manager+) : correction manuelle d'un champ, marquage vérifié",
        "Accès : tous les rôles (édition restreinte)",
    ])
    ascii_diagram([
        "┌──────────────────────────────────────────────────────────────┐",
        "│ Entreprises (12 480)  [+ Importer]  [Exporter]  [Filtres ▾]  │",
        "├──────────────────────────────────────────────────────────────┤",
        "│ ☐ Nom          Secteur      Commune   Tél        Score  Grade│",
        "│ ☐ Pharmacie X  Santé        Cocody    +225 07…   88     A    │",
        "│ ☐ Quincaillerie Y Commerce  Yopougon  +225 05…   72     B    │",
        "│ ☐ …                                                          │",
        "└──────────────────────────────────────────────────────────────┘",
    ], caption_text="Figure 6.4 — Wireframe liste entreprises")

    # ---------------------------------------------------------------- 6.5
    h2("Jobs de scraping")
    P("L'écran Jobs liste l'historique des jobs de scraping avec statut, détails et relance.")
    bullets([
        "Tableau des jobs : ID, requête, sources, statut (badge), résultats, durée, date, lancé par",
        "Filtres par statut, source, date, utilisateur",
        "Détail d'un job (drawer) : logs, événements, erreurs, résultats partiels",
        "Actions : relancer (avec même params), dupliquer, supprimer, planifier",
        "Vue planning des jobs récurrents (Admin/Manager)",
    ])

    # ---------------------------------------------------------------- 6.6
    h2("Scraper multi-sources")
    P("L'écran Scraper est l'interface de lancement d'un job de scraping multi-sources.")
    ascii_diagram([
        "┌──────────────────────────────────────────────────────────────┐",
        "│ Nouveau scraping                                              │",
        "├──────────────────────────────────────────────────────────────┤",
        "│ Requête  [quincaillerie____________________]                 │",
        "│ Ville    [Abidjan ▾]   Commune [Yopougon ▾]                  │",
        "│ Sources  ☑ Google Maps  ☑ Facebook  ☐ LinkedIn  ☑ Web        │",
        "│ Max résultats [200]   ☑ Enrichir  ☑ Dédoublonner            │",
        "│                                                              │",
        "│              [Annuler]   [Lancer le scraping ▶]              │",
        "└──────────────────────────────────────────────────────────────┘",
    ], caption_text="Figure 6.5 — Wireforme formulaire de scraping")
    bullets([
        "Formulaire (Form) avec validation Zod",
        "Sélection multiple des sources (Checkboxes / Toggle)",
        "Options avancées repliables (Collapse)",
        "Barre de progression temps réel après lancement",
        "Onglets : Nouveau / En cours / Historique / Planifiés",
        "Accès : Manager+, Agent (sources restreintes)",
    ])

    # ---------------------------------------------------------------- 6.7
    h2("Exports")
    P("L'écran Exports permet de générer et gérer les exports de données.")
    bullets([
        "Liste des exports générés (tableau) : nom, format, lignes, statut, date, télécharger",
        "Bouton « Nouvel export » : sélection source (recherche/job), format, champs, options",
        "Progression temps réel des exports en cours",
        "Modèles d'export sauvegardés (réutilisables)",
        "Retention info (30 j) et purge manuelle",
    ])

    # ---------------------------------------------------------------- 6.8
    h2("API REST Explorer")
    P("L'écran API REST offre un explorateur interactif (try-it) + documentation Swagger.")
    ascii_diagram([
        "┌──────────────────────────────────────────────────────────────┐",
        "│ API REST     [Endpoints] [Swagger] [Try-it] [Clés] [Webhooks]│",
        "├──────────────┬───────────────────────────────────────────────┤",
        "│ /companies   │ GET /api/v1/companies/search                 │",
        "│ /scraping    │ ┌──────────────────────────────────────────┐ │",
        "│ /exports     │ │ Paramètres : q, city, commune, minScore  │ │",
        "│ /agents      │ │ Headers : Authorization                  │ │",
        "│ /notifs      │ │ [Essayer]                                │ │",
        "│ /saas        │ └──────────────────────────────────────────┘ │",
        "│ /security    │ Réponse : { data: [...], meta: {...} }       │",
        "└──────────────┴───────────────────────────────────────────────┘",
    ], caption_text="Figure 6.6 — Wireframe API Explorer")
    bullets([
        "Onglet Endpoints : liste arborescente des routes par ressource",
        "Onglet Swagger : documentation OpenAPI 3.0 interactive",
        "Onglet Try-it : formulaire d'exécution d'une requête avec affichage réponse",
        "Onglet Clés : gestion des clés API",
        "Onglet Webhooks : configuration et historique des livraisons",
    ])

    # ---------------------------------------------------------------- 6.9
    h2("Notifications")
    P("L'écran Notifications centralise les notifications in-app et les préférences.")
    bullets([
        "Liste des notifications (marquées lues/non lues) avec filtre par type",
        "Cloche globale (header) avec compteur et dropdown rapide",
        "Onglet Préférences : activation par type d'événement × canal",
        "Onglet Webhooks : configuration (voir 6.8)",
        "Notifications temps réel via WebSocket (push instantané)",
    ])

    # ---------------------------------------------------------------- 6.10
    h2("Équipe et permissions")
    P("L'écran Équipe gère les membres du workspace et leurs rôles.")
    ascii_diagram([
        "┌──────────────────────────────────────────────────────────────┐",
        "│ Équipe (6 membres)                          [+ Inviter]      │",
        "├──────────────────────────────────────────────────────────────┤",
        "│ Membre              Rôle      Statut     Dernière connexion  │",
        "│ aicha@mail.com      Owner     Actif      il y a 2 h           │",
        "│ konan@mail.com      Admin     Actif      il y a 1 j           │",
        "│ marc@mail.com       Manager   Actif      il y a 30 min        │",
        "│ …                                                            │",
        "└──────────────────────────────────────────────────────────────┘",
    ], caption_text="Figure 6.7 — Wireframe équipe")
    bullets([
        "Tableau des membres avec rôle (editable), statut, dernière connexion",
        "Bouton Inviter (modal : email + rôle + message)",
        "Gestion des invitations en attente",
        "Suppression / suspension d'un membre",
        "Accès : Owner, Admin",
    ])

    # ---------------------------------------------------------------- 6.11
    h2("Back office")
    P("Le back office est réservé aux Admins et Owners ; il supervise la plateforme.")
    bullets([
        "Vue d'ensemble : statistiques globales (comptes, jobs, volumes)",
        "Gestion des organisations et workspaces",
        "Supervision des workers et files BullMQ (queue monitoring)",
        "Gestion des sources (activation, rate limits, statut)",
        "Journal d'audit complet (filtrable, exportable)",
        "Gestion des licences et quotas globaux",
    ])
    ascii_diagram([
        "┌──────────────────────────────────────────────────────────────┐",
        "│ Back office   [Stats] [Queues] [Sources] [Audit] [Licences]  │",
        "├──────────────────────────────────────────────────────────────┤",
        "│ Workers actifs : 8    Jobs en file : 23    Latence moy : 1,2s│",
        "│ ┌──────────────────────────────────────────────────────────┐ │",
        "│ │ Queue monitoring (BullMQ)                                │ │",
        "│ │ scraping : ████████░░ 80%   agents : ███░░░░░░░ 30%      │ │",
        "│ └──────────────────────────────────────────────────────────┘ │",
        "└──────────────────────────────────────────────────────────────┘",
    ], caption_text="Figure 6.8 — Wireframe back office")

    # ---------------------------------------------------------------- 6.12
    h2("Sécurité")
    P("L'écran Sécurité centralise la configuration et le suivi de sécurité.")
    bullets([
        "Politique de mot de passe (longueur, complexité, expiration)",
        "Activation 2FA (TOTP) avec QR code + codes de secours",
        "Sessions actives (appareil, IP, dernière activité, révoquer)",
        "IP allowlist / blocklist",
        "Journaux de connexion (réussis / échoués)",
        "Clés API et secrets (rotation, révocation)",
    ])

    # ---------------------------------------------------------------- 6.13
    h2("PWA mobile")
    P("La PWA mobile adapte l'expérience aux smartphones, priorité à la consultation rapide.")
    ascii_diagram([
        "┌──────────────────┐",
        "│ ☰ ScrapIQ   🔔(3)│",
        "├──────────────────┤",
        "│ [Recherche…]     │",
        "│ ┌──────────────┐ │",
        "│ │ KPI du jour  │ │",
        "│ └──────────────┘ │",
        "│ Derniers jobs    │",
        "│ • Quincaillerie ✓│",
        "│ • Pharmacie   ⏳ │",
        "│ ─────────────    │",
        "│ [Rech][Carte]    │",
        "│ [Jobs][Profil]   │",
        "└──────────────────┘",
    ], caption_text="Figure 6.9 — Wireframe PWA mobile")
    bullets([
        "Navigation par bottom bar (Recherche, Carte, Jobs, Profil)",
        "Cards empilées verticalement, tailles tactiles ≥ 44px",
        "Pull-to-refresh sur les listes",
        "Notifications push natives (PWA)",
        "Mode hors-ligne : consultation des dernières données mises en cache",
    ])

    # ---------------------------------------------------------------- 6.14
    h2("Business Intelligence")
    P("Le module BI présente les tableaux de bord analytiques.")
    bullets([
        "Sélecteur de tableau de bord (vue d'ensemble, activité, heatmap, qualité, exports, commercial)",
        "Plage de dates (date range picker)",
        "Graphiques Recharts (lignes, barres, donut, heatmap)",
        "Filtres croisés (secteur, commune, période)",
        "Export du tableau de bord (PNG, PDF)",
        "Création / planification de rapports",
    ])

    # ---------------------------------------------------------------- 6.15
    h2("SaaS Enterprise")
    P("L'espace SaaS gère abonnement, facturation, licences et quotas.")
    bullets([
        "Vue plan courant + comparatif des plans",
        "Changement de plan (upgrade/downgrade)",
        "Facturation : historique, téléchargement, moyen de paiement",
        "Quotas : consommation temps réel par fonctionnalité, alertes",
        "Licences : attribution, activation, révocation",
        "Marketplace d'intégrations (à venir, V2)",
    ])

    # ---------------------------------------------------------------- 6.16
    h2("Agents IA")
    P("L'écran Agents IA pilote et monitor le pipeline des 10 agents.")
    ascii_diagram([
        "┌──────────────────────────────────────────────────────────────┐",
        "│ Agents IA — Pipeline              [Nouveau pipeline ▶]       │",
        "├──────────────────────────────────────────────────────────────┤",
        "│ Progression : ████████████░░░░░░ 8/10                        │",
        "│ 1 Sources      ✓ 1,2s   2 Scraping  ✓ 42s                    │",
        "│ 3 Nettoyage    ✓ 6s     4 Dédup     ✓ 8s                     │",
        "│ 5 Enrich       ⏳ …      6 Valid     ⏳ …    (parallèle)       │",
        "│ 7 Géocode      ○        8 Classif   ○                        │",
        "│ 9 Scoring      ○        10 Export   ○                        │",
        "│ ┌──────────────────────────────────────────────────────────┐ │",
        "│ │ Flux d'événements (console temps réel)                   │ │",
        "│ └──────────────────────────────────────────────────────────┘ │",
        "└──────────────────────────────────────────────────────────────┘",
    ], caption_text="Figure 6.10 — Wireframe agents IA")
    bullets([
        "Barre de progression globale (X/10 agents terminés)",
        "Liste des 10 agents avec : numéro coloré, nom, rôle, statut, durée",
        "Flux d'événements temps réel (console noire colorée)",
        "État partagé (blackboard) affiché en repliable",
        "Diagramme d'architecture du pipeline (séquentiel + parallèle)",
        "Actions : relancer, abort, consulter les détails d'un agent",
        "Accès : Manager+",
    ])
    h3("États d'un agent")
    table(
        ["Statut", "Couleur", "Signification"],
        [
            ["pending", "Gris", "En attente de démarrage"],
            ["running", "Orange", "En cours d'exécution"],
            ["completed", "Vert", "Terminé avec succès"],
            ["failed", "Rouge", "Échec (après retries)"],
            ["skipped", "Gris clair", "Ignoré (dépendance manquante ou circuit breaker)"],
        ],
        col_widths=[2.6 * cm, 2.4 * cm, CONTENT_W - 5 * cm],
    )
    info_box(
        "Synthèse du chapitre",
        "Les wireformes couvrent les 16 écrans majeurs de la plateforme, du tableau de bord "
        "aux agents IA. Chaque écran est décrit avec sa structure, ses composants, ses "
        "interactions et ses règles d'accès. L'approche mobile-first et la cohérence "
        "visuelle (shadcn/ui, palette émeraude/orange) assurent une expérience unifiée.",
    )
