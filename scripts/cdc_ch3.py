# -*- coding: utf-8 -*-
"""Chapitre 3 — Fonctionnalités détaillées."""
from cdc_common import *  # noqa: F401,F403


def chapter3():
    chapter_title(3, "Fonctionnalités détaillées")
    intro(
        "Ce chapitre décrit exhaustivement l'ensemble des fonctionnalités de la plateforme "
        "ScrapIQ CI, organisées par module. Chaque module est présenté avec ses capacités, "
        "ses règles de gestion, ses paramètres et ses interactions avec les autres modules. "
        "Cette description constitue la spécification fonctionnelle de référence pour les "
        "équipes de développement et de test. Les modules couvrent l'ensemble du périmètre "
        "produit : scraping multi-sources, IA cleaner, recherche, cartographie, exports, "
        "notifications, API REST, authentification, RBAC, PWA, Business Intelligence, SaaS "
        "Enterprise, agents IA multi-agents et sécurité globale."
    )

    # ================================================================ 3.1
    h2("Scraping multi-sources")
    P(
        "Le module de scraping multi-sources est le moteur de collecte de la plateforme. Il "
        "permet, à partir d'une requête unique (mot-clé + localisation), de collecter en "
        "parallèle des données business depuis quatre sources principales : Google Maps, "
        "Facebook, LinkedIn et les sites web génériques. Le RCCM est également intégré comme "
        "source complémentaire pour l'enrichissement juridique."
    )
    h3("Sources supportées")
    table(
        ["Source", "Type de données", "Volume typique", "Fiabilité", "Fréquence MAJ"],
        [
            ["Google Maps", "Nom, adresse, tél, GPS, note, avis, horaires", "Élevé", "Élevée", "Temps réel"],
            ["Facebook", "Page, description, tél, email, horaires, posts", "Élevé", "Moyenne", "Quotidien"],
            ["LinkedIn", "Entreprise, secteur, effectif, site web, dirigeants", "Moyen", "Élevée", "Hebdo"],
            ["Sites web", "Coordonnées, services, produits, emails", "Variable", "Variable", "Variable"],
            ["RCCM", "Forme juridique, capital, dirigeants, immatriculation", "Faible volume", "Très élevée", "Annuel"],
        ],
        col_widths=[2.6 * cm, 5.5 * cm, 2.4 * cm, 2.2 * cm, CONTENT_W - 12.7 * cm],
        align_center_cols=[2, 3, 4],
    )
    h3("Déroulement d'un job de scraping")
    P(
        "Lorsqu'un utilisateur lance un job de scraping, la plateforme construit des "
        "requêtes adaptées à chaque source (par exemple « quincaillerie Yopougon » pour "
        "Google Maps, « quincaillerie Yopougon Abidjan » pour Facebook). Chaque source est "
        "interrogée par un scraper Playwright dédié qui simule un navigateur headless, "
        "gère les popups, scrolls et CAPTCHAs simples, et extrait les données structurées. "
        "Les résultats bruts sont normalisés dans un format intermédiaire commun puis "
        "transmis au pipeline IA pour nettoyage et enrichissement."
    )
    code_block(
        "// Exemple : lancement d'un job de scraping multi-sources\n"
        "POST /api/v1/scraping/jobs\n"
        "Authorization: Bearer <jwt>\n"
        "Content-Type: application/json\n"
        "\n"
        "{\n"
        '  "query": "quincaillerie",\n'
        '  "city": "Abidjan",\n'
        '  "commune": "Yopougon",\n'
        '  "sources": ["google_maps", "facebook", "website"],\n'
        '  "maxResults": 200,\n'
        '  "enrich": true,\n'
        '  "dedupe": true\n'
        "}\n"
        "\n"
        "// Réponse 201 Created\n"
        "{\n"
        '  "jobId": "job_a1b2c3d4",\n'
        '  "status": "queued",\n'
        '  "estimatedDuration": 75,\n'
        '  "webhookUrl": "/api/v1/notifications/stream/job_a1b2c3d4"\n'
        "}",
        caption_text="Figure 3.1 — Lancement d'un job de scraping multi-sources",
    )
    h3("Scraper Google Maps")
    P(
        "Le scraper Google Maps utilise Playwright pour naviguer sur maps.google.com, "
        "saisir la requête, scroller la liste de résultats, et extraire pour chaque "
        "établissement : nom, note, nombre d'avis, adresse, numéro de téléphone, site web, "
        "horaires d'ouverture, catégorie, coordonnées GPS et lien vers la fiche détaillée. "
        "Il gère la pagination infinie et les fenêtres de détail. Un mécanisme de "
        "rate-limiting et de rotation d'IP limite le risque de blocage."
    )
    h3("Scraper Facebook")
    P(
        "Le scraper Facebook interroge la recherche de pages business, extrait la "
        "description, les coordonnées (téléphone, email, site), les horaires, le nombre "
        "d'abonnés, et les derniers posts. Il prend en compte la pagination des résultats "
        "et la fermeture des popups de connexion. Les données Facebook sont "
        "particulièrement utiles pour les commerces de proximité qui n'ont pas de site web."
    )
    h3("Scraper LinkedIn")
    P(
        "Le scraper LinkedIn cible les pages d'entreprises (Company Pages) pour extraire le "
        "secteur d'activité, l'effectif, le siège, le site web, la description et les "
        "dirigeants. L'accès à LinkedIn requiert une authentification et un usage "
        "raisonné ; la plateforme applique un quota strict et des délais aléatoires entre "
        "requêtes pour respecter les conditions d'utilisation."
    )
    h3("Scraper de sites web génériques")
    P(
        "Le scraper de sites web génériques prend en entrée une liste d'URLs (issues des "
        "autres sources ou saisies par l'utilisateur) et extrait automatiquement les "
        "coordonnées : emails (regex + validation), téléphones (+225), adresses, horaires, "
        "et une description du contenu. Il utilise des heuristiques basées sur la structure "
        "HTML et des sélecteurs communs (footer, page contact)."
    )
    h3("Règles de gestion et garde-fous")
    bullets([
        "Respect du fichier robots.txt de chaque source (paramétrable par source)",
        "Rate limiting par source (délai minimal entre requêtes, configurable)",
        "Rotation de proxies et user-agents pour limiter les blocages",
        "Détection de CAPTCHA avec mise en file d'attente manuelle en option",
        "Timeout par page (30 s) et par job (15 min)",
        "Reprise sur erreur : 3 retry avec backoff exponentiel",
        "Limitation du nombre de résultats par source (configurable, défaut 200)",
        "Journalisation de chaque requête sortante pour audit",
    ])
    h3("Paramètres configurables d'un job")
    table(
        ["Paramètre", "Type", "Défaut", "Description"],
        [
            ["query", "string", "—", "Mot-clé de recherche (ex. quincaillerie)"],
            ["city", "string", "—", "Ville (ex. Abidjan)"],
            ["commune", "string?", "null", "Commune optionnelle (ex. Yopougon)"],
            ["sources", "string[]", "toutes", "Sources à interroger"],
            ["maxResults", "int", "200", "Nombre maximal de résultats par source"],
            ["enrich", "bool", "true", "Activer l'enrichissement IA"],
            ["dedupe", "bool", "true", "Activer le dédoublonnage"],
            ["geocode", "bool", "true", "Activer le géocodage des adresses"],
            ["language", "string", "fr", "Langue des requêtes"],
            ["schedule", "cron?", "null", "Planification récurrente optionnelle"],
        ],
        col_widths=[2.8 * cm, 2.0 * cm, 2.2 * cm, CONTENT_W - 7 * cm],
    )

    # ================================================================ 3.2
    h2("IA cleaner (nettoyage, dédoublonnage, enrichissement)")
    P(
        "L'IA cleaner est le cœur différenciant de ScrapIQ CI. Il transforme les données "
        "brutes, hétérogènes et imparfaites issues du scraping en un jeu de données propre, "
        "enrichi, dédoublonné, classifié et scoré. Ce module est implémenté sous forme d'un "
        "pipeline de 10 agents IA orchestrés (détaillé au chapitre 3.13), mais ses "
        "fonctionnalités sont décrites ici du point de vue utilisateur et métier."
    )
    h3("Nettoyage et normalisation")
    table(
        ["Champ", "Transformation", "Exemple"],
        [
            ["Téléphone", "Formatage +225, 10 chiffres, espacement", "07 00 11 22 33 → +225 07 00 11 22 33"],
            ["Email", "Minuscules, trim, validation regex + MX", "Contact@Boutique.CI → contact@boutique.ci"],
            ["Nom entreprise", "Retrait des formes juridiques, title case", "SARL BOUTIQUE DU CENTRE → Boutique du Centre"],
            ["Adresse", "Normalisation des abréviations, communes", "Rte de Dabou, Yopougon → Route de Dabou, Yopougon"],
            ["Site web", "Préfixe https, rejet des invalides", "boutique.ci → https://boutique.ci"],
            ["Horaires", "Format 24h standardisé", "9h-18h → 09:00-18:00"],
            ["GPS", "Conversion degrés décimaux, précision 5", "5.34, -4.024 → 5.34000, -4.02400"],
        ],
        col_widths=[2.6 * cm, 6.0 * cm, CONTENT_W - 8.6 * cm],
    )
    h3("Dédoublonnage intelligent")
    P(
        "Le dédoublonnage identifie les fiches représentant la même entreprise réelle à "
        "partir de sources différentes. Il s'appuie sur un score de similarité combinant "
        "plusieurs signaux : similarité du nom (Levenshtein + token-based), proximité "
        "géographique (distance GPS < 100 m), matching de téléphone normalisé, et matching "
        "d'email. Au-dessus d'un seuil de confiance (configurable, défaut 0,82), les fiches "
        "sont fusionnées en conservant la meilleure valeur de chaque champ (la plus complète "
        "ou la plus récente)."
    )
    code_block(
        "// Algorithme de fusion (pseudo-code)\n"
        "function shouldMerge(a, b):\n"
        "  score = 0\n"
        "  if phoneMatch(a.phone, b.phone): score += 0.45\n"
        "  if emailMatch(a.email, b.email):  score += 0.35\n"
        "  nameSim = tokenSimilarity(a.name, b.name)\n"
        "  score += nameSim * 0.30\n"
        "  if geoDistance(a.gps, b.gps) < 100: score += 0.20\n"
        "  return score >= MERGE_THRESHOLD  // 0.82 par défaut\n"
        "\n"
        "function merge(a, b):\n"
        "  merged = {}\n"
        "  for field in FIELDS:\n"
        "    merged[field] = bestOf(a[field], b[field])  // plus complet / plus récent\n"
        "  merged.fusionScore = confidence\n"
        "  merged.sources = union(a.sources, b.sources)\n"
        "  return merged",
        caption_text="Figure 3.2 — Logique de dédoublonnage et de fusion",
    )
    h3("Enrichissement")
    P(
        "L'enrichissement complète chaque fiche avec des informations absentes des sources "
        "brutes : description générée ou complétée via LLM, horaires d'ouverture, site web, "
        "réseaux sociaux, gamme de produits/services, et indications de notoriété (note, "
        "avis). L'enrichissement s'appuie sur des règles métier (par exemple déduire le "
        "secteur du nom) et sur des appels LLM pour les champs textuels. Il est exécuté en "
        "parallèle du pipeline de validation pour optimiser le temps total."
    )
    h3("Validation")
    P(
        "La validation vérifie la cohérence de chaque champ : validité syntaxique des "
        "emails (regex RFC), existence du domaine (résolution MX), validité des numéros "
        "+225 (longueur, opérateur), accessibilité des sites web (HTTP HEAD), et détection "
        "des établissements fermés (mentions « fermé », « définitivement fermé » dans les "
        "avis). Chaque champ reçoit un statut : valid, invalid, suspect, unknown."
    )
    h3("Classification sectorielle")
    P(
        "Chaque entreprise est classée dans l'un des 18 secteurs économiques ivoiriens "
        "prédéfinis. La classification est hybride : un moteur de règles basé sur les "
        "mots-clés du nom et de la description propose un secteur, et un LLM valide ou "
        "corrige la proposition en s'appuyant sur le contexte. Les 18 secteurs sont : "
        "Commerce de détail, Commerce de gros, Restauration, Hôtellerie, Santé, Éducation, "
        "BTP & construction, Transport & logistique, Services financiers, Télécom & tech, "
        "Industrie manufacturière, Agriculture, Artisanat, Beauté & bien-être, Loisirs & "
        "tourisme, Immobilier, Services professionnels, Autres."
    )
    h3("Scoring de qualité")
    P(
        "Le scoring attribue à chaque entreprise une note de 0 à 100 calculée comme une "
        "moyenne pondérée de 7 dimensions : complétude des champs (poids 25 %), validité "
        "des coordonnées (20 %), fraîcheur de la donnée (15 %), richesse de l'enrichissement "
        "(15 %), fiabilité des sources (10 %), cohérence interne (10 %), et présence en "
        "ligne (5 %). Le score est traduit en une catégorie A (≥ 80), B (65–79), C (50–64) "
        "ou D (< 50) qui guide la priorisation des actions commerciales."
    )
    table(
        ["Dimension", "Poids", "Description"],
        [
            ["Complétude des champs", "25 %", "Proportion de champs renseignés parmi les attendus"],
            ["Validité des coordonnées", "20 %", "Tél et email validés techniquement"],
            ["Fraîcheur de la donnée", "15 %", "Ancienneté depuis la dernière mise à jour"],
            ["Richesse de l'enrichissement", "15 %", "Présence de description, horaires, site"],
            ["Fiabilité des sources", "10 %", "Nombre et qualité des sources convergentes"],
            ["Cohérence interne", "10 %", "Concordance nom/secteur/adresse"],
            ["Présence en ligne", "5 %", "Site web actif et réseaux sociaux"],
        ],
        col_widths=[4.8 * cm, 1.6 * cm, CONTENT_W - 6.4 * cm],
        align_center_cols=[1],
    )

    # ================================================================ 3.3
    h2("Moteur de recherche Elasticsearch")
    P(
        "Le moteur de recherche est bâti sur Elasticsearch et indexe l'ensemble des "
        "entreprises collectées et nettoyées. Il offre une recherche full-text rapide "
        "(< 150 ms), tolérante aux fautes (fuzzy matching), multi-critères et "
        "facettée. C'est le composant central de l'expérience utilisateur de "
        "découverte des données."
    )
    h3("Capacités de recherche")
    bullets([
        "Recherche full-text sur nom, description, secteur, adresse, mots-clés",
        "Fuzzy matching (tolérance aux fautes de frappe, distance d'édition ≤ 2)",
        "Filtres : secteur, ville, commune, score, catégorie A/B/C/D, source, fraîcheur",
        "Recherche géographique : rayon autour d'un point, dans un polygone (commune)",
        "Tri : pertinence, score qualité, nom, date de mise à jour, distance",
        "Facettes agrégées : compte par secteur, par commune, par catégorie",
        "Suggestion automatique (autocomplete) sur les noms et secteurs",
        "Mise en surbrillance (highlight) des termes recherchés dans les résultats",
    ])
    h3("Structure d'index Elasticsearch")
    code_block(
        "// Mapping de l'index 'companies' (extrait)\n"
        "{\n"
        '  "mappings": {\n'
        '    "properties": {\n'
        '      "name":            { "type": "text", "analyzer": "french" },\n'
        '      "name_keyword":    { "type": "keyword" },\n'
        '      "description":     { "type": "text", "analyzer": "french" },\n'
        '      "sector":          { "type": "keyword" },\n'
        '      "sectorCode":      { "type": "keyword" },\n'
        '      "city":            { "type": "keyword" },\n'
        '      "commune":         { "type": "keyword" },\n'
        '      "phone":           { "type": "keyword" },\n'
        '      "email":           { "type": "keyword" },\n'
        '      "website":         { "type": "keyword" },\n'
        '      "score":           { "type": "integer" },\n'
        '      "grade":           { "type": "keyword" },\n'
        '      "location":        { "type": "geo_point" },\n'
        '      "sources":         { "type": "keyword" },\n'
        '      "updatedAt":       { "type": "date" },\n'
        '      "keywords":        { "type": "text", "analyzer": "french" }\n'
        "    }\n"
        "  }\n"
        "}",
        caption_text="Figure 3.3 — Mapping Elasticsearch de l'index companies",
    )
    h3("Exemple de requête de recherche")
    code_block(
        "// Recherche : pharmacies à Abidjan, score ≥ 65, tri par pertinence\n"
        "GET /api/v1/companies/search\n"
        "?q=pharmacie&city=Abidjan&minScore=65&sort=relevance&page=1&size=20\n"
        "\n"
        "// DSL Elasticsearch correspondant\n"
        "{\n"
        '  "query": {\n'
        '    "bool": {\n'
        '      "must": [\n'
        '        { "match": { "name": { "query": "pharmacie", "fuzziness": "AUTO" } } }\n'
        '      ],\n'
        '      "filter": [\n'
        '        { "term":  { "city": "Abidjan" } },\n'
        '        { "range": { "score": { "gte": 65 } } }\n'
        '      ]\n'
        '    }\n'
        "  },\n"
        '  "sort": [ "_score", { "score": "desc" } ],\n'
        '  "from": 0, "size": 20,\n'
        '  "aggs": {\n'
        '    "by_sector":  { "terms": { "field": "sector" } },\n'
        '    "by_commune": { "terms": { "field": "commune" } },\n'
        '    "by_grade":   { "terms": { "field": "grade" } }\n'
        "  }\n"
        "}",
        caption_text="Figure 3.4 — Recherche multi-critères avec agrégations",
    )

    # ================================================================ 3.4
    h2("Cartographie OpenStreetMap")
    P(
        "La cartographie est un différenciateur fort de ScrapIQ CI. Elle s'appuie sur "
        "OpenStreetMap (OSM), solution libre et gratuite, pour afficher les entreprises "
        "géolocalisées, calculer des densités, dessiner des rayons et des zones, et "
        "produire des heatmaps. Le rendu utilise Leaflet côté frontend avec des tuiles OSM."
    )
    h3("Fonctionnalités cartographiques")
    table(
        ["Fonctionnalité", "Description", "Cas d'usage"],
        [
            ["Affichage des marqueurs", "Points colorés par catégorie A/B/C/D", "Vue d'ensemble d'un secteur"],
            ["Heatmap de densité", "Intensité de couleur selon la concentration", "Identifier les zones saturées / sous-desservies"],
            ["Recherche par rayon", "Cercle de rayon configurable autour d'un point", "Prospection de proximité"],
            ["Filtres géographiques", "Sélection par commune (polygone)", "Ciblage d'un quartier"],
            ["Clustering", "Regroupement des marqueurs proches au zoom arrière", "Performance d'affichage à grande échelle"],
            ["Détail au clic", "Popup avec fiche entreprise résumée", "Consultation rapide"],
            ["Export visuel", "Capture PNG de la carte avec légende", "Inclusion dans un rapport"],
            ["Itinéraire", "Calcul de trajet entre points (OSRM)", "Planification de tournées commerciales"],
        ],
        col_widths=[3.6 * cm, 7.0 * cm, CONTENT_W - 10.6 * cm],
    )
    h3("Géocodage des adresses")
    P(
        "Le géocodage transforme les adresses textuelles (souvent imprécises en Côte "
        "d'Ivoire) en coordonnées GPS exploitables. Il utilise le service Nominatim d'OSM "
        "avec une étape de pré-normalisation des adresses (commune, quartier, point de "
        "repère connu). Pour les adresses introuvables, un fallback utilise le centroïde de "
        "la commune. Le taux de géocodage réussi cible est ≥ 92 %."
    )

    # ================================================================ 3.5
    h2("Exports multi-formats")
    P(
        "Le module d'exports permet à l'utilisateur de récupérer les données collectées et "
        "traitées dans le format le mieux adapté à son usage. Quatre formats natifs sont "
        "supportés : Excel (XLSX), CSV, PDF et JSON. L'utilisateur sélectionne les champs à "
        "exporter, applique d'éventuels filtres, et déclenche la génération asynchrone du "
        "fichier, notifié à la fin."
    )
    h3("Formats et caractéristiques")
    table(
        ["Format", "Usage privilégié", "Particularités", "Limite (plan Pro)"],
        [
            ["XLSX", "Travail opérationnel (commerciaux)", "En-têtes, filtres, onglets multiples, mise en forme", "50 000 lignes"],
            ["CSV", "Import CRM / outils tiers", "UTF-8, séparateur ; configurable", "100 000 lignes"],
            ["PDF", "Rapports, présentations", "Mise en page tableur + carte + légende", "5 000 lignes"],
            ["JSON", "Intégration API / pipeline data", "Structure hiérarchique complète", "100 000 enregistrements"],
        ],
        col_widths=[1.8 * cm, 4.2 * cm, 6.5 * cm, CONTENT_W - 12.5 * cm],
    )
    h3("Sélection de champs à l'export")
    P(
        "L'utilisateur choisit précisément les champs à inclure dans l'export parmi : nom, "
        "secteur, ville, commune, adresse, téléphone, email, site web, horaires, GPS "
        "(latitude, longitude), note, nombre d'avis, score, catégorie, sources, date de "
        "dernière mise à jour, description, mots-clés. Des modèles d'export réutilisables "
        "peuvent être sauvegardés par l'utilisateur."
    )
    h3("Génération asynchrone et notifications")
    P(
        "Les exports volumineux sont générés en arrière-plan par un worker dédié afin de ne "
        "pas bloquer l'interface. La progression est visible en temps réel, et une "
        "notification (in-app + email) est émise à l'achèvement. Les fichiers générés sont "
        "stockés temporairement (30 jours par défaut, configurable par plan) et "
        "téléchargeables depuis l'onglet Exports."
    )

    # ================================================================ 3.6
    h2("Notifications multi-canal")
    P(
        "Le module de notifications informe les utilisateurs des événements clés de la "
        "plateforme via plusieurs canaux : in-app (cloche de notifications temps réel via "
        "WebSocket), email, push navigateur (PWA) et webhooks (pour intégration "
        "machine-to-machine). Chaque utilisateur configure ses préférences par type "
        "d'événement et par canal."
    )
    h3("Types d'événements notifiables")
    table(
        ["Événement", "Description", "Canaux par défaut"],
        [
            ["job.completed", "Un job de scraping s'est terminé avec succès", "in-app, email"],
            ["job.failed", "Un job a échoué", "in-app, email"],
            ["export.ready", "Un export est prêt au téléchargement", "in-app, email"],
            ["alert.triggered", "Une règle d'alerte a détecté un changement", "in-app, email, push"],
            ["report.scheduled", "Un rapport planifié a été généré", "in-app, email"],
            ["quota.threshold", "Approche de la limite de quota (80 %, 95 %)", "in-app, email"],
            ["security.login", "Connexion depuis un nouvel appareil / IP", "in-app, email"],
            ["security.2fa", "Activation/désactivation de la 2FA", "in-app, email"],
            ["billing.invoice", "Nouvelle facture émise", "in-app, email"],
            ["agent.completed", "Le pipeline d'agents IA est terminé", "in-app"],
        ],
        col_widths=[3.4 * cm, 7.0 * cm, CONTENT_W - 10.4 * cm],
    )
    h3("Règles d'alerte personnalisées")
    P(
        "Au-delà des notifications système, l'utilisateur peut définir des règles d'alerte "
        "personnalisées : surveillance d'un secteur ou d'une zone géographique, détection de "
        "nouveaux concurrents, fermeture d'un établissement, franchissement d'un seuil de "
        "densité. Chaque règle est évaluée périodiquement et déclenche une notification "
        "lorsque la condition est remplie."
    )
    h3("Webhooks")
    P(
        "Les webhooks permettent d'automatiser des actions externes (ajout dans un CRM, "
        "déclenchement d'une campagne, mise à jour d'un tableur) en temps réel. Chaque "
        "webhook possède une URL, un secret partagé (signature HMAC), une liste "
        "d'événements écoutés, et un statut actif/inactif. Les livraisons sont journalisées "
        "avec tentative de retry (5 essais avec backoff exponentiel)."
    )

    # ================================================================ 3.7
    h2("API REST publique")
    P(
        "L'API REST publique expose l'ensemble des capacités de la plateforme à des "
        "intégrations tierces (CRM, ERP, outils marketing, data warehouses). Elle est "
        "versionnée (/api/v1/), documentée via Swagger/OpenAPI 3.0, authentifiée par clé "
        "API ou JWT, et soumise à un rate limiting par plan. Le détail exhaustif des "
        "endpoints fait l'objet du chapitre 9."
    )
    h3("Caractéristiques de l'API")
    bullets([
        "Versionnage explicite via préfixe /api/v1/",
        "Authentification : Bearer JWT (utilisateur) ou X-API-Key (application)",
        "Pagination cursor-based pour les grandes collections",
        "Filtrage, tri et sélection de champs via paramètres de requête",
        "Réponses JSON standardisées avec enveloppe { data, meta, error }",
        "Codes de statut HTTP conformes aux conventions REST",
        "Rate limiting par clé / par IP avec en-têtes X-RateLimit-*",
        "Idempotence via en-tête Idempotency-Key pour les POST/PUT",
        "Webhooks sortants pour les événements asynchrones",
        "Documentation Swagger interactive (try-it) intégrée à l'UI",
    ])
    h3("Exemple de réponse standardisée")
    code_block(
        "// GET /api/v1/companies/cix123\n"
        "{\n"
        '  "data": {\n'
        '    "id": "cix123",\n'
        '    "name": "Boutique du Centre",\n'
        '    "sector": "Commerce de détail",\n'
        '    "sectorCode": "RETAIL",\n'
        '    "city": "Abidjan",\n'
        '    "commune": "Cocody",\n'
        '    "phone": "+225 07 00 11 22 33",\n'
        '    "email": "contact@boutiqueducentre.ci",\n'
        '    "website": "https://boutiqueducentre.ci",\n'
        '    "location": { "lat": 5.3364, "lng": -4.0260 },\n'
        '    "score": 84,\n'
        '    "grade": "A",\n'
        '    "sources": ["google_maps", "facebook"],\n'
        '    "updatedAt": "2024-07-15T10:23:00Z"\n'
        "  },\n"
        '  "meta": { "requestId": "req_abc", "version": "v1" }\n'
        "}",
        caption_text="Figure 3.5 — Réponse API standardisée",
    )

    # ================================================================ 3.8
    h2("Authentification et sécurité")
    P(
        "L'authentification est un pilier de la plateforme. Elle combine plusieurs "
        "mécanismes pour assurer à la fois la sécurité et la flexibilité : mot de passe "
        "renforcé (bcrypt + politique de complexité), JWT pour les sessions stateless, "
        "OAuth 2.0 (Google, Microsoft) pour le SSO, 2FA TOTP pour la double "
        "authentification, gestion fine des sessions et révocation, et blacklist des "
        "tokens compromis. Le détail sécurité est traité au chapitre 11."
    )
    h3("Méthodes d'authentification")
    table(
        ["Méthode", "Usage", "Sécurité", "Notes"],
        [
            ["Email + mot de passe", "Comptes standards", "Moyenne", "bcrypt cost 12, politique forte"],
            ["OAuth Google", "SSO entreprise", "Élevée", "OAuth 2.0, scopes email/profile"],
            ["OAuth Microsoft", "SSO entreprise", "Élevée", "Azure AD / comptes perso"],
            ["2FA TOTP", "Renforcement comptes sensibles", "Très élevée", "App Authenticator, codes de secours"],
            ["Clé API", "Intégrations machine-to-machine", "Élevée", "Hashée, rotation, scopes par clé"],
        ],
        col_widths=[3.4 * cm, 4.5 * cm, 2.6 * cm, CONTENT_W - 10.5 * cm],
    )
    h3("Gestion des sessions")
    P(
        "Les sessions sont stateless côté serveur grâce aux JWT (access token courte durée "
        "15 min + refresh token longue durée 30 jours). Les refresh tokens sont stockés en "
        "base et révocables individuellement. La déconnexion invalide le refresh token et "
        "ajoute l'access token à une blacklist jusqu'à expiration. Les sessions actives "
        "sont visibles dans le profil utilisateur et révocables à distance."
    )

    # ================================================================ 3.9
    h2("RBAC et gestion des rôles")
    P(
        "Le contrôle d'accès basé sur les rôles (RBAC) est multi-tenant : chaque "
        "utilisateur appartient à une organisation et, optionnellement, à un ou plusieurs "
        "workspaces au sein de cette organisation. Au sein de chaque workspace, l'utilisateur "
        "se voit attribuer un rôle qui détermine ses permissions. Cinq rôles sont définis : "
        "Owner, Admin, Manager, Agent et Viewer."
    )
    h3("Les cinq rôles")
    table(
        ["Rôle", "Périmètre", "Capacités principales"],
        [
            ["Owner", "Organisation", "Tout, y compris facturation, suppression org, transfert de propriété"],
            ["Admin", "Workspace", "Gestion membres, configuration, tous modules, sécurité (hors facturation)"],
            ["Manager", "Workspace", "Scraping, exports, agents IA, BI, rapports, équipe (lecture)"],
            ["Agent", "Workspace", "Scraping, exports, recherche (pas de gestion équipe ni sécurité)"],
            ["Viewer", "Workspace", "Lecture seule : recherche, carte, entreprises, exports limités"],
        ],
        col_widths=[2.2 * cm, 2.6 * cm, CONTENT_W - 4.8 * cm],
    )
    h3("Matrice de permissions (extrait)")
    table(
        ["Action", "Owner", "Admin", "Manager", "Agent", "Viewer"],
        [
            ["Lancer un job de scraping", "✓", "✓", "✓", "✓", "—"],
            ["Créer un export", "✓", "✓", "✓", "✓", "Limité"],
            ["Gérer les membres", "✓", "✓", "—", "—", "—"],
            ["Configurer la sécurité", "✓", "✓", "—", "—", "—"],
            ["Lancer le pipeline agents IA", "✓", "✓", "✓", "—", "—"],
            ["Consulter la BI", "✓", "✓", "✓", "—", "✓"],
            ["Gérer la facturation", "✓", "—", "—", "—", "—"],
            ["Consulter les audits", "✓", "✓", "—", "—", "—"],
        ],
        col_widths=[6.0 * cm, 1.8 * cm, 1.8 * cm, 2.0 * cm, 1.8 * cm, CONTENT_W - 15.4 * cm],
        align_center_cols=[1, 2, 3, 4, 5],
    )

    # ================================================================ 3.10
    h2("PWA et expérience mobile")
    P(
        "ScrapIQ CI est une Progressive Web App (PWA) installable sur mobile et desktop, "
        "offrant une expérience quasi-native avec support hors-ligne, notifications push et "
        "accès direct depuis l'écran d'accueil. La PWA est particulièrement adaptée au "
        "contexte ivoirien où le mobile est le principal point d'accès à Internet."
    )
    h3("Caractéristiques PWA")
    bullets([
        "Service Worker pour la mise en cache hors-ligne des assets et des données récentes",
        "Manifeste web pour l'installation (icône, couleur émeraude, nom court « ScrapIQ »)",
        "Notifications push web (même canal que les notifications in-app)",
        "Design responsive mobile-first (tailles tactiles ≥ 44px, navigation adaptée)",
        "Support des gestes tactiles (zoom carte, swipe de listes)",
        "Légèreté : bundle optimisé, lazy loading des modules",
        "Fonctionnement en connectivité dégradée (2G/3G) avec cache intelligent",
    ])
    h3("Objectifs de qualité PWA")
    table(
        ["Métrique Lighthouse", "Cible", "Méthode"],
        [
            ["Performance", "≥ 85", "Optimisation bundle, cache, lazy load"],
            ["Accessibilité", "≥ 90", "Composants ARIA, contrastes, navigation clavier"],
            ["Best Practices", "≥ 90", "HTTPS, en-têtes de sécurité, no console errors"],
            ["SEO", "≥ 90", "Meta tags, sitemap, données structurées"],
            ["PWA", "≥ 90", "Manifest, service worker, installable"],
        ],
        col_widths=[5.0 * cm, 2.5 * cm, CONTENT_W - 7.5 * cm],
        align_center_cols=[1],
    )

    # ================================================================ 3.11
    h2("Business Intelligence (BI)")
    P(
        "Le module de Business Intelligence transforme les données collectées en insights "
        "actionnables via des tableaux de bord, des graphiques, des heatmaps et des "
        "rapports planifiés. Il s'adresse principalement aux Managers et Owners qui pilotent "
        "l'activité de prospection et l'analyse de marché."
    )
    h3("Tableaux de bord")
    table(
        ["Tableau de bord", "Indicateurs", "Audience"],
        [
            ["Vue d'ensemble", "Total entreprises, jobs, exports, score moyen", "Tous"],
            ["Activité de scraping", "Jobs/jour, taux de succès, latence, sources", "Manager+"],
            ["Heatmap de densité", "Concentration sectorielle par commune", "Manager+"],
            ["Qualité des données", "Score moyen, taux de remplissage, fraîcheur", "Manager+"],
            ["Exports & consommation", "Exports générés, consommation API, quotas", "Manager+"],
            ["Performance commerciale", "Prospects, conversion, par agent/commercial", "Owner/Admin"],
        ],
        col_widths=[4.2 * cm, 7.0 * cm, CONTENT_W - 11.2 * cm],
    )
    h3("Rapports planifiés")
    P(
        "Les rapports peuvent être planifiés (quotidien, hebdomadaire, mensuel) et envoyés "
        "automatiquement par email à une liste de destinataires. Chaque rapport combine "
        "graphiques, tableaux et commentaires automatiques générés par IA. Les formats "
        "PDF et Excel sont supportés. L'historique des exécutions est conservé pour audit."
    )

    # ================================================================ 3.12
    h2("Plateforme SaaS Enterprise")
    P(
        "Le module SaaS gère l'ensemble du modèle d'abonnement, de facturation et de "
        "monétisation de la plateforme. Il supporte plusieurs plans (Starter, Pro, "
        "Enterprise, Custom), des quotas par fonctionnalité, une facturation récurrente "
        "avec moyens de paiement locaux (Mobile Money) et internationaux (carte), la gestion "
        "des licences, et une marketplace d'intégrations à venir."
    )
    h3("Plans tarifaires")
    table(
        ["Plan", "Prix mensuel (FCFA)", "Quotas clés", "Cible"],
        [
            ["Starter", "15 000", "5 jobs/mois, 2 000 entreprises, 10 exports", "TPE / indépendants"],
            ["Pro", "49 000", "50 jobs/mois, 20 000 entreprises, exports illimités", "PME / agences"],
            ["Enterprise", "149 000", "Jobs illimités, 500 000 entreprises, API élevée", "ETI / grands comptes"],
            ["Custom", "Sur devis", "Quotas et SLA sur mesure", "Institutions / usage massif"],
        ],
        col_widths=[2.4 * cm, 3.2 * cm, 6.4 * cm, CONTENT_W - 12.0 * cm],
    )
    h3("Quotas et limites")
    P(
        "Chaque plan définit des quotas par fonctionnalité : nombre de jobs de scraping par "
        "mois, nombre d'entreprises accessibles, nombre d'exports, nombre de requêtes API, "
        "nombre de membres, nombre de webhooks, fréquence des rapports planifiés. La "
        "consommation est tracée en temps réel et des alertes émettent à 80 % et 95 % du "
        "quota. Le dépassement peut être bloquant (par défaut) ou facturé en option "
        "overage."
    )
    h3("Facturation et paiements")
    bullets([
        "Facturation mensuelle ou annuelle (2 mois offerts en annuel)",
        "Paiement Mobile Money : Orange Money, MTN MoMo, Moov Money, Wave",
        "Paiement carte : Visa, Mastercard (via passerelle)",
        "Génération automatique de factures PDF (numérotées, conformes)",
        "Historique factures téléchargeable",
        "Gestion des avoirs et remboursements",
        "Essai gratuit 14 jours sans carte (plan Pro)",
    ])

    # ================================================================ 3.13
    h2("Agents IA multi-agents")
    P(
        "Le module d'agents IA orchestre un pipeline de 10 agents spécialisés qui "
        "coopèrent pour transformer une requête utilisateur en jeu de données final, "
        "propre, enrichi et scoré. L'architecture s'inspire du pattern « blackboard » : "
        "chaque agent lit et écrit dans un état partagé, et l'orchestrateur coordonne "
        "l'enchaînement séquentiel et parallèle."
    )
    h3("Les 10 agents")
    table(
        ["#", "Agent", "Rôle", "Entrées", "Sorties"],
        [
            ["1", "Sources", "Sélection des sources et construction des requêtes", "query, city, commune", "selectedSources, queries"],
            ["2", "Scraping", "Collecte multi-sources parallèle", "selectedSources, queries", "rawData"],
            ["3", "Nettoyage", "Normalisation tél/email/nom/adresse", "rawData", "cleanedData"],
            ["4", "Dédoublonnage", "Regroupement et fusion des doublons", "cleanedData", "uniqueEntities"],
            ["5", "Enrichissement", "Complétion via LLM + règles (parallèle)", "uniqueEntities", "enrichedEntities"],
            ["6", "Validation", "Validation technique des champs (parallèle)", "uniqueEntities", "validatedEntities"],
            ["7", "Géocodage", "Complétion GPS et liens Maps", "enriched + validated", "geocodedEntities"],
            ["8", "Classification", "Classification en 18 secteurs", "geocodedEntities", "classifiedEntities"],
            ["9", "Scoring", "Score 0–100 sur 7 dimensions", "classifiedEntities", "scoredEntities"],
            ["10", "Export", "Génération fichiers + notifications + audit", "scoredEntities", "finalExport"],
        ],
        col_widths=[0.7 * cm, 2.6 * cm, 4.8 * cm, 4.0 * cm, CONTENT_W - 12.1 * cm],
    )
    h3("Orchestration et résilience")
    P(
        "L'orchestrateur exécute les agents 1 à 4 séquentiellement (chacun dépend du "
        "précédent), puis lance les agents 5 et 6 en parallèle (ils consomment tous deux "
        "les données uniques et sont indépendants), puis enchaîne 7, 8, 9, 10 "
        "séquentiellement. Chaque agent dispose d'un timeout (30 s à 5 min), de retries "
        "(3 tentatives avec backoff exponentiel), d'un mécanisme de checkpoint (reprise "
        "depuis le dernier agent réussi), et d'un circuit breaker (agent marqué défaillant "
        "après 3 échecs consécutifs)."
    )
    code_block(
        "// Pipeline d'orchestration (simplifié)\n"
        "async function runPipeline(input) {\n"
        "  const shared = {};\n"
        "  // Phase 1 — séquentiel\n"
        "  await run(agent1_Sources,  input, shared, { timeout: 60_000 });\n"
        "  await run(agent2_Scraping, shared, { timeout: 300_000, parallel: true });\n"
        "  await run(agent3_Clean,    shared, { timeout: 120_000 });\n"
        "  await run(agent4_Dedupe,   shared, { timeout: 120_000 });\n"
        "  // Phase 2 — parallèle (blackboard)\n"
        "  await Promise.all([\n"
        "    run(agent5_Enrich, shared, { timeout: 180_000 }),\n"
        "    run(agent6_Validate, shared, { timeout: 120_000 }),\n"
        "  ]);\n"
        "  // Phase 3 — séquentiel\n"
        "  await run(agent7_Geocode,  shared, { timeout: 180_000 });\n"
        "  await run(agent8_Classify, shared, { timeout: 90_000 });\n"
        "  await run(agent9_Score,    shared, { timeout: 60_000 });\n"
        "  await run(agent10_Export,  shared, { timeout: 120_000 });\n"
        "  return shared.finalExport;\n"
        "}",
        caption_text="Figure 3.6 — Orchestration des 10 agents IA",
    )
    h3("Monitoring temps réel")
    P(
        "L'UI des agents affiche en temps réel l'état de chaque agent (pending, running, "
        "completed, failed, skipped), sa durée d'exécution, le flux d'événements (start, "
        "progress, complete), et l'état partagé (blackboard) qui s'accumule au fil du "
        "pipeline. Cette transparence rassure l'utilisateur sur le bon déroulement et "
        "facilite le diagnostic en cas d'incident."
    )

    # ================================================================ 3.14
    h2("Sécurité globale")
    P(
        "La sécurité est transverse à toute la plateforme. Elle couvre l'authentification "
        "(traitée en 3.8), le contrôle d'accès (3.9), mais aussi la protection "
        "infrastructurelle (WAF, anti-DDoS), la détection anti-bot (captcha), le "
        "chiffrement des données, la conformité réglementaire (RGPD/APIPD), l'audit et le "
        "rate limiting. Le détail exhaustif est au chapitre 11 ; cette section en présente "
        "la cartographie fonctionnelle."
    )
    h3("Composants de sécurité")
    table(
        ["Composant", "Rôle", "Niveau"],
        [
            ["WAF (Web Application Firewall)", "Filtrage des requêtes malveillantes (SQLi, XSS, LFI)", "Edge"],
            ["Anti-DDoS", "Atténuation des attaques par déni de service", "Edge / réseau"],
            ["Captcha", "Détection anti-bot sur formulaires sensibles", "Application"],
            ["Rate limiting", "Limitation du nombre de requêtes par IP / par clé", "Application"],
            ["Chiffrement au repos", "AES-256 pour données sensibles en base", "Données"],
            ["Chiffrement en transit", "TLS 1.3 pour toutes communications", "Réseau"],
            ["Audit log", "Journalisation des actions sensibles", "Application"],
            ["RBAC + 2FA", "Contrôle d'accès et double authentification", "Application"],
            ["Secrets management", "Gestion sécurisée des secrets (env / vault)", "Infrastructure"],
        ],
        col_widths=[4.6 * cm, 7.0 * cm, CONTENT_W - 11.6 * cm],
    )
    h3("Conformité RGPD / APIPD")
    P(
        "ScrapIQ CI intègre dès sa conception les principes de la loi ivoirienne n° 2013-450 "
        "et du RGPD européen (pour les clients internationaux) : licéité et loyauté de la "
        "collecte, finalité déterminée, minimisation des données, exactitude, limitation de "
        "conservation, sécurité, et accountability. Des fonctionnalités dédiées sont "
        "implémentées : consentement, droit d'accès, droit à l'effacement, portabilité, "
        "journal d'audit, et procédure de notification de violation sous 72 h."
    )
    info_box(
        "Synthèse du chapitre",
        "Le périmètre fonctionnel de ScrapIQ CI couvre l'intégralité de la chaîne de valeur, "
        "de la collecte multi-sources à l'exploitation decisionnelle, en passant par le "
        "traitement IA, la recherche, la cartographie, les exports, l'API, la sécurité et "
        "le modèle SaaS. Les chapitres suivants détaillent l'architecture, les cas "
        "d'utilisation, les wireframes, les diagrammes et les spécifications techniques qui "
        "opérationnalisent ces fonctionnalités.",
    )
