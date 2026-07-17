# -*- coding: utf-8 -*-
"""Chapitre 13 — Tests."""
from cdc_common import *  # noqa: F401,F403


def chapter13():
    chapter_title(13, "Tests")
    intro(
        "Ce chapitre décrit la stratégie de test de ScrapIQ CI, couvrant les tests "
        "unitaires, d'intégration, end-to-end (E2E), de performance, de sécurité et de "
        "charge. L'objectif est de garantir la qualité, la fiabilité et la sécurité du "
        "produit tout au long de son cycle de vie, avec une automatisation maximale "
        "intégrée au pipeline CI/CD. La couverture cible est de 75 % sur la logique métier "
        "critique."
    )

    # ---------------------------------------------------------------- 13.1
    h2("Tests unitaires")
    P(
        "Les tests unitaires vérifient le comportement isolé des fonctions et modules "
        "métier (normalisation, dédoublonnage, scoring, classification, RBAC, validation). "
        "Ils s'exécutent en millisecondes et doivent être déterministes. La bibliothèque "
        "Vitest (compatible Jest) est utilisée côté frontend et backend TypeScript."
    )
    h3("Périmètre des tests unitaires")
    table(
        ["Module", "Fonctions testées", "Couverture cible"],
        [
            ["Normalisation", "formatPhone, normalizeEmail, cleanName, normalizeAddress", "≥ 90 %"],
            ["Dédoublonnage", "similarity, shouldMerge, merge, fusionScore", "≥ 90 %"],
            ["Scoring", "computeScore, weightedDimensions, gradeFromScore", "≥ 90 %"],
            ["Classification", "classifyByRules, classifyByLLM, mapSector", "≥ 85 %"],
            ["RBAC", "can(user, action, resource), rolePermissions", "≥ 95 %"],
            ["Validation", "schemas Zod, validators", "≥ 85 %"],
            ["Géocodage", "normalizeForGeocode, parseResult", "≥ 80 %"],
        ],
        col_widths=[3.2 * cm, 7.0 * cm, CONTENT_W - 10.2 * cm],
    )
    h3("Exemple de test unitaire")
    code_block(
        "// src/lib/ai/normalize.test.ts\n"
        "import { describe, it, expect } from 'vitest';\n"
        "import { formatPhone } from './normalize';\n"
        "\n"
        "describe('formatPhone', () => {\n"
        "  it('formate un numéro ivoirien à 10 chiffres', () => {\n"
        "    expect(formatPhone('0700112233')).toBe('+225 07 00 11 22 33');\n"
        "  });\n"
        "  it('ajoute le préfixe +225 si absent', () => {\n"
        "    expect(formatPhone('07 00 11 22 33')).toBe('+225 07 00 11 22 33');\n"
        "  });\n"
        "  it('retourne null pour un numéro invalide', () => {\n"
        "    expect(formatPhone('123')).toBeNull();\n"
        "  });\n"
        "});",
        caption_text="Figure 13.1 — Test unitaire de normalisation",
    )
    h3("Bonnes pratiques")
    bullets([
        "Arrange / Act / Assert (AAA) pour la lisibilité",
        "Un test = un cas (atomique)",
        "Mock des dépendances externes (DB, LLM, sources)",
        "Snapshots pour les sorties stables (exports)",
        "Tests paramétrés pour couvrir les cas limites",
        "Couverture mesurée et seuil en CI (échec si < 75 %)",
    ])

    # ---------------------------------------------------------------- 13.2
    h2("Tests d'intégration")
    P(
        "Les tests d'intégration vérifient l'interaction entre plusieurs modules ou avec "
        "des dépendances réelles (base de test, Redis, Elasticsearch, mocks de sources). "
        "Ils s'assurent que les composants fonctionnent correctement ensemble (ex. : un job "
        "de scraping complet, de la création à l'indexation)."
    )
    h3("Périmètre des tests d'intégration")
    table(
        ["Scénario", "Composants impliqués", "Vérifications"],
        [
            ["Création + exécution job", "API, BullMQ, worker, DB, ES", "Job créé, exécuté, résultats indexés"],
            ["Auth + RBAC", "API, Auth, DB, RBAC", "Token émis, permissions respectées"],
            ["Pipeline agents IA", "Orchestrateur, agents, LLM mock", "10 agents enchaînés, résultat final"],
            ["Export complet", "API, worker export, storage", "Fichier généré, téléchargeable"],
            ["Webhook delivery", "Worker, webhook, signature", "Payload signé, retry sur échec"],
            ["Recherche + facets", "API, ES", "Résultats corrects, facets cohérentes"],
        ],
        col_widths=[3.6 * cm, 5.4 * cm, CONTENT_W - 9 * cm],
    )
    h3("Environnement de test d'intégration")
    P(
        "Les tests d'intégration s'exécutent contre une base PostgreSQL, un Redis et un "
        "Elasticsearch dédiés (conteneurs Docker éphémères levés pour la suite puis "
        "détruits). Les sources externes (Google Maps, Facebook) sont mockées avec des "
        "fixtures réalistes. Le LLM est mocké pour la reproductibilité et la rapidité."
    )

    # ---------------------------------------------------------------- 13.3
    h2("Tests end-to-end")
    P(
        "Les tests E2E valident les parcours utilisateur complets à travers l'interface "
        "réelle, dans un navigateur headless. Ils utilisent Playwright pour simuler les "
        "interactions (clics, saisies, navigation) et vérifier le rendu et le comportement "
        "attendus. Ils s'exécutent sur l'environnement de staging après chaque déploiement."
    )
    h3("Parcours E2E critiques")
    table(
        ["Parcours", "Étapes", "Assertions"],
        [
            ["Inscription + connexion", "Signup → email verify → login → dashboard", "Session active, KPIs visibles"],
            ["Lancer un scraping", "Scraper → saisie → lancer → progression → résultats", "Résultats indexés, notification reçue"],
            ["Recherche + export", "Recherche → filtres → sélection → export CSV", "Fichier téléchargeable"],
            ["Pipeline agents IA", "Agents → lancer → suivre 10/10 → résultat", "Progression 10/10, données enrichies"],
            ["Gestion membre", "Équipe → inviter → accepter → rôle modifié", "Membre actif, rôle appliqué"],
            ["2FA", "Sécurité → activer 2FA → QR → code → confirmation", "2FA active, codes de secours affichés"],
        ],
        col_widths=[3.4 * cm, 6.6 * cm, CONTENT_W - 10 * cm],
    )
    h3("Stratégie E2E")
    bullets([
        "Playwright multi-browser (Chromium, Firefox, WebKit)",
        "Données de test seedées (fixtures déterministes)",
        "Screenshots et vidéo en cas d'échec",
        "Ré-exécution automatique des tests flaky (retry 2)",
        "Exécution parallèle pour réduire la durée",
    ])

    # ---------------------------------------------------------------- 13.4
    h2("Tests de performance")
    P(
        "Les tests de performance mesurent les temps de réponse, le débit et la consommation "
        "de ressources sous charge. Ils identifient les goulots d'étranglement et valident "
        "le respect des SLO (latence P95 < 300 ms, uptime ≥ 99,5 %). L'outil k6 est utilisé."
    )
    h3("Scénarios de performance")
    table(
        ["Scénario", "Charge", "Métrique", "Cible"],
        [
            ["Recherche API", "100 req/s pendant 5 min", "Latence P95", "< 300 ms"],
            ["Recherche API (pic)", "500 req/s pendant 1 min", "Taux d'erreur", "< 1 %"],
            ["Lancement jobs", "20 jobs/s", "Latence création", "< 200 ms"],
            ["Carte 10k marqueurs", "1 utilisateur", "FPS / render", "Fluide (≥ 30 FPS)"],
            ["Export 50k lignes", "1 utilisateur", "Durée génération", "< 60 s"],
            ["Pipeline agents", "10 concurrents", "Durée moyenne", "< 90 s"],
        ],
        col_widths=[3.8 * cm, 3.6 * cm, 3.2 * cm, CONTENT_W - 10.6 * cm],
    )
    h3("Extrait de scénario k6")
    code_block(
        "import http from 'k6/http';\n"
        "import { check, sleep } from 'k6';\n"
        "\n"
        "export const options = {\n"
        "  stages: [\n"
        "    { duration: '30s', target: 100 },\n"
        "    { duration: '5m',  target: 100 },\n"
        "    { duration: '30s', target: 0   },\n"
        "  ],\n"
        "  thresholds: {\n"
        "    http_req_duration: ['p(95)<300'],\n"
        "    http_req_failed:   ['rate<0.01'],\n"
        "  },\n"
        "};\n"
        "\n"
        "export default function () {\n"
        "  const res = http.get(`${__ENV.BASE}/api/v1/companies/search?q=pharmacie`, {\n"
        "    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },\n"
        "  });\n"
        "  check(res, { 'status 200': r => r.status === 200 });\n"
        "  sleep(0.1);\n"
        "}",
        caption_text="Figure 13.2 — Scénario de test de charge k6",
    )

    # ---------------------------------------------------------------- 13.5
    h2("Tests de sécurité")
    P(
        "Les tests de sécurité identifient les vulnérabilités avant la production. Ils "
        "combinent analyse statique (SAST), analyse des dépendances (SCA), analyse "
        "dynamique (DAST) et tests manuels ciblés (pen-testing). L'objectif est zéro "
        "vulnérabilité critique en production."
    )
    h3("Types de tests de sécurité")
    table(
        ["Type", "Outil", "Fréquence", "Cible"],
        [
            ["SAST", "SonarQube / Semgrep", "À chaque commit", "Code source"],
            ["SCA", "Dependabot / Snyk", "Quotidien + CI", "Dépendances"],
            ["DAST", "OWASP ZAP", "Sur staging (hebdo)", "Application en exécution"],
            ["Secrets scan", "GitLeaks / TruffleHog", "À chaque commit", "Secrets dans le code"],
            ["Container scan", "Trivy / Grype", "À chaque build image", "Images Docker"],
            ["Pen-test", "Prestataire externe", "Annuel + avant V2", "Application globale"],
        ],
        col_widths=[2.6 * cm, 3.8 * cm, 3.0 * cm, CONTENT_W - 9.4 * cm],
    )
    h3("Cas de test sécurité spécifiques")
    bullets([
        "Injection SQL / NoSQL via paramètres API",
        "XSS stocké et réfléchi (champs entreprise, descriptions)",
        "Broken access control (IDOR : accès à données d'un autre workspace)",
        "Élévation de privilège (modification de rôle via API)",
        "JWT manipulation (alg none, signature faible, expiration)",
        "Rate limiting (contournement, enumeration)",
        "CSRF sur actions sensibles",
        "SSRF via URLs de scraping / webhooks",
        "Fuite de secrets dans les réponses / logs",
    ])

    # ---------------------------------------------------------------- 13.6
    h2("Tests de charge")
    P(
        "Les tests de charge (et de stress) valident le comportement de la plateforme sous "
        "des charges extrêmes et identifier les limites de rupture. Ils complètent les tests "
        "de performance en poussant les ressources jusqu'à la saturation pour observer la "
        "dégradation et la récupération."
    )
    h3("Types de tests de charge")
    table(
        ["Type", "Objectif", "Méthode"],
        [
            ["Charge normale", "Valider le SLO en régime nominal", "Charge soutenue égale au pic attendu"],
            ["Charge de pointe", "Absorber un pic soudain", "Montée rapide à 2x le pic"],
            ["Stress", "Identifier la limite de rupture", "Augmentation progressive jusqu'à cassure"],
            ["Spike", "Résister à un pic extrême bref", "Saut à 5x pendant 1 min"],
            ["Endurance (soak)", "Détecter les fuites mémoire", "Charge modérée 24 h"],
            ["Récupération", "Valider le retour à la normale", "Charge puis arrêt, mesure de récupération"],
        ],
        col_widths=[2.8 * cm, 5.0 * cm, CONTENT_W - 7.8 * cm],
    )
    h3("Résultats attendus")
    bullets([
        "Aucune dégradation de l'uptime sous charge normale et de pointe",
        "Dégradation gracieuse sous stress (ralentissement, pas d'indisponibilité)",
        "Récupération complète < 5 min après arrêt de la charge",
        "Aucune fuite mémoire sur 24 h d'endurance",
        "Scale-out automatique effectif sous pic (HPA réactif)",
    ])
    h3("Plan de test de charge (extrait)")
    code_block(
        "# Plan de charge — pic de fin de mois (prospection intensive)\n"
        "Phase 1 (0–5 min)   : 100 utilisateurs, recherche + visualisation carte\n"
        "Phase 2 (5–10 min)  : montée à 500 utilisateurs, lancements de jobs\n"
        "Phase 3 (10–15 min) : 1000 utilisateurs, exports simultanés\n"
        "Phase 4 (15–20 min) : pic à 2000 utilisateurs (spike)\n"
        "Phase 5 (20–30 min) : retour à 500, mesure de récupération\n"
        "\n"
        "Métriques : latence P95/P99, taux d'erreur, CPU/mémoire, HPA events",
    )
    info_box(
        "Synthèse du chapitre",
        "La stratégie de test de ScrapIQ CI est pyramidale : une base large de tests "
        "unitaires rapides, des tests d'intégration pour les interactions, des tests E2E "
        "pour les parcours critiques, et des tests spécialisés (performance, sécurité, "
        "charge) pour valider les exigences non-fonctionnelles. L'automatisation et "
        "l'intégration CI/CD garantissent une qualité continue.",
    )
