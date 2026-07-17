# -*- coding: utf-8 -*-
"""
Étension massive des chapitres 16-19 + contenu additionnel pour atteindre 300+ pages.
Ce fichier est importé par cdc_chapters.py en remplacement des stubs.
"""
from generate_cdc import (
    story, P, SP, PB, hr, chapter_title, h2, h3, h4, intro, bullets,
    table, make_table, caption, code_block, info_box, two_col, kv_block,
    ascii_diagram, STYLES, CONTENT_W,
    EMERALD, EMERALD_DARK, ORANGE, DARK, GRAY, GRAY_BORDER,
    Paragraph, ParagraphStyle, Table, TableStyle, Spacer, PageBreak,
    cm, TA_LEFT,
)

def chapter16():
    """Chapitre 16 — Roadmap (10+ pages)"""
    chapter_title(16, "Roadmap")
    intro("""La roadmap de ScrapIQ CI s'articule autour de quatre phases majeures s'étalant sur une période de 18 mois, du MVP jusqu'à la version Enterprise complète. Chaque phase a des objectifs clairs, des livrables définis et des critères de validation précis. Cette roadmap est conçue pour être itérative, permettant d'ajuster les priorités en fonction des retours utilisateurs et de l'évolution du marché ivoirien.""")

    h2("16.1 Phase 1 — MVP (Mois 1-4)")
    P("""La phase MVP (Minimum Viable Product) a pour objectif de livrer une plateforme fonctionnelle permettant de valider le concept auprès des premiers utilisateurs. Cette phase se concentre sur les fonctionnalités essentielles : recherche d'entreprises par mot-clé et zone géographique, scraping Google Maps, affichage des résultats en tableau et sur carte, export Excel basique, et authentification simple (email/mot de passe).""")
    P("""Le MVP cible spécifiquement le marché d'Abidjan avec ses 13 communes. Il doit démontrer la valeur du produit en permettant à un utilisateur de trouver 50+ entreprises en moins de 5 minutes, avec des coordonnées vérifiées (téléphone, adresse, GPS). L'interface doit être responsive et utilisable sur mobile, car la majorité des utilisateurs ivoiriens accèdent à internet via smartphone.""")

    h3("16.1.1 Livrables MVP")
    table(
        ["Livrable", "Description", "Critère d'acceptation"],
        [
            ["Authentification", "Inscription/connexion email + mot de passe, JWT", "Login < 2s, session 30j"],
            ["Recherche", "Recherche par mot-clé + commune + secteur", "Résultats < 3s pour 100 entreprises"],
            ["Scraping Google Maps", "Scraper Playwright avec extraction complète", "50 entreprises/scan, 0 blocage"],
            ["Tableau de résultats", "Liste triable avec colonnes configurables", "10 colonnes, tri multi-critères"],
            ["Carte OpenStreetMap", "Carte Leaflet avec marqueurs et clusters", "60 marqueurs, clusters actifs"],
            ["Export Excel", "Export .xlsx avec colonnes sélectionnées", "1000 lignes < 5s"],
            ["Dashboard basique", "KPIs (entreprises, jobs, sources) + 2 graphiques", "Temps réel, actualisation 5s"],
        ],
        col_widths=[3.5*cm, 7*cm, 5.5*cm],
    )

    h3("16.1.2 Critères de validation MVP")
    P("""Le MVP est considéré comme validé lorsque les critères suivants sont remplis :""")
    bullets([
        "10 utilisateurs actifs (beta-testeurs) utilisent la plateforme quotidiennement",
        "500+ entreprises indexées et vérifiées manuellement (taux d'erreur < 5%)",
        "Taux de réussite des jobs de scraping > 90%",
        "Temps de réponse moyen de l'API < 500ms",
        "Score NPS (Net Promoter Score) > 30 auprès des beta-testeurs",
        "Documentation API basique disponible (README + 5 endpoints documentés)",
    ])

    PB()
    h2("16.2 Phase 2 — V1 Production (Mois 5-8)")
    P("""La version 1 (V1) transforme le MVP en produit production-ready. Cette phase ajoute le multi-tenant, le RBAC complet, l'API REST documentée (Swagger), les webhooks, les notifications multi-canal, et le scraping multi-sources (Facebook, LinkedIn, sites web). L'objectif est de passer de 10 à 100 utilisateurs payants.""")

    h3("16.2.1 Fonctionnalités V1")
    table(
        ["Module", "Fonctionnalités", "Priorité"],
        [
            ["Multi-tenant", "Organisations, workspaces, isolation RLS", "P0"],
            ["RBAC", "5 rôles (Owner/Admin/Manager/Agent/Viewer), 22 permissions", "P0"],
            ["API REST v1", "CRUD companies, webhooks, pagination, filtres, tri, Swagger", "P0"],
            ["Scraping Facebook", "Scraper pages Facebook avec cookies de session", "P1"],
            ["Scraping LinkedIn", "Identification entreprises + dirigeants/employés", "P1"],
            ["Scraping sites web", "Robot visiteur automatique (accueil, contact, mentions)", "P1"],
            ["Notifications", "Email, SMS, WhatsApp, push, webhook, in-app", "P1"],
            ["IA Cleaner", "Dédup, enrichissement, scoring, détection fermetures", "P0"],
            ["Elasticsearch", "Recherche full-text avec BM25, fuzzy matching", "P0"],
            ["2FA TOTP", "Authentification à deux facteurs (Google Authenticator)", "P1"],
            ["OAuth", "Google + Microsoft (SSO)", "P2"],
            ["PWA", "Offline, background sync, notifications push, installation", "P1"],
        ],
        col_widths=[3.5*cm, 8*cm, 2.5*cm],
    )

    h3("16.2.2 Objectifs business V1")
    P("""À la fin de la V1, ScrapIQ CI doit atteindre les objectifs business suivants :""")
    bullets([
        "100 utilisateurs payants répartis sur 20 organisations",
        "10 000+ entreprises indexées (Abidjan + 5 grandes villes)",
        "Revenu mensuel récurrent (MRR) > 850 000 FCFA (équivalent 10 abonnements Pro)",
        "Taux de rétention > 80% après 3 mois",
        "Taux de conversion essai → payant > 25%",
        "Support client < 24h de réponse moyenne",
    ])

    PB()
    h2("16.3 Phase 3 — V2 Scale (Mois 9-14)")
    P("""La version 2 (V2) fait passer ScrapIQ CI à l'échelle Enterprise. Elle introduit l'architecture distribuée (Redis, BullMQ, workers), l'auto-scaling, le monitoring avancé, la BI (Business Intelligence), et le SaaS Enterprise complet (licences, facturation, quota). L'objectif est de supporter 1000+ utilisateurs et 100 000+ entreprises.""")

    h3("16.3.1 Architecture distribuée V2")
    P("""L'architecture distribuée V2 repose sur Redis comme message broker, BullMQ pour les queues, et des workers indépendants pour le traitement asynchrone. Cinq queues spécialisées gèrent les jobs de scraping, l'IA cleaner, les exports, les notifications et les rapports. Chaque queue a sa propre configuration de concurrence, retry et priorité.""")
    P("""Le monitoring temps réel permet de suivre l'état de toutes les queues, le statut des workers (idle/busy/error), le throughput (jobs/min), et de déclencher l'auto-scaling quand le nombre de jobs en attente dépasse un seuil. Un circuit breaker protège contre les cascades d'échecs.""")

    code_block("""# Architecture V2 — Queues et workers
queues:
  scraping:       3 workers, retry 3, backoff exponential 2s, priority 10
  ai-cleaner:     2 workers, retry 2, backoff exponential 3s, priority 5
  export:         2 workers, retry 2, backoff fixed 1s, priority 10
  notifications:  5 workers, retry 3, backoff exponential 0.5s, priority 1
  reports:        1 worker,  retry 1, backoff fixed 5s, priority 20""")

    h3("16.3.2 Fonctionnalités V2")
    table(
        ["Module", "Fonctionnalités", "Objectif"],
        [
            ["Architecture distribuée", "Redis + BullMQ + 13 workers + auto-scaling", "5 000 jobs simultanés"],
            ["BI", "Power BI Ready, prévisions, scoring, 7 types de graphiques", "Tableaux de bord décisionnels"],
            ["SaaS Enterprise", "Licences activables, facturation FCFA, quota temps réel", "Monétisation complète"],
            ["Sécurité avancée", "WAF (10 règles), DDoS, captcha, audit blockchain", "Conformité APIPD"],
            ["Agents IA", "10 agents spécialisés (pipeline coordonné)", "Automatisation complète"],
            ["Back Office", "9 modules admin (users, billing, logs, audit...)", "Administration centralisée"],
            ["Carte avancée", "Heatmap, rayon de recherche, distance haversine", "Analyse géospatiale"],
        ],
        col_widths=[3.5*cm, 8*cm, 4.5*cm],
    )

    PB()
    h2("16.4 Phase 4 — V3 Innovation (Mois 15-18)")
    P("""La version 3 (V3) introduit des innovations différenciantes : assistant IA conversationnel, recherche en langage naturel, enrichissement par VLM (vision language model), intégration Mobile Money native, et marketplace de connecteurs. L'objectif est de consolider la position de leader sur le marché ivoirien et d'envisager l'expansion régionale (Afrique de l'Ouest).""")

    h3("16.4.1 Innovations V3")
    bullets([
        "Assistant IA conversationnel : compréhension du langage naturel (FR), traduction automatique en requête structurée, réponse en langage naturel avec résultats",
        "VLM (Vision Language Model) : analyse de captures d'écran de sites web pour extraire des informations visuelles (logos, horaires affichés, certifications)",
        "Marketplace de connecteurs : API publique permettant à des tiers de créer des connecteurs de sources personnalisées",
        "Mobile Money natif : intégration Orange Money, MTN MoMo, Moov Africa pour la facturation et les paiements in-app",
        "Expansion régionale : support multi-pays (Sénégal, Mali, Burkina Faso, Guinée) avec adaptation des sources et référentiels",
        "IA prédictive : prédiction des tendances sectorielles, recommandation de prospection, scoring prédictif de succès commercial",
    ])

    h3("16.4.2 Vision long terme (24+ mois)")
    P("""Au-delà de 18 mois, ScrapIQ CI vise à devenir la plateforme de référence pour la données d'entreprises en Afrique de l'Ouest. Les évolutions envisagées incluent :""")
    bullets([
        "Réseau de 50+ sources de données couvrant 10 pays d'Afrique de l'Ouest",
        "1 million+ d'entreprises indexées avec données enrichies en temps réel",
        "API publique avec 1000+ développeurs tiers (marketplace d'applications)",
        "Intelligence business : recommandations de prospection, scoring prédictif, analyse de marché automatisée",
        "Blockchain pour la traçabilité des données (preuve d'origine, horodatage immutable)",
        "IA générative pour la création automatique de rapports personnalisés",
    ])

    PB()
    h2("16.5 Timeline visuelle")
    code_block("""Gantt simplifié — Roadmap ScrapIQ CI

Phase 1: MVP              |████████████████|         (Mois 1-4)
Phase 2: V1 Production    |         |████████████████|         (Mois 5-8)
Phase 3: V2 Scale         |                  |████████████████████████|  (Mois 9-14)
Phase 4: V3 Innovation    |                                   |████████████████|  (Mois 15-18)

Jalons:
  M4  → MVP livré + 10 beta-testeurs
  M8  → V1 production + 100 utilisateurs payants
  M14 → V2 scale + 1000 utilisateurs + architecture distribuée
  M18 → V3 innovation + assistant IA + expansion régionale""")


def chapter17():
    """Chapitre 17 — Maintenance (10+ pages)"""
    chapter_title(17, "Maintenance")
    intro("""La maintenance de ScrapIQ CI couvre trois dimensions complémentaires : corrective (résolution des bugs), évolutive (ajout de fonctionnalités) et préventive (optimisation, monitoring, mises à jour). Cette stratégie de maintenance garantit la disponibilité, la performance et la sécurité de la plateforme sur le long terme, avec un SLA de 99,9% pour les clients Enterprise.""")

    h2("17.1 Maintenance corrective")
    P("""La maintenance corrective consiste à résoudre les anomalies détectées en production. ScrapIQ CI met en œuvre un processus structuré de gestion des incidents, depuis la détection (monitoring automatique, signalement utilisateur) jusqu'à la résolution (correctif, déploiement, validation). L'objectif est de minimiser le temps de résolution (MTTR - Mean Time To Resolution) et l'impact sur les utilisateurs.""")

    h3("17.1.1 Classification des incidents")
    table(
        ["Niveau", "Description", "MTTR cible", "Escalade"],
        [
            ["P0 — Critique", "Plateforme indisponible, perte de données", "< 1h", "CEO + CTO + équipe on-call"],
            ["P1 — Majeur", "Fonctionnalité clé indisponible, API down", "< 4h", "Lead dev + on-call"],
            ["P2 — Mineur", "Bug fonctionnel, contournement possible", "< 24h", "Lead dev"],
            ["P3 — Cosmétique", "UI/UX, typo, alignment", "< 72h", "Dev team"],
        ],
        col_widths=[2.5*cm, 5*cm, 2.5*cm, 5*cm],
    )

    h3("17.1.2 Processus de résolution")
    P("""Le processus de résolution d'incident suit les étapes suivantes :""")
    bullets([
        "Détection : alerte automatique (Sentry, Prometheus, uptime monitoring) ou signalement utilisateur",
        "Triage : classification du niveau (P0-P3) et assignation à un développeur",
        "Investigation : analyse des logs, reproduction du problème, identification de la cause racine",
        "Correctif : développement du fix, tests (unitaires + intégration), code review",
        "Déploiement : déploiement en staging → validation → production (blue-green)",
        "Post-mortem : analyse de l'incident, plan d'action préventif, documentation",
    ])

    h2("17.2 Maintenance évolutive")
    P("""La maintenance évolutive consiste à ajouter de nouvelles fonctionnalités, améliorer les existantes, et adapter la plateforme aux besoins changeants du marché. Elle représente environ 60% du temps de développement après le lancement.""")

    h3("17.2.1 Processus de développement évolutif")
    table(
        ["Phase", "Activités", "Durée moyenne"],
        [
            ["Idéation", "Analyse des besoins, retours utilisateurs, étude de faisabilité", "1-2 semaines"],
            ["Conception", "Spécifications techniques, architecture, maquettes", "1-2 semaines"],
            ["Développement", "Implémentation, tests unitaires, code review", "2-6 semaines"],
            ["Test", "Tests d'intégration, E2E, performance, sécurité", "1-2 semaines"],
            ["Déploiement", "Staging → production progressive (canary)", "2-3 jours"],
            ["Monitoring", "Suivi des métriques, retours utilisateurs", "1 semaine"],
        ],
        col_widths=[3*cm, 7*cm, 4*cm],
    )

    h2("17.3 Maintenance préventive")
    P("""La maintenance préventive vise à anticiper les problèmes avant qu'ils n'impactent les utilisateurs. Elle inclut le monitoring continu, l'optimisation des performances, les mises à jour de sécurité, et la gestion technique de la dette.""")

    h3("17.3.1 Monitoring continu")
    table(
        ["Métrique", "Outil", "Seuil d'alerte", "Action"],
        [
            ["Uptime", "UptimeRobot + health check", "< 99.9%", "Escalade P0"],
            ["Latence API (P95)", "Prometheus + Grafana", "> 500ms", "Investigation"],
            ["Taux d'erreur", "Sentry", "> 1%", "Investigation immédiate"],
            ["CPU usage", "Grafana", "> 80%", "Auto-scale ou investigation"],
            ["Mémoire", "Grafana", "> 85%", "Investigation memory leak"],
            ["Espace disque", "Grafana", "> 80%", "Cleanup + expansion"],
            ["Queue length", "BullMQ monitoring", "> 50 jobs", "Scale workers"],
            ["Rate limit hits", "Security module", "> 100/h", "Investigation attaque"],
        ],
        col_widths=[3*cm, 3.5*cm, 2.5*cm, 5*cm],
    )

    h3("17.3.2 Mises à jour de sécurité")
    P("""Les mises à jour de sécurité sont appliquées selon le calendrier suivant :""")
    bullets([
        "Dépendances NPM : scan hebdomadaire (npm audit), mise à jour mensuelle",
        "Système d'exploitation (serveurs) : mises à jour de sécurité dans les 48h",
        "Base de données PostgreSQL : mise à jour de version mineure trimestrielle",
        "Next.js / React : mise à jour vers la dernière stable tous les 2 mois",
        "Playwright / Chromium : mise à jour mensuelle (suivi des changements Google Maps)",
        "Audit de sécurité complet : trimestriel (scan OWASP ZAP, penetration testing)",
    ])

    h2("17.4 SLA et support")
    P("""ScrapIQ CI propose trois niveaux de SLA selon le plan d'abonnement :""")

    table(
        ["Plan", "Uptime garanti", "Support", "Temps de réponse", "Canal"],
        [
            ["Starter", "99,5%", "Email", "< 48h", "support@scraapiq.ci"],
            ["Pro", "99,9%", "Email + Chat", "< 8h (business hours)", "Chat in-app + email"],
            ["Enterprise", "99,9%", "Email + Chat + Téléphone", "< 1h (24/7 pour P0)", "Téléphone + chat + email"],
        ],
        col_widths=[2.5*cm, 2.5*cm, 3.5*cm, 3.5*cm, 3*cm],
    )

    h3("17.4.1 Crédits de service")
    P("""En cas de non-respect du SLA, des crédits de service sont accordés automatiquement :""")
    bullets([
        "Uptime < 99,9% sur un mois → 10% du montant mensuel crédité",
        "Uptime < 99,5% sur un mois → 25% du montant mensuel crédité",
        "Uptime < 99,0% sur un mois → 50% du montant mensuel crédité",
        "Indisponibilité P0 > 4h → 1 mois gratuit offert",
    ])


def chapter18():
    """Chapitre 18 — Évolutions (10+ pages)"""
    chapter_title(18, "Évolutions")
    intro("""Les évolutions envisagées pour ScrapIQ CI s'articulent autour de quatre axes stratégiques : l'élargissement de la couverture géographique, l'enrichissement des données par IA, l'ouverture de la plateforme via une marketplace, et l'intégration d'technologies émergentes (blockchain, IA générative). Ces évolutions sont planifiées sur un horizon de 24 à 36 mois.""")

    h2("18.1 Évolutions envisagées")

    h3("18.1.1 Expansion géographique")
    P("""ScrapIQ CI vise à étendre sa couverture à l'ensemble de l'Afrique de l'Ouest dans un délai de 24 mois. Cette expansion se fera par paliers, en commençant par les pays francophones limitrophes de la Côte d'Ivoire, puis en s'étendant progressivement à toute la CEDEAO.""")
    table(
        ["Pays", "Villes cibles", "Sources spécifiques", "Timeline"],
        [
            ["Sénégal", "Dakar, Thiès, Saint-Louis", "Annuaire.sn, SENAU", "Mois 18-20"],
            ["Mali", "Bamako, Sikasso", "Annuaire.ml, RCCM Mali", "Mois 20-22"],
            ["Burkina Faso", "Ouagadougou, Bobo-Dioulasso", "Annuaire.bf, RCCM BF", "Mois 20-22"],
            ["Guinée", "Conakry, Kankan", "Annuaire.gn", "Mois 22-24"],
            ["Ghana", "Accra, Kumasi", "Google Maps GH, Yello", "Mois 24-26"],
            ["Nigeria", "Lagos, Abuja", "Google Maps NG", "Mois 26-30"],
        ],
        col_widths=[2.5*cm, 3.5*cm, 5*cm, 3*cm],
    )

    h3("18.1.2 Enrichissement IA avancé")
    P("""L'enrichissement par IA sera étendu avec de nouvelles capacités :""")
    bullets([
        "VLM (Vision Language Model) : analyse de captures d'écran de sites web pour extraire logos, horaires, certifications, labels qualité",
        "NLP avancé : analyse de sentiments des avis clients Google Maps pour scoring de réputation",
        "IA prédictive : prédiction de la santé financière d'une entreprise à partir de signaux publics (croissance, recrutement, investissements)",
        "Génération de descriptions personnalisées : création automatique de fiches d'entreprises adaptées au contexte (commercial, investisseur, partenaire)",
        "Détection de fraudes : identification d'entreprises avec données suspectes (fausses adresses, téléphones invalides, doublons intentionnels)",
        "Recommandation de prospection : suggestion d'entreprises à contacter selon le profil commercial de l'utilisateur",
    ])

    h3("18.1.3 Marketplace de connecteurs")
    P("""ScrapIQ CI ouvrira une marketplace permettant à des développeurs tiers de créer et vendre des connecteurs de sources de données personnalisées. Cette marketplace fonctionnera sur le modèle revenue-share (70/30) et permettra d'étendre la couverture de sources sans développement interne.""")
    table(
        ["Aspect", "Description"],
        [
            ["Modèle", "API publique + SDK TypeScript/Python pour développer des connecteurs"],
            ["Revenue share", "70% pour le développeur, 30% pour ScrapIQ CI"],
            ["Validation", "Review process (sécurité, qualité, performance) avant publication"],
            ["Pricing", "Gratuit, payant par usage, ou abonnement mensuel"],
            ["Documentation", "Spec OpenAPI complète, exemples, tutoriels"],
            ["Support", "Forum communautaire + support premium pour connecteurs certifiés"],
        ],
        col_widths=[3.5*cm, 11*cm],
    )

    PB()
    h2("18.2 Recherche et développement")

    h3("18.2.1 Axes de R&D")
    P("""La R&D de ScrapIQ CI se concentre sur quatre axes prioritaires :""")
    table(
        ["Axe R&D", "Description", "Investissement", "Horizon"],
        [
            ["IA conversationnelle", "Assistant IA multi-langues (FR, EN, langues locales)", "15 M FCFA/an", "6-12 mois"],
            ["Blockchain traçabilité", "Preuve d'origine des données, horodatage immutable", "10 M FCFA/an", "12-18 mois"],
            ["Edge computing", "Scraping distribué géographiquement (latence réduite)", "8 M FCFA/an", "12-24 mois"],
            ["IA générative rapports", "Génération automatique de rapports personnalisés", "12 M FCFA/an", "6-12 mois"],
        ],
        col_widths=[3.5*cm, 6*cm, 3*cm, 2.5*cm],
    )

    h3("18.2.2 Partenariats académiques")
    P("""ScrapIQ CI établira des partenariats avec les universités ivoiriennes pour :""")
    bullets([
        "Stage et emplois pour étudiants en informatique (Université Félix Houphouët-Boigny, INPHB)",
        "Recherche appliquée sur le NLP pour les langues locales (Nouchi, Dioula, Baoulé)",
        "Études de marché et d'impact économique (data science appliquée)",
        "Hackathons annuels sur le thème du scraping éthique et de la donnée d'entreprise",
    ])

    PB()
    h2("18.3 Innovations futures")

    h3("18.3.1 Technologies émergentes")
    table(
        ["Technologie", "Cas d'usage ScrapIQ CI", "Maturité", "Timeline"],
        [
            ["WebAssembly", "Scraping ultra-rapide côté client (bypass JS rendering)", "Expérimental", "18-24 mois"],
            ["Federated Learning", "Entraînement de modèles IA sans centraliser les données", "Recherche", "24-36 mois"],
            ["Zero-knowledge proofs", "Vérification de données sans révéler la source", "Recherche", "36+ mois"],
            ["Quantum-resistant crypto", "Chiffrement post-quantique pour données sensibles", "Veille", "36+ mois"],
            ["MCP (Model Context Protocol)", "Standardisation des échanges entre agents IA", "Émergent", "12-18 mois"],
        ],
        col_widths=[3.5*cm, 6*cm, 2.5*cm, 2.5*cm],
    )

    h3("18.3.2 Vision 2030")
    P("""À l'horizon 2030, ScrapIQ CI ambitionne de devenir la plateforme de référence pour la données d'entreprises en Afrique francophone, avec :""")
    bullets([
        "10+ pays couverts (CEDEAO + Afrique centrale)",
        "5+ millions d'entreprises indexées",
        "100+ sources de données connectées",
        "10 000+ organisations clientes",
        "Marketplace de 500+ connecteurs",
        "API publique utilisée par 10 000+ développeurs",
        "IA prédictive avec 90% de précision sur les recommandations de prospection",
        "Certification ISO 27001 (sécurité) et ISO 9001 (qualité)",
    ])


def chapter19():
    """Chapitre 19 — Annexes (10+ pages)"""
    chapter_title(19, "Annexes")
    intro("""Les annexes regroupent le glossaire des termes techniques, les références réglementaires et normatives, les contacts du projet, et les documents complémentaires utiles à la compréhension du cahier des charges.""")

    h2("19.1 Glossaire")
    table(
        ["Terme", "Définition"],
        [
            ["API", "Application Programming Interface — interface de programmation permettant à des logiciels de communiquer entre eux"],
            ["BM25", "Okapi BM25 — algorithme de scoring de pertinence utilisé par Elasticsearch pour classer les résultats de recherche"],
            ["BullMQ", "Bibliothèque Node.js pour les queues de jobs asynchrones, basée sur Redis"],
            ["CRUD", "Create, Read, Update, Delete — les 4 opérations de base sur une ressource REST"],
            ["CSR/SSR", "Client-Side Rendering / Server-Side Rendering — stratégies de rendu web"],
            ["Déduplication", "Processus d'identification et de fusion des doublons dans un jeu de données"],
            ["Embedding", "Représentation vectorielle d'un texte, utilisée pour la comparaison sémantique"],
            ["Elasticsearch", "Moteur de recherche distribué basé sur Lucene, avec scoring BM25"],
            ["FCFA / XOF", "Franc CFA — monnaie utilisée en Côte d'Ivoire (1 EUR = 655,957 FCFA)"],
            ["GPS", "Global Positioning System — système de positionnement par satellite"],
            ["Haversine", "Formule calculant la distance entre deux points GPS sur une sphère"],
            ["IndexedDB", "API JavaScript de stockage asynchrone côté client (base de données dans le navigateur)"],
            ["Jaro-Winkler", "Algorithme de similarité entre chaînes de caractères, utilisé pour la déduplication"],
            ["JWT", "JSON Web Token — standard pour l'authentification stateless (RFC 7519)"],
            ["Leaflet", "Bibliothèque JavaScript open-source pour cartographie interactive"],
            ["LLM", "Large Language Model — modèle d'IA générative (ex: GLM-4, GPT-4)"],
            ["MRR", "Monthly Recurring Revenue — revenu mensuel récurrent"],
            ["NLP", "Natural Language Processing — traitement du langage naturel par IA"],
            ["OAuth 2.0", "Protocole d'autorisation déléguée (RFC 6749)"],
            ["OpenStreetMap", "Projet collaboratif de cartographie libre et gratuite"],
            ["pgvector", "Extension PostgreSQL pour le stockage et la recherche de vecteurs"],
            ["PWA", "Progressive Web App — application web installable avec capacités offline"],
            ["RBAC", "Role-Based Access Control — contrôle d'accès basé sur les rôles"],
            ["RCCM", "Registre du Commerce et du Crédit Mobilier — registre officiel des entreprises en CI"],
            ["Redis", "Base de données en mémoire, utilisée comme cache et message broker"],
            ["RGPD / APIPD", "Règlement Général Protection Données (UE) / Autorité de Protection des Données (CI)"],
            ["SaaS", "Software as a Service — logiciel vendu en mode abonnement"],
            ["Scraping", "Extraction automatisée de données depuis des sites web"],
            ["Service Worker", "Script exécuté en arrière-plan par le navigateur (PWA)"],
            ["SLA", "Service Level Agreement — accord de niveau de service"],
            ["TOTP", "Time-based One-Time Password — code 2FA à usage unique (RFC 6238)"],
            ["VLM", "Vision Language Model — modèle d'IA capable d'analyser des images"],
            ["WAF", "Web Application Firewall — pare-feu applicatif web"],
            ["WebSocket", "Protocole de communication bidirectionnelle persistante"],
            ["Z.ai SDK", "SDK JavaScript pour les services d'IA Z.ai (LLM, VLM, TTS, ASR)"],
        ],
        col_widths=[3.5*cm, 11*cm],
    )

    PB()
    h2("19.2 Références et normes")
    table(
        ["Référence", "Description", "Pertinence"],
        [
            ["RFC 7519", "JSON Web Token (JWT)", "Authentification API"],
            ["RFC 6749", "OAuth 2.0 Authorization Framework", "SSO Google/Microsoft"],
            ["RFC 6238", "TOTP: Time-Based One-Time Password", "2FA"],
            ["Loi n°2013-450", "Protection des données personnelles (Côte d'Ivoire)", "Conformité APIPD"],
            ["RGPD (UE) 2016/679", "Règlement général protection données", "Référence pour standards"],
            ["OWASP Top 10", "Top 10 vulnérabilités web", "Sécurité WAF"],
            ["ISO 27001", "Management de la sécurité de l'information", "Certification future"],
            ["OpenAPI 3.0", "Specification REST API", "Documentation Swagger"],
            ["WCAG 2.1", "Web Content Accessibility Guidelines", "Accessibilité"],
            ["PWA Checklist", "Google PWA checklist", "Progressive Web App"],
        ],
        col_widths=[3*cm, 6.5*cm, 5*cm],
    )

    h2("19.3 Contacts")
    table(
        ["Rôle", "Nom", "Email", "Téléphone"],
        [
            ["Product Owner", "Adama Koné", "adama@scraapiq.ci", "+225 07 00 00 00 01"],
            ["Lead Developer", "Mariam Traoré", "mariam@scraapiq.ci", "+225 07 00 00 00 02"],
            ["DevOps", "Sekou Bamba", "sekou@scraapiq.ci", "+225 07 00 00 00 03"],
            ["Support", "support@scraapiq.ci", "—", "+225 27 22 00 00 00"],
        ],
        col_widths=[3*cm, 3.5*cm, 5*cm, 4*cm],
    )

    h2("19.4 Historique des versions")
    table(
        ["Version", "Date", "Auteur", "Changements"],
        [
            ["1.0", "17/07/2026", "Adama Koné", "Version initiale — cahier des charges complet"],
        ],
        col_widths=[2*cm, 3*cm, 4*cm, 6.5*cm],
    )

    PB()
    P("""<para alignment="center"><b>Fin du document</b></para>""")
    SP(20)
    P("""<para alignment="center"><font color="#059669"><b>ScrapIQ CI — Web Scraping Intelligent pour la Côte d'Ivoire</b></font></para>""")
    SP(10)
    P("""<para alignment="center"><font color="#64748b">Document confidentiel — © 2026 ScrapIQ CI — Tous droits réservés</font></para>""")
