# -*- coding: utf-8 -*-
"""Chapitre 9 — API REST."""
from cdc_common import *  # noqa: F401,F403


def chapter9():
    chapter_title(9, "API REST")
    intro(
        "Ce chapitre spécifie l'API REST publique de ScrapIQ CI. Elle expose l'ensemble des "
        "capacités de la plateforme à des intégrations tierces (CRM, ERP, outils marketing, "
        "data warehouses). L'API est versionnée, documentée via OpenAPI 3.0, authentifiée "
        "par clé API ou JWT, et soumise à un rate limiting. Sont décrites : les conventions, "
        "l'authentification, et l'ensemble des endpoints par ressource (entreprises, "
        "scraping, exports, agents IA, notifications, SaaS, sécurité), ainsi que les "
        "webhooks et la documentation Swagger."
    )

    # ---------------------------------------------------------------- 9.1
    h2("Conventions et versioning")
    h3("URL de base et versionning")
    code_block(
        "Base URL : https://api.scraapiq.ci/api/v1\n"
        "\n"
        "Le versioning est explicite via le préfixe /api/v1/.\n"
        "Les changements cassants (breaking changes) impliquent /api/v2/.\n"
        "Les ajouts non cassants (champs, endpoints) sont rétro-compatibles.",
    )
    h3("Conventions de réponse")
    bullets([
        "Enveloppe standard : { data, meta, error }",
        "data : objet ou tableau selon l'endpoint",
        "meta : pagination, requêteId, version",
        "error : { code, message, details } en cas d'erreur",
        "Codes HTTP : 200 OK, 201 Created, 202 Accepted, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many, 500 Internal",
    ])
    h3("Pagination")
    P(
        "La pagination est cursor-based pour les grandes collections. Les paramètres "
        "limit (défaut 20, max 100) et cursor (opaque) sont utilisés. La réponse inclut "
        "meta.nextCursor (null si dernière page). Pour les petites collections, une "
        "pagination offset (page/size) est également supportée."
    )
    code_block(
        "// Exemple de pagination cursor\n"
        "GET /api/v1/companies?limit=50&cursor=eyJpZCI6ImNpeDEyMyJ9\n"
        "\n"
        "{\n"
        '  "data": [ { "id": "cix124", ... }, ... ],\n'
        '  "meta": {\n'
        '    "limit": 50,\n'
        '    "nextCursor": "eyJpZCI6ImNpeDE3NCJ9",\n'
        '    "hasMore": true,\n'
        '    "requestId": "req_abc"\n'
        "  }\n"
        "}",
    )
    h3("Filtrage, tri, sélection de champs")
    table(
        ["Paramètre", "Usage", "Exemple"],
        [
            ["q", "Recherche full-text", "?q=pharmacie"],
            ["{field}", "Filtre exact", "?city=Abidjan"],
            ["minScore / maxScore", "Filtre de plage", "?minScore=65"],
            ["sort", "Tri (champ:ordre)", "?sort=score:desc"],
            ["fields", "Sélection de champs", "?fields=id,name,phone"],
            ["sources", "Filtre multi-valeurs", "?sources=google_maps,facebook"],
        ],
        col_widths=[3.4 * cm, 4.4 * cm, CONTENT_W - 7.8 * cm],
    )

    # ---------------------------------------------------------------- 9.2
    h2("Authentification")
    h3("Méthodes d'authentification")
    table(
        ["Méthode", "Header", "Usage"],
        [
            ["JWT (Bearer)", "Authorization: Bearer <jwt>", "Sessions utilisateur (UI, integrations user)"],
            ["Clé API", "X-API-Key: <key>", "Intégrations machine-to-machine"],
            ["OAuth 2.0", "Authorization: Bearer <oauth_token>", "SSO Google/Microsoft"],
        ],
        col_widths=[3.0 * cm, 5.6 * cm, CONTENT_W - 8.6 * cm],
    )
    h3("Endpoints d'authentification")
    table(
        ["Méthode", "Endpoint", "Description", "Auth"],
        [
            ["POST", "/auth/register", "Création de compte", "Aucune"],
            ["POST", "/auth/login", "Connexion (email + password)", "Aucune"],
            ["POST", "/auth/2fa/verify", "Vérification code TOTP", "Jeton temporaire 2FA"],
            ["POST", "/auth/2fa/setup", "Activation 2FA (génère secret)", "JWT"],
            ["POST", "/auth/2fa/disable", "Désactivation 2FA", "JWT + code"],
            ["POST", "/auth/refresh", "Rafraîchit l'access token", "Refresh token"],
            ["POST", "/auth/logout", "Déconnexion (révocation)", "JWT"],
            ["GET", "/auth/oauth/google", "Initie OAuth Google", "Aucune"],
            ["GET", "/auth/oauth/microsoft", "Initie OAuth Microsoft", "Aucune"],
            ["GET", "/auth/sessions", "Liste sessions actives", "JWT"],
            ["DELETE", "/auth/sessions/:id", "Révoque une session", "JWT"],
        ],
        col_widths=[1.6 * cm, 4.6 * cm, 6.0 * cm, CONTENT_W - 12.2 * cm],
        align_center_cols=[0],
    )
    code_block(
        "// POST /api/v1/auth/login\n"
        "// Requête\n"
        "{\n"
        '  "email": "user@example.ci",\n'
        '  "password": "********"\n'
        "}\n"
        "\n"
        "// Réponse 200 (2FA désactivée)\n"
        "{\n"
        '  "data": {\n'
        '    "accessToken": "eyJhbGci...",\n'
        '    "refreshToken": "rty...",\n'
        '    "expiresIn": 900,\n'
        '    "user": { "id": "u1", "email": "..." }\n'
        "  }\n"
        "}\n"
        "\n"
        "// Réponse 200 (2FA activée — étape 2 requise)\n"
        "{\n"
        '  "data": {\n'
        '    "twoFactorRequired": true,\n'
        '    "twoFactorToken": "tmp_2fa_abc",\n'
        '    "expiresIn": 300\n'
        "  }\n"
        "}",
        caption_text="Figure 9.1 — Authentification login",
    )

    # ---------------------------------------------------------------- 9.3
    h2("Endpoints Entreprises")
    h3("CRUD et recherche d'entreprises")
    table(
        ["Méthode", "Endpoint", "Description", "Rôle min."],
        [
            ["GET", "/companies", "Liste paginée (filtres)", "Viewer"],
            ["GET", "/companies/search", "Recherche full-text + facets", "Viewer"],
            ["GET", "/companies/:id", "Détail d'une entreprise", "Viewer"],
            ["POST", "/companies", "Création manuelle", "Manager"],
            ["PATCH", "/companies/:id", "Mise à jour partielle", "Manager"],
            ["DELETE", "/companies/:id", "Suppression", "Admin"],
            ["GET", "/companies/:id/geo", "Coordonnées + carte", "Viewer"],
            ["GET", "/companies/stats", "Statistiques agrégées", "Viewer"],
        ],
        col_widths=[1.6 * cm, 4.4 * cm, 6.4 * cm, CONTENT_W - 12.4 * cm],
        align_center_cols=[0, 3],
    )
    h3("Exemple — Recherche avec facets")
    code_block(
        "GET /api/v1/companies/search?q=pharmacie&city=Abidjan&minScore=65&size=20\n"
        "Authorization: Bearer <jwt>\n"
        "\n"
        "200 OK\n"
        "{\n"
        '  "data": [\n'
        '    {\n'
        '      "id": "cix1",\n'
        '      "name": "Pharmacie du Plateau",\n'
        '      "sector": "Santé",\n'
        '      "sectorCode": "HEALTH",\n'
        '      "city": "Abidjan",\n'
        '      "commune": "Cocody",\n'
        '      "phone": "+225 07 00 11 22 33",\n'
        '      "location": { "lat": 5.34, "lng": -4.02 },\n'
        '      "score": 88,\n'
        '      "grade": "A",\n'
        '      "sources": ["google_maps","facebook"]\n'
        "    }\n"
        "  ],\n"
        '  "meta": {\n'
        '    "total": 142,\n'
        '    "facets": {\n'
        '      "by_sector":  [ { "key": "Santé", "count": 142 } ],\n'
        '      "by_commune": [ { "key": "Cocody", "count": 58 }, ... ],\n'
        '      "by_grade":   [ { "key": "A", "count": 41 }, ... ]\n'
        "    }\n"
        "  }\n"
        "}",
        caption_text="Figure 9.2 — Recherche d'entreprises avec facets",
    )

    # ---------------------------------------------------------------- 9.4
    h2("Endpoints Scraping")
    table(
        ["Méthode", "Endpoint", "Description", "Rôle min."],
        [
            ["GET", "/scraping/sources", "Liste sources disponibles", "Viewer"],
            ["POST", "/scraping/jobs", "Lance un job de scraping", "Agent"],
            ["GET", "/scraping/jobs", "Liste des jobs", "Viewer"],
            ["GET", "/scraping/jobs/:id", "Détail + statut d'un job", "Viewer"],
            ["GET", "/scraping/jobs/:id/results", "Résultats d'un job", "Viewer"],
            ["POST", "/scraping/jobs/:id/retry", "Relance un job échoué", "Manager"],
            ["DELETE", "/scraping/jobs/:id", "Annule un job", "Manager"],
            ["POST", "/scraping/schedule", "Planifie un job récurrent", "Manager"],
            ["GET", "/scraping/schedule", "Liste des planifications", "Manager"],
            ["DELETE", "/scraping/schedule/:id", "Supprime une planification", "Manager"],
        ],
        col_widths=[1.6 * cm, 4.8 * cm, 6.0 * cm, CONTENT_W - 12.4 * cm],
        align_center_cols=[0, 3],
    )
    h3("Schéma de requête de création de job")
    code_block(
        "// POST /api/v1/scraping/jobs\n"
        "{\n"
        '  "query": "quincaillerie",        // requis\n'
        '  "city": "Abidjan",               // requis\n'
        '  "commune": "Yopougon",           // optionnel\n'
        '  "sources": ["google_maps","facebook","website"],  // défaut: toutes\n'
        '  "maxResults": 200,               // défaut 200, max 1000\n'
        '  "enrich": true,                  // défaut true\n'
        '  "dedupe": true,                  // défaut true\n'
        '  "geocode": true,                 // défaut true\n'
        '  "webhookUrl": "https://..."     // optionnel\n'
        "}\n"
        "\n"
        "// 201 Created\n"
        "{\n"
        '  "data": {\n'
        '    "jobId": "job_a1b2",\n'
        '    "status": "queued",\n'
        '    "estimatedDuration": 75,\n'
        '    "createdAt": "2024-07-15T10:00:00Z"\n'
        "  }\n"
        "}",
        caption_text="Figure 9.3 — Création d'un job de scraping",
    )

    # ---------------------------------------------------------------- 9.5
    h2("Endpoints Exports")
    table(
        ["Méthode", "Endpoint", "Description", "Rôle min."],
        [
            ["GET", "/exports", "Liste des exports", "Viewer"],
            ["POST", "/exports", "Crée un export", "Agent"],
            ["GET", "/exports/:id", "Statut + métadonnées", "Viewer"],
            ["GET", "/exports/:id/download", "Télécharge le fichier", "Viewer"],
            ["DELETE", "/exports/:id", "Supprime un export", "Manager"],
            ["GET", "/exports/templates", "Modèles sauvegardés", "Viewer"],
            ["POST", "/exports/templates", "Crée un modèle", "Manager"],
        ],
        col_widths=[1.6 * cm, 4.6 * cm, 6.2 * cm, CONTENT_W - 12.4 * cm],
        align_center_cols=[0, 3],
    )
    code_block(
        "// POST /api/v1/exports\n"
        "{\n"
        '  "source": { "type": "search", "query": "pharmacie", "city": "Abidjan" },\n'
        '  "format": "xlsx",          // xlsx | csv | pdf | json\n'
        '  "fields": ["id","name","sector","phone","email","score","grade"],\n'
        '  "options": { "includeMap": false, "locale": "fr" }\n'
        "}\n"
        "\n"
        "// 202 Accepted\n"
        '{ "data": { "exportId": "exp_x1", "status": "queued" } }\n'
        "\n"
        "// Suivi puis téléchargement\n"
        "GET /api/v1/exports/exp_x1/download  →  fichier binaire",
    )

    # ---------------------------------------------------------------- 9.6
    h2("Endpoints Agents IA")
    table(
        ["Méthode", "Endpoint", "Description", "Rôle min."],
        [
            ["GET", "/agents", "Liste des 10 agents (définitions)", "Manager"],
            ["POST", "/agents", "Lance le pipeline complet", "Manager"],
            ["GET", "/agents/:pipelineId", "État du pipeline (temps réel)", "Manager"],
            ["GET", "/agents/:pipelineId/events", "Flux d'événements (SSE)", "Manager"],
            ["POST", "/agents/:pipelineId/abort", "Annule le pipeline", "Manager"],
            ["GET", "/agents/:pipelineId/result", "Résultat final", "Manager"],
        ],
        col_widths=[1.6 * cm, 5.2 * cm, 5.6 * cm, CONTENT_W - 12.4 * cm],
        align_center_cols=[0, 3],
    )
    code_block(
        "// POST /api/v1/agents\n"
        '{ "query": "restaurant", "city": "Bouaké", "commune": null }\n'
        "\n"
        "// 201 Created\n"
        '{ "data": { "pipelineId": "agents-dbcb18d7", "status": "running" } }\n'
        "\n"
        "// GET /api/v1/agents/agents-dbcb18d7\n"
        "{\n"
        '  "data": {\n'
        '    "pipelineId": "agents-dbcb18d7",\n'
        '    "status": "completed",\n'
        '    "progress": 10,\n'
        '    "total": 10,\n'
        '    "duration": 5433,\n'
        '    "agents": [\n'
        '      { "n": 1, "name": "Sources", "status": "completed", "duration": 1200 },\n'
        '      ...\n'
        "    ]\n"
        "  }\n"
        "}",
        caption_text="Figure 9.4 — Pipeline d'agents IA",
    )

    # ---------------------------------------------------------------- 9.7
    h2("Endpoints Notifications")
    table(
        ["Méthode", "Endpoint", "Description", "Rôle min."],
        [
            ["GET", "/notifications", "Liste des notifications", "Viewer"],
            ["PATCH", "/notifications/:id/read", "Marquer comme lue", "Viewer"],
            ["POST", "/notifications/read-all", "Tout marquer lu", "Viewer"],
            ["GET", "/notifications/preferences", "Préférences par canal", "Viewer"],
            ["PUT", "/notifications/preferences", "Mettre à jour préférences", "Viewer"],
            ["GET", "/notifications/stream", "Flux temps réel (WebSocket)", "Viewer"],
            ["GET", "/alerts", "Liste des règles d'alerte", "Manager"],
            ["POST", "/alerts", "Crée une règle d'alerte", "Manager"],
            ["PATCH", "/alerts/:id", "Modifie une règle", "Manager"],
            ["DELETE", "/alerts/:id", "Supprime une règle", "Manager"],
        ],
        col_widths=[1.6 * cm, 5.2 * cm, 5.6 * cm, CONTENT_W - 12.4 * cm],
        align_center_cols=[0, 3],
    )

    # ---------------------------------------------------------------- 9.8
    h2("Endpoints SaaS & facturation")
    table(
        ["Méthode", "Endpoint", "Description", "Rôle min."],
        [
            ["GET", "/saas/plans", "Liste des plans tarifaires", "Viewer"],
            ["GET", "/saas/subscription", "Abonnement courant", "Owner"],
            ["POST", "/saas/subscription", "Souscrit / change de plan", "Owner"],
            ["DELETE", "/saas/subscription", "Résilie l'abonnement", "Owner"],
            ["GET", "/saas/invoices", "Liste des factures", "Owner"],
            ["GET", "/saas/invoices/:id", "Détail + PDF", "Owner"],
            ["GET", "/saas/usage", "Consommation des quotas", "Manager"],
            ["GET", "/saas/licenses", "Liste des licences", "Owner"],
            ["POST", "/saas/licenses", "Active une licence", "Owner"],
            ["POST", "/saas/payment/method", "Ajoute un moyen de paiement", "Owner"],
        ],
        col_widths=[1.6 * cm, 4.8 * cm, 6.0 * cm, CONTENT_W - 12.4 * cm],
        align_center_cols=[0, 3],
    )
    code_block(
        "// GET /api/v1/saas/plans\n"
        "{\n"
        '  "data": [\n'
        '    { "code": "starter",    "price": 15000,  "currency": "XOF", "quotas": {...} },\n'
        '    { "code": "pro",        "price": 49000,  "currency": "XOF", "quotas": {...} },\n'
        '    { "code": "enterprise", "price": 149000, "currency": "XOF", "quotas": {...} }\n'
        "  ]\n"
        "}",
    )

    # ---------------------------------------------------------------- 9.9
    h2("Endpoints Sécurité")
    table(
        ["Méthode", "Endpoint", "Description", "Rôle min."],
        [
            ["GET", "/security/audit", "Journal d'audit (filtrable)", "Admin"],
            ["GET", "/security/sessions", "Sessions actives", "Admin"],
            ["DELETE", "/security/sessions/:id", "Révoque une session", "Admin"],
            ["GET", "/security/api-keys", "Liste des clés API", "Admin"],
            ["POST", "/security/api-keys", "Crée une clé API", "Admin"],
            ["DELETE", "/security/api-keys/:id", "Révoque une clé", "Admin"],
            ["GET", "/security/webhooks", "Liste des webhooks", "Admin"],
            ["POST", "/security/webhooks", "Crée un webhook", "Admin"],
            ["GET", "/security/webhooks/:id/deliveries", "Historique des livraisons", "Admin"],
            ["POST", "/security/webhooks/:id/test", "Teste un webhook", "Admin"],
            ["GET", "/security/ip-rules", "Règles IP allow/block", "Admin"],
            ["PUT", "/security/ip-rules", "Met à jour les règles", "Admin"],
        ],
        col_widths=[1.6 * cm, 5.2 * cm, 5.6 * cm, CONTENT_W - 12.4 * cm],
        align_center_cols=[0, 3],
    )
    h3("Rate limiting")
    P(
        "Chaque clé API et chaque IP sont soumises à un rate limiting. Les limites varient "
        "par plan (ex. Starter : 100 req/min, Pro : 600 req/min, Enterprise : 3 000 req/min). "
        "Les en-têtes de réponse informent en temps réel de la consommation."
    )
    code_block(
        "X-RateLimit-Limit: 600\n"
        "X-RateLimit-Remaining: 412\n"
        "X-RateLimit-Reset: 1721041200\n"
        "\n"
        "// En cas de dépassement : 429 Too Many Requests\n"
        "Retry-After: 12",
    )

    # ---------------------------------------------------------------- 9.10
    h2("Webhooks & Swagger")
    h3("Événements webhook")
    table(
        ["Événement", "Description", "Payload"],
        [
            ["job.completed", "Job de scraping terminé", "jobId, results, duration"],
            ["job.failed", "Job échoué", "jobId, error"],
            ["export.ready", "Export prêt", "exportId, format, downloadUrl"],
            ["agent.completed", "Pipeline agents terminé", "pipelineId, results"],
            ["alert.triggered", "Règle d'alerte déclenchée", "alertId, condition, entities"],
            ["billing.invoice", "Facture émise", "invoiceId, amount, dueDate"],
        ],
        col_widths=[3.2 * cm, 5.4 * cm, CONTENT_W - 8.6 * cm],
    )
    h3("Sécurité des webhooks")
    code_block(
        "// Signature HMAC SHA-256 de chaque payload\n"
        "X-Webhook-Event: job.completed\n"
        "X-Webhook-Signature: sha256=<hex_hmac>\n"
        "X-Webhook-Timestamp: 1721041200\n"
        "\n"
        "// Vérification côté client\n"
        "expected = hmac_sha256(secret, timestamp + '.' + raw_body)\n"
        "if not constant_time_eq(expected, received_signature):\n"
        "    reject()",
    )
    h3("Documentation Swagger")
    P(
        "L'API est entièrement documentée au format OpenAPI 3.0. La spécification est "
        "générée automatiquement à partir des handlers et des schémas Zod, puis servie sur "
        "/api/v1/docs (Swagger UI interactif) et /api/v1/openapi.json (spécification brute). "
        "Le Swagger UI intègre un « Try it » permettant d'exécuter des requêtes directement "
        "depuis le navigateur, avec gestion du token JWT."
    )
    h3("Exemple de définition OpenAPI (extrait)")
    code_block(
        "openapi: 3.0.3\n"
        "info:\n"
        '  title: ScrapIQ CI API\n'
        "  version: 1.0.0\n"
        "paths:\n"
        "  /companies/search:\n"
        "    get:\n"
        "      summary: Recherche d'entreprises\n"
        "      security:\n"
        "        - bearerAuth: []\n"
        "      parameters:\n"
        "        - name: q\n"
        "          in: query\n"
        "          schema: { type: string }\n"
        "        - name: city\n"
        "          in: query\n"
        "          schema: { type: string }\n"
        "      responses:\n"
        "        '200':\n"
        "          description: Résultats de recherche\n"
        "          content:\n"
        "            application/json:\n"
        "              schema: { $ref: '#/components/schemas/SearchResponse' }\n"
        "        '401': { description: Non authentifié }\n"
        "        '429': { description: Quota dépassé }",
        caption_text="Figure 9.5 — Extrait OpenAPI 3.0",
    )
    info_box(
        "Synthèse du chapitre",
        "L'API REST de ScrapIQ CI couvre l'ensemble des ressources de la plateforme avec "
        "une centaine d'endpoints, une authentification flexible (JWT, clé API, OAuth), un "
        "rate limiting par plan, des webhooks sécurisés par signature HMAC et une "
        "documentation Swagger interactive. Elle constitue le vecteur d'intégration "
        "principal de la plateforme avec l'écosystème d'outils tiers.",
    )
