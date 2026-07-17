# -*- coding: utf-8 -*-
"""Chapitre 12 — Déploiement."""
from cdc_common import *  # noqa: F401,F403


def chapter12():
    chapter_title(12, "Déploiement")
    intro(
        "Ce chapitre décrit la stratégie de déploiement de ScrapIQ CI : conteneurisation "
        "Docker, orchestration Kubernetes, pipeline CI/CD, infrastructure cloud, "
        "monitoring et observabilité, et scalabilité. L'objectif est un déploiement "
        "reproductible, automatisé, sécurisé et capable de supporter la montée en charge "
        "prévue par la roadmap."
    )

    # ---------------------------------------------------------------- 12.1
    h2("Conteneurisation Docker")
    P(
        "Chaque composant de ScrapIQ CI est conteneurisé avec Docker. Les images sont "
        "construites à partir de Dockerfiles multi-stage pour minimiser la taille et la "
        "surface d'attaque. Les images de production sont basées sur des images slim / "
        "alpine, exécutées en utilisateur non-root, et scannées pour les vulnérabilités."
    )
    h3("Images Docker")
    table(
        ["Image", "Base", "Taille", "Usage"],
        [
            ["scraapiq/app", "node:20-slim", "~280 Mo", "Application Next.js (web + API)"],
            ["scraapiq/worker-scraping", "node:20-slim + Playwright", "~1,2 Go", "Workers de scraping"],
            ["scraapiq/agents-orchestrator", "node:20-slim", "~300 Mo", "Orchestrateur agents IA"],
            ["scraapiq/notifications-ws", "oven/bun:latest", "~120 Mo", "Service WebSocket"],
            ["scraapiq/postgres", "postgres:16", "—", "Base (image officielle)"],
            ["scraapiq/redis", "redis:7-alpine", "—", "Cache + BullMQ"],
        ],
        col_widths=[4.4 * cm, 4.0 * cm, 1.8 * cm, CONTENT_W - 10.2 * cm],
    )
    h3("Dockerfile de l'application (extrait)")
    code_block(
        "# syntax=docker/dockerfile:1.7\n"
        "FROM node:20-slim AS deps\n"
        "WORKDIR /app\n"
        "COPY package.json bun.lock ./\n"
        "RUN npm ci --omit=dev\n"
        "\n"
        "FROM node:20-slim AS builder\n"
        "WORKDIR /app\n"
        "COPY --from=deps /app/node_modules ./node_modules\n"
        "COPY . .\n"
        "RUN npm run build\n"
        "\n"
        "FROM node:20-slim AS runner\n"
        "WORKDIR /app\n"
        "ENV NODE_ENV=production\n"
        "RUN addgroup --system --gid 1001 nodejs \\\n"
        " && adduser --system --uid 1001 nextjs\n"
        "COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./\n"
        "COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static\n"
        "COPY --from=builder --chown=nextjs:nodejs /app/public ./public\n"
        "USER nextjs\n"
        "EXPOSE 3000\n"
        'CMD ["node", "server.js"]',
        caption_text="Figure 12.1 — Dockerfile multi-stage de l'application",
    )

    # ---------------------------------------------------------------- 12.2
    h2("Orchestration Kubernetes")
    P(
        "Kubernetes orchestre le déploiement en production. Les composants stateless "
        "(app, workers, orchestrator, notifications) sont des Deployments scalables "
        "horizontalement via HPA (Horizontal Pod Autoscaler) sur la métrique CPU et la "
        "longueur de file BullMQ. Les composants stateful (PostgreSQL, Redis, "
        "Elasticsearch) sont des StatefulSets avec stockage persistant."
    )
    h3("Manifeste de déploiement (extrait)")
    code_block(
        "apiVersion: apps/v1\n"
        "kind: Deployment\n"
        "metadata:\n"
        "  name: scraapiq-app\n"
        "  namespace: scraapiq-prod\n"
        "spec:\n"
        "  replicas: 3\n"
        "  selector:\n"
        "    matchLabels: { app: scraapiq-app }\n"
        "  template:\n"
        "    metadata:\n"
        "      labels: { app: scraapiq-app }\n"
        "    spec:\n"
        "      containers:\n"
        "        - name: app\n"
        "          image: scraapiq/app:v1.2.3\n"
        "          ports: [{ containerPort: 3000 }]\n"
        "          envFrom:\n"
        "            - secretRef: { name: scraapiq-secrets }\n"
        "            - configMapRef: { name: scraapiq-config }\n"
        "          resources:\n"
        "            requests: { cpu: 250m, memory: 512Mi }\n"
        "            limits:   { cpu: 1000m, memory: 1Gi }\n"
        "          readinessProbe:\n"
        "            httpGet: { path: /api/health, port: 3000 }\n"
        "            periodSeconds: 10\n"
        "          livenessProbe:\n"
        "            httpGet: { path: /api/health, port: 3000 }\n"
        "            periodSeconds: 30",
        caption_text="Figure 12.2 — Deployment Kubernetes",
    )
    h3("Autoscaling (HPA)")
    table(
        ["Composant", "Min", "Max", "Métrique de scale"],
        [
            ["App", "3", "10", "CPU > 70 %"],
            ["Worker scraping", "2", "12", "Longueur file BullMQ > 20"],
            ["Agents orchestrator", "1", "5", "Pipelines concurrents > 3"],
            ["Notifications WS", "2", "6", "Connexions > 5000 / pod"],
        ],
        col_widths=[4.0 * cm, 1.6 * cm, 1.6 * cm, CONTENT_W - 7.2 * cm],
        align_center_cols=[1, 2],
    )
    h3("Stratégies de déploiement")
    bullets([
        "Rolling update (défaut) : maxSurge 1, maxUnavailable 0 (zéro downtime)",
        "Blue/green pour les releases majeures (bascule via Ingress)",
        "Canary pour les fonctionnalités risquées (progressive 5 % → 100 %)",
        "Rollback automatique en cas d'échec des health checks",
    ])

    # ---------------------------------------------------------------- 12.3
    h2("Pipeline CI/CD")
    P(
        "Le pipeline CI/CD automatise l'intégration et le déploiement continu. À chaque "
        "push sur une branche, le pipeline exécute lint, tests, build, scan de sécurité, "
        "et construction d'images. Sur la branche main, il déploie en staging "
        "automatiquement, puis en production après validation manuelle (gate)."
    )
    h3("Étapes du pipeline")
    ascii_diagram([
        "  Push ──► Lint ──► Tests unitaires ──► Tests intégration",
        "                                  │",
        "                                  ▼",
        "            Build ──► Scan sécurité (SCA/SAST) ──► Build images",
        "                                  │",
        "                                  ▼",
        "            Push registry ──► Deploy staging ──► Tests E2E",
        "                                  │",
        "                                  ▼",
        "            Gate manuel ──► Deploy prod (canary) ──► Validation",
    ], caption_text="Figure 12.3 — Pipeline CI/CD")
    h3("Extrait de pipeline (GitHub Actions)")
    code_block(
        "name: CI/CD\n"
        "on:\n"
        "  push:\n"
        "    branches: [main, develop]\n"
        "jobs:\n"
        "  quality:\n"
        "    runs-on: ubuntu-latest\n"
        "    steps:\n"
        "      - uses: actions/checkout@v4\n"
        "      - uses: actions/setup-node@v4\n"
        "        with: { node-version: 20 }\n"
        "      - run: npm ci\n"
        "      - run: npm run lint\n"
        "      - run: npm test -- --coverage\n"
        "  build:\n"
        "    needs: quality\n"
        "    runs-on: ubuntu-latest\n"
        "    steps:\n"
        "      - uses: actions/checkout@v4\n"
        "      - run: docker build -t scraapiq/app:${{ github.sha }} .\n"
        "      - run: docker push scraapiq/app:${{ github.sha }}\n"
        "  deploy-staging:\n"
        "    needs: build\n"
        "    if: github.ref == 'refs/heads/main'\n"
        "    runs-on: ubuntu-latest\n"
        "    steps:\n"
        "      - run: kubectl set image deployment/scraapiq-app app=scraapiq/app:${{ github.sha }}",
    )

    # ---------------------------------------------------------------- 12.4
    h2("Infrastructure cloud")
    P(
        "ScrapIQ CI est déployé sur une infrastructure cloud (AWS, Azure ou OVH selon le "
        "contexte) avec une architecture portable (conteneurs + Kubernetes) évitant le "
        "vendor lock-in. Le choix du cloud prend en compte la souveraineté des données "
        "(hébergement en région proche de la Côte d'Ivoire) et la conformité APIPD."
    )
    h3("Composants d'infrastructure")
    table(
        ["Composant", "Service cloud", "Rôle"],
        [
            ["Cluster K8s", "EKS / AKS / OVH Managed K8s", "Orchestration des conteneurs"],
            ["Base PostgreSQL", "RDS / Azure DB / Managed", "Source de vérité"],
            ["Elasticsearch", "Cloud ES / self-hosted", "Moteur de recherche"],
            ["Redis", "ElastiCache / self-hosted", "Cache + file BullMQ"],
            ["Stockage objets", "S3 / Blob / Swift", "Exports, backups, assets"],
            ["CDN / Edge", "CloudFront / Cloudflare", "WAF, anti-DDoS, cache statique"],
            ["DNS", "Route53 / Azure DNS", "Résolution de noms"],
            ["Monitoring", "Prometheus + Grafana", "Métriques, dashboards"],
            ["Logs", "Loki / ELK", "Centralisation des logs"],
        ],
        col_widths=[3.2 * cm, 4.6 * cm, CONTENT_W - 7.8 * cm],
    )
    h3("Environnements")
    table(
        ["Environnement", "Usage", "Données", "Accès"],
        [
            ["dev", "Développement local", "Jeu de test synthétique", "Développeurs"],
            ["staging", "Pré-production, validation", "Anonymisée, sous-ensemble", "Équipe + QA"],
            ["prod", "Production", "Réelles", "Restreint (SSO + 2FA)"],
            ["sandbox", "Démonstration", "Synthétique réaliste", "Public (compte démo)"],
        ],
        col_widths=[2.4 * cm, 4.6 * cm, 4.4 * cm, CONTENT_W - 11.4 * cm],
    )

    # ---------------------------------------------------------------- 12.5
    h2("Monitoring et observabilité")
    P(
        "L'observabilité couvre trois piliers : les métriques (Prometheus + Grafana), les "
        "logs (centralisés, structurés JSON) et les traces (tracing distribué). Des "
        "tableaux de bord opérationnels et des alertes (Alertmanager) permettent de "
        "détecter et diagnostiquer les incidents rapidement."
    )
    h3("Métriques surveillées")
    table(
        ["Catégorie", "Métriques", "Seuil d'alerte"],
        [
            ["App", "req/s, latence P95/P99, taux d'erreur", "P95 > 500 ms ou erreur > 1 %"],
            ["Workers", "jobs en file, durée, taux d'échec", "File > 100 ou échec > 5 %"],
            ["DB", "connexions, latence requête, réplication lag", "Lag > 5 s"],
            ["ES", "latence recherche, taille index, santé cluster", "Latence > 200 ms"],
            ["Redis", "mémoire, hits/misses, latence", "Mémoire > 80 %"],
            ["Infra", "CPU, mémoire, disque, réseau", "CPU > 85 % pendant 5 min"],
        ],
        col_widths=[2.4 * cm, 6.6 * cm, CONTENT_W - 9.0 * cm],
    )
    h3("Tableaux de bord Grafana")
    bullets([
        "Vue d'ensemble (SLO, uptime, taux d'erreur global)",
        "Détail application (par route, par code)",
        "Workers et files BullMQ",
        "Base de données et Elasticsearch",
        "Sécurité (tentatives de connexion, blocages WAF)",
        "Business (comptes actifs, jobs, exports, quotas)",
    ])
    h3("Alerting et on-call")
    P(
        "Les alertes critiques (indisponibilité, saturation, incident sécurité) déclenchent "
        "une notification immédiate (PagerDuty / Opsgenie) à l'équipe d'astreinte. Les "
        "alertes de niveau warning sont agrégées et notifiées par canal dédié. Une "
        "procédure d'astreinte (runbook) documente la réponse à chaque type d'incident."
    )

    # ---------------------------------------------------------------- 12.6
    h2("Stratégie de scalabilité")
    P(
        "La scalabilité de ScrapIQ CI est principalement horizontale : les composants "
        "stateless se répliquent sous charge, et les workers de scraping scalent en "
        "fonction de la demande (longueur de file). Les stores stateful utilisent le "
        "sharding (Elasticsearch) et la réplication read (PostgreSQL) pour absorber la "
        "charge de lecture."
    )
    h3("Capacités cibles")
    table(
        ["Ressource", "Capacité initiale", "Capacité cible (3 ans)", "Mécanisme"],
        [
            ["Entreprises indexées", "1 million", "5 millions", "Sharding ES"],
            ["Jobs de scraping / jour", "5 000", "50 000", "Workers HPA"],
            ["Utilisateurs concurrents", "500", "5 000", "App HPA + sticky WS"],
            ["Requêtes API / min", "1 000", "10 000", "App HPA + cache"],
            ["Exports / jour", "2 000", "20 000", "Workers export"],
        ],
        col_widths=[4.0 * cm, 3.0 * cm, 3.4 * cm, CONTENT_W - 10.4 * cm],
    )
    h3("Optimisations de scalabilité")
    bullets([
        "Stateless : aucune session serveur (JWT + Redis pour l'état partagé)",
        "Cache multi-niveau : Redis (app) + CDN (assets statiques)",
        "Read replicas PostgreSQL pour la BI et les exports lourds",
        "Sharding Elasticsearch par région/plage temporelle si besoin",
        "Asynchrone : toutes les tâches longues via BullMQ",
        "Connection pooling : PgBouncer devant PostgreSQL",
        "Compression des réponses (gzip / brotli)",
    ])
    info_box(
        "Synthèse du chapitre",
        "Le déploiement de ScrapIQ CI s'appuie sur Docker, Kubernetes, un pipeline CI/CD "
        "automatisé, une infrastructure cloud portable et une observabilité complète. La "
        "scalabilité horizontale et l'architecture asynchrone permettent d'absorber la "
        "croissance prévue sur 3 ans sans refonte majeure. Les stratégies de déploiement "
        "(rolling, blue/green, canary) assurent des mises en production sans interruption.",
    )
