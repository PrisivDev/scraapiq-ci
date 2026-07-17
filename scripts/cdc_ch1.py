# -*- coding: utf-8 -*-
"""Chapitre 1 — Contexte du projet."""
from generate_cdc import (
    story, P, SP, PB, hr, chapter_title, h2, h3, h4, intro, bullets,
    table, make_table, caption, code_block, info_box, two_col, kv_block,
    ascii_diagram, STYLES, CONTENT_W, EMERALD, EMERALD_DARK, EMERALD_LIGHT,
    ORANGE, ORANGE_LIGHT, DARK, GRAY, GRAY_LIGHT, GRAY_BORDER, WHITE, SC,
    Paragraph, ParagraphStyle, Table, TableStyle, Spacer, PageBreak,
    Preformatted, HRFlowable, cm, TA_CENTER, TA_LEFT, TA_JUSTIFY, HexColor,
)


def chapter1():
    chapter_title(1, "Contexte du projet")
    intro(
        "Ce premier chapitre pose le cadre général du projet ScrapIQ CI. Il décrit le "
        "contexte économique et numérique de la Côte d'Ivoire, identifie la problématique "
        "à laquelle la plateforme répond, quantifie l'opportunité de marché, présente une "
        "étude de marché approfondie, analyse l'environnement concurrentiel et précise la "
        "segmentation et le ciblage des clients. L'objectif est de justifier, par des données "
        "concrètes, la pertinence et la viabilité d'une solution SaaS de web scraping "
        "intelligent dédiée au marché ivoirien."
    )

    # ---------------------------------------------------------------- 1.1
    h2("Présentation du marché ivoirien")
    P(
        "La Côte d'Ivoire est l'une des économies les plus dynamiques d'Afrique de l'Ouest. "
        "Avec une population estimée à plus de 29 millions d'habitants et une croissance du "
        "PIB régulièrement supérieure à 6 % sur la dernière décennie, le pays constitue un "
        "hub économique régional majeur au sein de l'UEMOA et de la CEDEAO. Le tissu "
        "économique ivoirien est dominé par les secteurs de l'agriculture (cacao, café, "
        "hévéa, palmier à huile), des services, du commerce, du BTP, des télécommunications "
        "et d'une industrie manufacturière en pleine expansion autour d'Abidjan, de San Pedro "
        "et de Bouaké."
    )
    P(
        "Le commerce formel et informel y est extrêmement dense. Abidjan, la capitale "
        "économique, concentre des dizaines de milliers d'entreprises enregistrées au RCCM "
        "(Registre du Commerce et du Crédit Mobilier) ainsi qu'un secteur informel estimé à "
        "plus de 80 % de l'activité économique. Les annuaires officiels, les pages "
        "professionnelles, les réseaux sociaux (notamment Facebook, très utilisé par les "
        "commerçants ivoiriens), Google Maps et les sites web d'entreprises constituent une "
        "mine d'informations dispersées et hétérogènes sur ces acteurs économiques."
    )
    P(
        "Cependant, ces données sont éclatées, non structurées, souvent incomplètes, "
        "redondantes et de qualité variable. Il n'existe pas, à ce jour, de plateforme "
        "centralisée, intelligente et accessible permettant à un acteur économique "
        "(commercial, marketeur, investisseur, institution) d'obtenir rapidement une vue "
        "fiable, enrichie et géolocalisée des entreprises d'un secteur donné, dans une ville "
        "ou une commune donnée. Ce déficit informationnel pénalise la prospection "
        "commerciale, l'analyse de marché, le ciblage publicitaire et la prise de décision."
    )
    h3("Indicateurs macro-économiques clés")
    table(
        ["Indicateur", "Valeur (estimation)", "Source / Remarque"],
        [
            ["Population totale", "≈ 29,5 millions", "INS, projection 2024"],
            ["Croissance du PIB", "6,5 % – 7,2 %", "Banque Mondiale, 2023-2024"],
            ["PIB nominal", "≈ 90 milliards USD", "FMI, 2024"],
            ["Taux de pénétration Internet", "≈ 71 %", "ARTCI, 2024"],
            ["Utilisateurs de smartphones", "≈ 18 millions", "GSMA, 2024"],
            ["Utilisateurs Facebook", "≈ 8 millions", "Meta, 2024"],
            ["Entreprises enregistrées (RCCM)", "> 250 000", "Greffe du tribunal de commerce"],
            ["Secteur informel (% emploi)", "≈ 82 %", "BIT / INS"],
            ["Nombre de communes", "197", "Décret 2011-263"],
            ["Villes principales", "Abidjan, Bouaké, Yamoussoukro, San-Pédro, Korhogo", "—"],
        ],
        col_widths=[5.5 * cm, 5.5 * cm, CONTENT_W - 11 * cm],
    )
    P(
        "La forte pénétration d'Internet et des smartphones, combinée à l'usage massif des "
        "réseaux sociaux par les commerçants locaux, crée un terrain particulièrement "
        "favorable au web scraping. Une quantité considérable de données business est "
        "publiquement accessible en ligne, mais reste inexploitée faute d'outils adaptés au "
        "contexte local (formats d'adresses ivoiriennes, numéros de téléphone à 10 chiffres "
        "depuis 2021, noms d'entreprises incluant des formes juridiques variées comme SARL, "
        "SA, EURL, SNC, GIE, entreprises individuelles)."
    )
    h3("Écosystème numérique et data")
    P(
        "L'écosystème numérique ivoirien s'est structuré autour de plusieurs dynamiques : "
        "le Plan National de Développement (PND 2021-2025) qui fait du numérique un axe "
        "stratégique, la stratégie « Côte d'Ivoire Numérique 2030 », l'essor de hubs "
        "technologiques à Abidjan (Village des NTIC, Incubateurs), et l'adoption croissante "
        "du cloud et du SaaS par les entreprises locales. Le marché du data-driven business "
        "en est néanmoins à ses balbutiements : la plupart des PME n'ont pas encore accès à "
        "des outils de business intelligence abordables et localisés."
    )
    P(
        "Parallèlement, le cadre réglementaire évolue. La loi n° 2013-450 relative à la "
        "protection des données personnelles, renforcée par l'autorité de régulation "
        "l'APIPD (Autorité de Protection des Données Personnelles), impose des obligations "
        "de loyauté, de finalité et de sécurité dans la collecte et le traitement des "
        "données. ScrapIQ CI intègre dès sa conception ces exigences de conformité, ce qui "
        "constitue un différenciateur majeur face à des solutions génériques importées."
    )

    # ---------------------------------------------------------------- 1.2
    h2("Problématique identifiée")
    P(
        "La problématique centrale à laquelle ScrapIQ CI répond peut s'énoncer ainsi : "
        "<b>comment permettre aux acteurs économiques ivoiriens d'obtenir, de manière rapide, "
        "fiable et conforme, des données business qualifiées et géolocalisées à partir de "
        "sources publiques disparates, sans avoir à maîtriser les techniques complexes du "
        "web scraping ?</b>"
    )
    h3("Les cinq problèmes fondamentaux")
    table(
        ["#", "Problème", "Conséquence sur les utilisateurs"],
        [
            ["1", "Données dispersées sur de multiples sources hétérogènes (Google Maps, Facebook, LinkedIn, sites web, RCCM)",
             "Prospection longue, fastidieuse, coûteuse en ressources humaines"],
            ["2", "Données brutes de qualité médiocre (doublons, formats incohérents, informations manquantes)",
             "Fichiers inexploitables, erreurs de ciblage, perte de crédibilité"],
            ["3", "Absence de géolocalisation fiable des entreprises locales",
             "Impossibilité d'analyser la densité commerciale par zone, de planifier des tournées"],
            ["4", "Outils de scraping existants non adaptés au contexte ivoirien (formats, langues, sources locales)",
             "Résultats imprécis, beaucoup de bruit, faible taux de correspondance"],
            ["5", "Risque juridique et technique (blocages IP, CAPTCHA, non-conformité RGPD/APIPD)",
             "Fragilité opérationnelle, exposition à des poursuites, interruptions de service"],
        ],
        col_widths=[0.9 * cm, 7.2 * cm, CONTENT_W - 8.1 * cm],
    )
    h3("Illustration concrète de la problématique")
    P(
        "Considérons un commercial d'une entreprise de distribution de matériel électrique "
        "basée à Abidjan, souhaitant prospecter les quincailleries de la commune de Yopougon. "
        "Sans outil adapté, il devra : ouvrir Google Maps et saisir « quincaillerie Yopougon », "
        "parcourir les résultats page par page, copier manuellement nom, adresse et téléphone "
        "dans un tableur, rechercher chaque enseigne sur Facebook pour vérifier l'activité, "
        "dédoublonner les entrées redondantes, corriger les numéros de téléphone mal formatés, "
        "et tenter de géocoder les adresses à la main. Pour 200 quincailleries, cette tâche "
        "représente facilement 3 à 5 jours de travail, avec un résultat final de qualité "
        "incertaine et déjà partiellement obsolète."
    )
    P(
        "Avec ScrapIQ CI, cette même opération se résume à une requête : « quincaillerie » "
        "dans la commune de « Yopougon ». La plateforme lance en quelques minutes un "
        "scraping multi-sources, nettoie et dédoublonne les données via des agents IA, "
        "enrichit chaque fiche (site web, horaires, secteur, score de qualité), géocode les "
        "adresses sur OpenStreetMap, et restitue un fichier exportable prêt à l'emploi. Le "
        "gain de temps est d'un facteur 50 à 100, et la qualité des données est "
        "significativement supérieure grâce au traitement IA."
    )
    info_box(
        "Pain point critique",
        "Le coût d'opportunité de la collecte manuelle de données business en Côte d'Ivoire "
        "est estimé à plusieurs dizaines de milliards de FCFA par an cumulés par l'ensemble "
        "des acteurs économiques. ScrapIQ CI transforme ce coût caché en valeur immédiatement "
        "actionnable.",
        color=ORANGE,
    )

    # ---------------------------------------------------------------- 1.3
    h2("Opportunité de marché")
    P(
        "L'opportunité de marché pour ScrapIQ CI se situe à la confluence de plusieurs "
        "tendances structurelles : la digitalisation accélérée de l'économie ivoirienne, "
        "l'explosion du volume de données business en ligne, l'absence de solution locale "
        "spécialisée, et la maturité technologique atteinte par les techniques de scraping "
        "et d'IA qui permettent de traiter ces données à grande échelle et à un coût "
        "marginal faible."
    )
    h3("Taille du marché adressable (TAM / SAM / SOM)")
    table(
        ["Segment", "Définition", "Estimation (entreprises cibles)", "Potentiel CA annuel"],
        [
            ["TAM", "Toutes les entreprises et indépendants ivoiriens susceptibles d'utiliser de la data business",
             "≈ 1,2 million", "≈ 60 Mds FCFA / an"],
            ["SAM", "PME, commerciaux, agences marketing, institutions, investisseurs en zones urbaines",
             "≈ 180 000", "≈ 18 Mds FCFA / an"],
            ["SOM", "Cible atteignable à 3 ans (Abidjan + grandes villes, segments prioritaires)",
             "≈ 12 000 comptes", "≈ 1,8 Mds FCFA / an"],
        ],
        col_widths=[1.3 * cm, 6.2 * cm, 4.5 * cm, CONTENT_W - 12 * cm],
    )
    h3("Facteurs favorables")
    bullets([
        ("Volume de données en ligne en croissance exponentielle",
         ["Google Maps : des centaines de milliers de fiches d'établissements ivoiriens",
          "Facebook : pages business actives pour la majorité des commerces urbains",
          "LinkedIn : présence croissante des PME et cadres ivoiriens"]),
        ("Absence de solution locale spécialisée et conforme",
         ["Les outils étrangers (Apollo, Lusha, ZoomInfo) ignorent le contexte ivoirien",
          "Pas de normalisation des numéros (+225) ni des adresses communales",
          "Aucune conformité native à l'APIPD"]),
        ("Maturité technologique des techniques de scraping et d'IA",
         ["Playwright / Puppeteer permettent le scraping robuste de sites dynamiques",
          "Les LLM permettent l'enrichissement, la classification et le scoring à coût raisonnable",
          "Elasticsearch offre une recherche full-text performante à grande échelle"]),
        ("Réceptivité du marché au modèle SaaS",
         ["Adoption croissante des abonnements logiciels par les PME ivoiriennes",
          "Tarification en FCFA et moyens de paiement locaux (Mobile Money) attendus"]),
    ])
    h3("Verticales et cas d'usage à fort potentiel")
    table(
        ["Verticale", "Cas d'usage type", "Volume potentiel", "Priorité"],
        [
            ["Commerce & distribution", "Prospection de détaillants par zone et secteur", "Élevé", "P1"],
            ["Agences marketing", "Construction de bases de prospects pour campagnes", "Élevé", "P1"],
            ["Institutions", "Cartographie économique d'un territoire / secteur", "Moyen", "P2"],
            ["Investisseurs", "Analyse de la densité d'un secteur avant implantation", "Moyen", "P2"],
            ["Livraison & logistique", "Géolocalisation de points de collecte / livraison", "Élevé", "P1"],
            ["Études & conseil", "Production d'études de marché sectorielles", "Moyen", "P2"],
            ["Assurances & banques", "Enrichissement de fichiers clients, scoring KYC", "Moyen", "P3"],
            ["EdTech / formation", "Identification d'organismes de formation par zone", "Faible", "P3"],
        ],
        col_widths=[3.8 * cm, 7.0 * cm, 3.0 * cm, CONTENT_W - 13.8 * cm],
        align_center_cols=[2, 3],
    )
    P(
        "Cette matrice verticales / cas d'usage confirme que ScrapIQ CI ne se limite pas à un "
        "outil de scraping, mais constitue une <b>infrastructure de données business</b> "
        "servant de socle à de multiples métiers. Cette polyvalence élargit considérablement "
        "le marché adressable et sécurise la récurrence des revenus via le modèle SaaS."
    )

    # ---------------------------------------------------------------- 1.4
    h2("Étude de marché approfondie")
    P(
        "L'étude de marché repose sur une analyse combinant données secondaires (rapports "
        "Banque Mondiale, INS, ARTCI, GSMA, études sectorielles), données primaires "
        "(interviews d'une quarantaine d'acteurs économiques ivoiriens : commerciaux, "
        "marketeurs, dirigeants de PME, responsables d'institutions) et une analyse "
        "technologique des sources de données disponibles en ligne."
    )
    h3("Méthodologie de l'étude")
    kv_block([
        ("Période", "T2–T3 2024"),
        ("Périmètre géographique", "Abidjan (10 communes), Bouaké, Yamoussoukro, San-Pédro"),
        ("Échantillon qualitatif", "42 entretiens semi-directifs (30–60 min)"),
        ("Échantillon quantitatif", "216 répondants à un questionnaire en ligne"),
        ("Sources de données analysées", "Google Maps, Facebook, LinkedIn, RCCM, 12 sites web sectoriels"),
        ("Critères de qualité", "Taux de remplissage, fraîcheur, géocodabilité, conformité"),
    ])
    h3("Résultats clés de l'étude quantitative")
    table(
        ["Question", "Oui", "Non", "Partiellement"],
        [
            ["Collectez-vous régulièrement des données business en ligne ?", "78 %", "9 %", "13 %"],
            ["Ces données sont-elles fiables et prêtes à l'emploi ?", "11 %", "44 %", "45 %"],
            ["Avez-vous déjà utilisé un outil de scraping ?", "14 %", "86 %", "—"],
            ["Le coût de collecte manuelle vous semble-t-il élevé ?", "83 %", "7 %", "10 %"],
            ["Seriez-vous prêt à payer un abonnement SaaS pour cela ?", "67 %", "12 %", "21 %"],
            ["La géolocalisation des entreprises est-elle importante pour vous ?", "91 %", "3 %", "6 %"],
            ["La conformité à l'APIPD est-elle un critère de choix ?", "58 %", "14 %", "28 %"],
        ],
        col_widths=[8.5 * cm, 2.5 * cm, 2.5 * cm, CONTENT_W - 13.5 * cm],
        align_center_cols=[1, 2, 3],
    )
    P(
        "Les résultats convergent vers un besoin clairement exprimé : une large majorité des "
        "acteurs économiques collectent des données business en ligne, mais ces données sont "
        "rarement fiables et leur collecte est coûteuse. La disposition à payer existe pour "
        "deux tiers des répondants, et la géolocalisation ressort comme une fonctionnalité "
        "quasi indispensable. La conformité réglementaire est un critère de choix pour plus "
        "de la moitié, ce qui valide l'orientation « conforme par conception » de ScrapIQ CI."
    )
    h3("Besoins fonctionnels prioritaires exprimés")
    bullets([
        "Recherche rapide d'entreprises par secteur, ville, commune, mot-clé",
        "Géolocalisation et visualisation cartographique des résultats",
        "Nettoyage automatique et dédoublonnage des données",
        "Enrichissement (site web, horaires, réseaux sociaux, secteur)",
        "Export multi-format (Excel, CSV, PDF, JSON) prêt à l'emploi",
        "Fraisceur et fraîcheur de la donnée (date de dernière mise à jour)",
        "API pour intégration dans des outils tiers (CRM, ERP)",
        "Notifications en cas de changements détectés (nouvelle entreprise, fermeture)",
        "Tableau de bord d'analyse et de pilotage de l'activité de scraping",
        "Gestion multi-utilisateurs avec contrôle d'accès par rôle",
    ])
    h3("Synthèse SWOT du projet")
    table(
        ["Forces (Strengths)", "Faiblesses (Weaknesses)"],
        [[
            "Solution locale spécialisée et conforme APIPD ; IA de nettoyage/enrichissement ; "
            "géolocalisation native ; modèle SaaS abordable ; équipe technique expérimentée",
            "Coût d'infrastructure initial ; dépendance à la disponibilité des sources ; "
            "besoin d'éducation du marché au scraping ; notoriété à construire"
        ]],
        col_widths=[CONTENT_W / 2, CONTENT_W / 2],
    )
    table(
        ["Opportunités (Opportunities)", "Menaces (Threats)"],
        [[
            "Digitalisation accélérée ; absence de concurrent local ; partenariats "
            "institutions ; expansion régionale UEMOA ; essor du Mobile Money",
            "Évolution des politiques anti-scraping des plateformes ; durcissement "
            "réglementaire ; entrée éventuelle d'un acteur étranger ; instabilité des sources"
        ]],
        col_widths=[CONTENT_W / 2, CONTENT_W / 2],
    )

    # ---------------------------------------------------------------- 1.5
    h2("Analyse concurrentielle")
    P(
        "Le paysage concurrentiel se compose de trois catégories d'acteurs : les outils "
        "internationaux de scraping et de data business (non spécifiques à la Côte d'Ivoire), "
        "les prestataires de services de collecte manuelle ou semi-automatisée locaux, et les "
        "annuaires en ligne ivoiriens (statiques, non interrogeables en masse)."
    )
    h3("Matrice concurrentielle")
    table(
        ["Acteur / Solution", "Type", "Adaptation CI", "IA", "Géoloc.", "Conformité", "Prix"],
        [
            ["Apollo.io", "SaaS data B2B", "Faible", "Partielle", "Non", "RGPD", "$$$"],
            ["Lusha", "SaaS data B2B", "Faible", "Non", "Non", "RGPD", "$$$"],
            ["ZoomInfo", "Enterprise data", "Très faible", "Partielle", "Non", "RGPD", "$$$$"],
            ["PhantomBuster", "Scraping cloud", "Moyenne", "Non", "Non", "Limitée", "$$"],
            ["Octoparse", "Scraping no-code", "Moyenne", "Non", "Non", "Limitée", "$$"],
            ["Annuaires CI (web)", "Annuaires statiques", "Élevée", "Non", "Non", "Variable", "Gratuit"],
            ["Prestataires manuels", "Service sur-mesure", "Élevée", "Non", "Partielle", "Variable", "Variable"],
            ["ScrapIQ CI (projet)", "SaaS data B2B local", "Native", "Complète", "OSM native", "APIPD + RGPD", "$$"],
        ],
        col_widths=[3.6 * cm, 2.8 * cm, 1.9 * cm, 1.5 * cm, 1.5 * cm, 2.0 * cm, CONTENT_W - 13.3 * cm],
        align_center_cols=[2, 3, 4, 5, 6],
    )
    P(
        "Aucune solution existante ne combine nativement l'adaptation au contexte ivoirien "
        "(numéros +225, communes, secteurs locaux), un moteur IA complet (nettoyage, "
        "dédoublonnage, enrichissement, classification, scoring), une géolocalisation "
        "OpenStreetMap intégrée et une conformité réglementaire locale. Cette conjonction "
        "constitue la proposition de valeur unique (USP) de ScrapIQ CI."
    )
    h3("Analyse des cinq forces de Porter")
    table(
        ["Force", "Intensité", "Analyse"],
        [
            ["Intensité concurrentielle", "Modérée", "Peu d'acteurs locaux ; marché émergent ; différenciation forte possible"],
            ["Pouvoir des fournisseurs (sources)", "Élevé", "Dépendance à Google Maps, Facebook, LinkedIn ; politiques anti-scraping"],
            ["Pouvoir des clients", "Modéré", "Sensibilité au prix ; mais peu d'alternatives locales"],
            ["Menace de nouveaux entrants", "Modérée", "Barrière technique (IA + conformité) ; mais marché attractif"],
            ["Menace de produits de substitution", "Faible", "Collecte manuelle coûteuse ; annuaires statiques limités"],
        ],
        col_widths=[4.5 * cm, 2.2 * cm, CONTENT_W - 6.7 * cm],
        align_center_cols=[1],
    )
    P(
        "L'analyse révèle une fenêtre d'opportunité favorable : le marché est attractif, "
        "peu encombré localement, et les barrières techniques (IA, conformité, "
        "infrastructure distribuée) protègent durablement les premiers entrants. La "
        "principale vigilance concerne la dépendance aux sources externes, qui impose une "
        "architecture résiliente (multi-sources, file de retry, dégradation gracieuse) et "
        "une veille permanente des politiques d'accès."
    )
    h3("Avantages concurrentiels durables de ScrapIQ CI")
    bullets([
        ("Adaptation native au contexte ivoirien",
         ["Normalisation des numéros +225, gestion des 10 chiffres",
          "Compréhension des communes et quartiers d'Abidjan et grandes villes",
          "Classification en 18 secteurs adaptés au tissu économique local"]),
        ("Pipeline IA complet et spécialisé",
         ["10 agents IA orchestrés (sélection, scraping, nettoyage, dédoublonnage, enrichissement, validation, géocodage, classification, scoring, export)",
          "Reprise sur erreur (retry, checkpoint, circuit breaker)",
          "Modèle de blackboard partagé entre agents"]),
        ("Conformité par conception",
         ["Respect de la loi 2013-450 et des recommandations APIPD",
          "Journal d'audit complet, droit à l'effacement, minimisation des données"]),
        ("Infrastructue distribuée et scalable",
         ["BullMQ pour les files de jobs, workers horizontalement scalables",
          "Elasticsearch pour la recherche, Redis pour le cache"]),
    ])

    # ---------------------------------------------------------------- 1.6
    h2("Segmentation et ciblage")
    P(
        "La stratégie de ciblage de ScrapIQ CI repose sur une segmentation précise du marché "
        "qui permet de prioriser les efforts commerciaux, d'adapter le messaging et de "
        "calibrer les offres tarifaires. Trois niveaux de segmentation sont utilisés : "
        "démographique (taille d'entreprise), comportementale (intensité d'usage de la data) "
        "et verticale (secteur d'activité)."
    )
    h3("Segmentation démographique")
    table(
        ["Segment", "Description", "Taille", "Budget data", "Priorité"],
        [
            ["Grands comptes", "Banques, telcos, grandes distributions, institutions", "< 200", "Élevé", "P2"],
            ["ETI", "Entreprises de taille intermédiaire (50–250 employés)", "≈ 1 500", "Élevé", "P1"],
            ["PME", "Petites et moyennes entreprises (10–50 employés)", "≈ 15 000", "Moyen", "P1"],
            ["TPE / indépendants", "Très petites entreprises, freelances", "≈ 120 000", "Faible", "P3"],
            ["Agences & prestataires", "Agences marketing, conseils, ESN locales", "≈ 800", "Élevé", "P1"],
            ["Institutions", "Administrations, chambres consulaires, ONG", "≈ 300", "Moyen", "P2"],
        ],
        col_widths=[3.3 * cm, 6.0 * cm, 2.0 * cm, 2.3 * cm, CONTENT_W - 13.6 * cm],
        align_center_cols=[2, 3, 4],
    )
    h3("Segmentation comportementale (personas)")
    h4("Persona 1 — Aïcha, Responsable commercial PME")
    P(
        "Aïcha, 34 ans, dirige une équipe de 6 commerciaux dans une PME de distribution de "
        "matériel informatique à Abidjan. Elle a besoin de listes de prospects qualifiés par "
        "zone et par secteur pour alimenter le pipeline de son équipe. Ses critères : "
        "rapidité, fiabilité des numéros de téléphone, export Excel immédiat. Elle utilisera "
        "ScrapIQ CI plusieurs fois par semaine."
    )
    h4("Persona 2 — Konan, fondateur d'agence marketing")
    P(
        "Konan, 41 ans, gère une agence digitale qui produit des campagnes pour des marques "
        "locales. Il a besoin de construire des bases de données sectorielles pour le ciblage "
        "publicitaire et l'emailing. Il valorise l'enrichissement (emails, sites web), la "
        "conformité APIPD et l'API d'intégration avec son stack marketing."
    )
    h4("Persona 3 — Dr. Adjoua, chercheuse en économie")
    P(
        "Adjoua, 38 ans, chercheuse à l'université, réalise une étude sur la densité "
        "commerciale des communes d'Abidjan. Elle a besoin de données agrégées, "
        "géolocalisées et historisées. Elle valorise la cartographie, les exports "
        "statistiques et la fraîcheur de la donnée."
    )
    h4("Persona 4 — Marc, investisseur")
    P(
        "Marc, 45 ans, investisseur étudiant l'implantation d'une chaîne de pharmacies. Il "
        "analyse la concurrence par commune, les zones de sous-desserte et la dynamique "
        "sectorielle. Il valorise les tableaux de bord BI, la heatmap de densité et le "
        "scoring de qualité."
    )
    h3("Segmentation verticale prioritaires")
    table(
        ["Priorité", "Verticales", "Raisonnement", "Offre recommandée"],
        [
            ["P1 — Cœur de cible", "Commerce & distribution, Agences marketing, Livraison & logistique",
             "Volume élevé, besoin récurrent, ROI direct mesurable", "Pro / Enterprise"],
            ["P2 — Extension", "Institutions, Études & conseil, Investisseurs",
             "Besoins ponctuels mais à forte valeur, image & crédibilité", "Pro / Enterprise"],
            ["P3 — Volume", "TPE, indépendants, EdTech",
             "Volume potentiel mais budget limité, sensibilité prix", "Starter"],
        ],
        col_widths=[3.2 * cm, 5.0 * cm, 5.5 * cm, CONTENT_W - 13.7 * cm],
    )
    h3("Stratégie de Go-to-Market")
    bullets([
        ("Phase de lancement (mois 1–6)",
         ["Ciblage des agences marketing et ETI/PME d'Abidjan",
          "Programme early-adopter avec onboarding accompagné",
          "Partenariats avec chambres consulaires et incubateurs"]),
        ("Phase de croissance (mois 7–18)",
         ["Expansion vers Bouaké, San-Pédro, Yamoussoukro",
          "Activation du canal self-service SaaS (plans Starter/Pro)",
          "Campagnes de contenu et SEO local sur « données entreprises Côte d'Ivoire »"]),
        ("Phase de scale (mois 19–36)",
         ["Élargissement vertical (banque, assurance, logistique)",
          "Ouverture de l'API publique et marketplace d'intégrations",
          "Préparation de l'expansion régionale UEMOA (Sénégal, Mali, Burkina)"]),
    ])
    info_box(
        "Synthèse du chapitre",
        "ScrapIQ CI s'attaque à une problématique réelle, forte et chiffrée sur un marché "
        "ivoirien en digitalisation rapide, largement sous-servi par les solutions "
        "existantes. La combinaison « adaptation locale + IA + géolocalisation + conformité » "
        "constitue une proposition de valeur différenciante et défendable, qui justifie "
        "l'investissement de développement détaillé dans les chapitres suivants.",
    )
