# -*- coding: utf-8 -*-
"""Chapitre 10 — Base de données."""
from cdc_common import *  # noqa: F401,F403


def chapter10():
    chapter_title(10, "Base de données")
    intro(
        "Ce chapitre décrit le modèle de données de ScrapIQ CI. La persistance s'appuie sur "
        "PostgreSQL via l'ORM Prisma. Le modèle compte plus de 30 entités couvrant les "
        "domaines multi-tenant (organisations, workspaces, membres), utilisateurs et "
        "authentification, métier (entreprises), scraping et jobs, exports, notifications, "
        "SaaS et facturation, sécurité et audit. Sont détaillées : la vue d'ensemble, les "
        "modèles par domaine, les index et optimisations, et la stratégie de partitionnement "
        "et d'archivage."
    )

    # ---------------------------------------------------------------- 10.1
    h2("Vue d'ensemble du schéma")
    P(
        "Le schéma Prisma est organisé en blocs thématiques avec des commentaires de "
        "section. Chaque modèle utilise des identifiants CUID (collision-resistant, "
        "incrémentaux dans le temps), des timestamps createdAt/updatedAt automatiques, et "
        "des index ciblés pour les requêtes fréquentes. L'isolation multi-tenant est "
        "assurée par la présence de organizationId ou workspaceId sur les modèles métier."
    )
    h3("Liste des modèles (30+)")
    table(
        ["Domaine", "Modèles"],
        [
            ["Multi-tenant", "Organization, Workspace"],
            ["Utilisateurs & RBAC", "User, Member, Account (OAuth), MemberRole (enum)"],
            ["Auth & sessions", "Session, RefreshToken, JwtBlacklist, ApiKey"],
            ["SaaS & facturation", "License, Subscription, Invoice, QuotaUsage"],
            ["Audit & sécurité", "AuditLog"],
            ["Métier", "Company"],
            ["API & intégrations", "RestApiLog, Webhook, WebhookDelivery"],
            ["Notifications", "Notification, AlertRule"],
            ["Rapports", "ScheduledReport, ReportExecution"],
            ["Scraping & jobs", "ScrapeJob, ScrapeJobItem, ScrapeSource, SourceConfig"],
            ["Agents IA", "AgentRun, AgentEvent, PipelineRun"],
            ["Exports", "Export, ExportTemplate"],
            ["Référentiels", "Sector, City, Commune"],
        ],
        col_widths=[3.6 * cm, CONTENT_W - 3.6 * cm],
    )
    h3("Configuration Prisma")
    code_block(
        "// prisma/schema.prisma — en-tête\n"
        "generator client {\n"
        "  provider = \"prisma-client-js\"\n"
        "}\n"
        "\n"
        "datasource db {\n"
        "  provider = \"postgresql\"\n"
        "  url      = env(\"DATABASE_URL\")\n"
        "}\n"
        "\n"
        "// Conventions :\n"
        "// - id : String @id @default(cuid())\n"
        "// - timestamps : createdAt / updatedAt @updatedAt\n"
        "// - index sur clés étrangères et champs filtrés fréquemment\n"
        "// - @@unique pour les contraintes d'unicité composées",
    )

    # ---------------------------------------------------------------- 10.2
    h2("Modèles multi-tenant")
    h3("Organization")
    code_block(
        "model Organization {\n"
        "  id          String   @id @default(cuid())\n"
        "  name        String\n"
        "  slug        String   @unique\n"
        "  plan        String   @default(\"starter\")\n"
        "  ownerId     String\n"
        "  settings    String   @default(\"{}\")  // JSON\n"
        "  createdAt   DateTime @default(now())\n"
        "  updatedAt   DateTime @updatedAt\n"
        "  members     Member[]\n"
        "  workspaces  Workspace[]\n"
        "  owner       User     @relation(\"OrgOwner\", fields: [ownerId], references: [id])\n"
        "  @@index([slug])\n"
        "}",
    )
    h3("Workspace")
    code_block(
        "model Workspace {\n"
        "  id              String   @id @default(cuid())\n"
        "  name            String\n"
        "  slug            String\n"
        "  organizationId  String\n"
        "  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n"
        "  createdAt       DateTime @default(now())\n"
        "  updatedAt       DateTime @updatedAt\n"
        "  members         Member[]\n"
        "  companies       Company[]\n"
        "  @@unique([organizationId, slug])\n"
        "  @@index([organizationId])\n"
        "}",
    )
    h3("User & Member")
    code_block(
        "model User {\n"
        "  id                  String   @id @default(cuid())\n"
        "  email               String   @unique\n"
        "  emailVerified       DateTime?\n"
        "  passwordHash        String?   // null si OAuth-only\n"
        "  name                String?\n"
        "  avatarUrl           String?\n"
        "  locale              String   @default(\"fr\")\n"
        "  timezone            String   @default(\"Africa/Abidjan\")\n"
        "  twoFactorEnabled    Boolean  @default(false)\n"
        "  twoFactorSecret     String?   // chiffré au repos\n"
        "  twoFactorBackupCodes String?  // JSON hashed\n"
        "  twoFactorEnabledAt  DateTime?\n"
        "  status              String   @default(\"active\")\n"
        "  lastLoginAt         DateTime?\n"
        "  lastLoginIp         String?\n"
        "  failedLoginAttempts Int      @default(0)\n"
        "  lockedUntil         DateTime?\n"
        "  createdAt           DateTime @default(now())\n"
        "  updatedAt           DateTime @updatedAt\n"
        "  @@index([email])\n"
        "  @@index([status])\n"
        "}\n"
        "\n"
        "enum MemberRole {\n"
        "  OWNER\n"
        "  ADMIN\n"
        "  MANAGER\n"
        "  AGENT\n"
        "  VIEWER\n"
        "}\n"
        "\n"
        "model Member {\n"
        "  id           String     @id @default(cuid())\n"
        "  userId       String\n"
        "  workspaceId  String\n"
        "  role         MemberRole @default(VIEWER)\n"
        "  createdAt    DateTime   @default(now())\n"
        "  @@unique([userId, workspaceId])\n"
        "  @@index([workspaceId])\n"
        "}",
    )

    # ---------------------------------------------------------------- 10.3
    h2("Modèles métier (entreprises)")
    h3("Company")
    code_block(
        "model Company {\n"
        "  id            String   @id @default(cuid())\n"
        "  workspaceId   String\n"
        "  name          String\n"
        "  nameNormalized String   // pour le dédoublonnage\n"
        "  sector        String?\n"
        "  sectorCode    String?\n"
        "  city          String?\n"
        "  commune       String?\n"
        "  address       String?\n"
        "  phone         String?   // +225 ...\n"
        "  phoneRaw      String?   // valeur originale\n"
        "  email         String?\n"
        "  website       String?\n"
        "  description   String?\n"
        "  hours         String?   // JSON horaires\n"
        "  lat           Float?\n"
        "  lng           Float?\n"
        "  rating        Float?\n"
        "  reviewsCount  Int?\n"
        "  score         Int      @default(0)   // 0-100\n"
        "  grade         String   @default(\"D\") // A|B|C|D\n"
        "  sources       String   @default(\"[]\") // JSON array\n"
        "  keywords      String   @default(\"[]\") // JSON array\n"
        "  status        String   @default(\"active\") // active|closed|suspect\n"
        "  verified      Boolean  @default(false)\n"
        "  lastScrapedAt DateTime?\n"
        "  createdAt     DateTime @default(now())\n"
        "  updatedAt     DateTime @updatedAt\n"
        "  @@index([workspaceId])\n"
        "  @@index([workspaceId, sector])\n"
        "  @@index([workspaceId, city])\n"
        "  @@index([workspaceId, commune])\n"
        "  @@index([workspaceId, grade])\n"
        "  @@index([nameNormalized])\n"
        "  @@index([phone])\n"
        "  @@index([status, lastScrapedAt])\n"
        "}",
    )
    h3("Score détaillé (modèle associé)")
    code_block(
        "model CompanyScore {\n"
        "  id              String  @id @default(cuid())\n"
        "  companyId       String  @unique\n"
        "  completeness    Float   // 25%\n"
        "  validity        Float   // 20%\n"
        "  freshness       Float   // 15%\n"
        "  enrichment      Float   // 15%\n"
        "  sourceReliability Float  // 10%\n"
        "  coherence       Float   // 10%\n"
        "  onlinePresence  Float   // 5%\n"
        "  total           Int     // score agrégé 0-100\n"
        "  grade           String  // A|B|C|D\n"
        "  computedAt      DateTime @default(now())\n"
        "  @@index([total])\n"
        "}",
    )

    # ---------------------------------------------------------------- 10.4
    h2("Modèles scraping et jobs")
    h3("ScrapeJob et ScrapeJobItem")
    code_block(
        "model ScrapeJob {\n"
        "  id          String   @id @default(cuid())\n"
        "  workspaceId String\n"
        "  userId      String\n"
        "  query       String\n"
        "  city        String?\n"
        "  commune     String?\n"
        "  sources     String   @default(\"[]\")  // JSON\n"
        "  maxResults  Int      @default(200)\n"
        "  status      String   @default(\"queued\") // queued|running|completed|failed|aborted\n"
        "  results     Int      @default(0)\n"
        "  errors      String?  // JSON\n"
        "  duration    Int?     // ms\n"
        "  startedAt   DateTime?\n"
        "  finishedAt  DateTime?\n"
        "  createdAt   DateTime @default(now())\n"
        "  @@index([workspaceId, status])\n"
        "  @@index([userId, createdAt])\n"
        "}\n"
        "\n"
        "model ScrapeJobItem {\n"
        "  id        String   @id @default(cuid())\n"
        "  jobId     String\n"
        "  source    String   // google_maps|facebook|linkedin|website\n"
        "  raw       String   // JSON données brutes\n"
        "  status    String   @default(\"pending\")\n"
        "  companyId String?  // lien après fusion\n"
        "  @@index([jobId])\n"
        "  @@index([source])\n"
        "}",
    )
    h3("Agents IA (PipelineRun, AgentRun, AgentEvent)")
    code_block(
        "model PipelineRun {\n"
        "  id          String   @id @default(cuid())\n"
        "  workspaceId String\n"
        "  userId      String\n"
        "  query       String\n"
        "  city        String?\n"
        "  commune     String?\n"
        "  status      String   @default(\"running\")\n"
        "  progress    Int      @default(0)\n"
        "  total       Int      @default(10)\n"
        "  sharedData  String   @default(\"{}\") // blackboard JSON\n"
        "  duration    Int?\n"
        "  startedAt   DateTime @default(now())\n"
        "  finishedAt  DateTime?\n"
        "  @@index([workspaceId, status])\n"
        "}\n"
        "\n"
        "model AgentRun {\n"
        "  id          String   @id @default(cuid())\n"
        "  pipelineId  String\n"
        "  agentNumber Int      // 1..10\n"
        "  agentName   String\n"
        "  status      String   @default(\"pending\")\n"
        "  duration    Int?\n"
        "  error       String?\n"
        "  retries     Int      @default(0)\n"
        "  startedAt   DateTime?\n"
        "  finishedAt  DateTime?\n"
        "  @@index([pipelineId])\n"
        "}\n"
        "\n"
        "model AgentEvent {\n"
        "  id         String   @id @default(cuid())\n"
        "  pipelineId String\n"
        "  agentNumber Int?\n"
        "  type       String   // start|progress|complete|error\n"
        "  message    String\n"
        "  data       String?  // JSON\n"
        "  createdAt  DateTime @default(now())\n"
        "  @@index([pipelineId, createdAt])\n"
        "}",
    )

    # ---------------------------------------------------------------- 10.5
    h2("Index et optimisations")
    h3("Stratégie d'indexation")
    P(
        "L'indexation cible les requêtes fréquentes : filtrage par workspace (toujours "
        "présent car multi-tenant), par secteur/ville/commune, recherche par nom normalisé "
        "et téléphone (dédoublonnage), tri par score et date. Les index composites "
        "(workspaceId + champ) évitent les scans complets sur les grandes tables."
    )
    table(
        ["Table", "Index", "Usage"],
        [
            ["Company", "(workspaceId, sector)", "Filtre secteur dans un workspace"],
            ["Company", "(workspaceId, city)", "Filtre ville"],
            ["Company", "(workspaceId, commune)", "Filtre commune"],
            ["Company", "(workspaceId, grade)", "Filtre catégorie A/B/C/D"],
            ["Company", "(nameNormalized)", "Dédoublonnage par nom"],
            ["Company", "(phone)", "Dédoublonnage par téléphone"],
            ["Company", "(status, lastScrapedAt)", "Fraîcheur / re-scraping"],
            ["ScrapeJob", "(workspaceId, status)", "Suivi des jobs par workspace"],
            ["AuditLog", "(actorId, createdAt)", "Audit par utilisateur"],
            ["Notification", "(userId, readAt)", "Notifications non lues"],
        ],
        col_widths=[2.6 * cm, 4.8 * cm, CONTENT_W - 7.4 * cm],
    )
    h3("Optimisations des requêtes")
    bullets([
        "Utilisation systématique de select pour limiter les colonnes retournées",
        "Pagination cursor plutôt qu'offset sur les grandes listes",
        "Recherche full-text déléguée à Elasticsearch (PostgreSQL non sollicité)",
        "Cache Redis pour les lectures fréquentes (sessions, quotas, configs)",
        "Requêtes préparées via Prisma (paramétrées, anti-injection)",
        "Transactions pour les opérations multi-tables (fusion de doublons)",
        "Batch inserts pour les résultats de scraping ( bulkCreate )",
    ])
    h3("Exemple de requête optimisée")
    code_block(
        "// Liste des entreprises d'un workspace, filtrées et paginées\n"
        "const companies = await db.company.findMany({\n"
        "  where: {\n"
        "    workspaceId,\n"
        "    sector: sector ?? undefined,\n"
        "    commune: commune ?? undefined,\n"
        "    score: minScore ? { gte: minScore } : undefined,\n"
        "  },\n"
        "  orderBy: { score: 'desc' },\n"
        "  take: limit,\n"
        "  cursor: cursor ? { id: cursor } : undefined,\n"
        "  skip: cursor ? 1 : 0,\n"
        "  select: { id: true, name: true, sector: true, phone: true, score: true, grade: true },\n"
        "});",
    )

    # ---------------------------------------------------------------- 10.6
    h2("Partitionnement et archivage")
    h3("Stratégie de partitionnement")
    P(
        "Les tables à forte croissance (AuditLog, AgentEvent, RestApiLog, ScrapeJobItem, "
        "WebhookDelivery) sont partitionnées par période (mois) au niveau PostgreSQL. Cela "
        "accélère les requêtes récentes (partition pruning) et facilite l'archivage des "
        "données anciennes (détachement de partitions)."
    )
    table(
        ["Table", "Critère", "Rétention active", "Archivage"],
        [
            ["AuditLog", "Mois", "12 mois", "Déplacement vers table archive après 12 mois"],
            ["AgentEvent", "Mois", "6 mois", "Suppression après 6 mois"],
            ["RestApiLog", "Mois", "3 mois", "Agrégation puis suppression"],
            ["ScrapeJobItem", "Mois", "6 mois", "Suppression (données brutes)"],
            ["WebhookDelivery", "Mois", "3 mois", "Suppression"],
            ["Notification", "Mois", "6 mois", "Suppression des lues anciennes"],
        ],
        col_widths=[3.2 * cm, 1.8 * cm, 2.6 * cm, CONTENT_W - 7.6 * cm],
    )
    h3("Archivage et RGPD / APIPD")
    P(
        "L'archivage respecte les principes de minimisation et de limitation de conservation. "
        "Les données personnelles des utilisateurs sont conservées tant que le compte est "
        "actif, puis anonymisées ou supprimées à la demande (droit à l'effacement). Les "
        "données business collectées publiquement sont conservées tant qu'elles sont "
        "pertinentes et actualisées ; un re-scraping périodique maintient leur fraîcheur et "
        "les établissements fermés sont marqués puis archivés."
    )
    h3("Procédure de purge")
    code_block(
        "-- Job cron mensuel : archivage des partitions anciennes\n"
        "CREATE OR REPLACE FUNCTION archive_old_audit() RETURNS void AS $$\n"
        "BEGIN\n"
        "  -- Détacher la partition de plus de 12 mois\n"
        "  EXECUTE format(\n"
        "    'ALTER TABLE \"AuditLog\" DETACH PARTITION %I',\n"
        "    'audit_' || to_char(now() - interval '13 months', 'YYYY_MM')\n"
        "  );\n"
        "  -- Exporter vers table archive (ou object storage)\n"
        "  -- puis DROP la partition détachée\n"
        "END;\n"
        "$$ LANGUAGE plpgsql;",
    )
    h3("Sauvegarde et restauration")
    bullets([
        "Sauvegarde physique quotidienne (pg_basebackup) + WAL archivés (PITR)",
        "Dump logique hebdomadaire (pg_dump) pour restaurations ciblées",
        "Réplica en lecture pour la BI et les requêtes lourdes",
        "Restauration testée mensuellement (procédure documentée)",
        "RPO ≤ 24 h (point-in-time), RTO ≤ 4 h",
    ])
    info_box(
        "Synthèse du chapitre",
        "Le modèle de données de ScrapIQ CI comprend plus de 30 entités organisées par "
        "domaine, avec une isolation multi-tenant rigoureuse, une indexation ciblée et une "
        "stratégie de partitionnement/archivage pour les tables à forte croissance. La "
        "conformité RGPD/APIPD est intégrée aux procédures de purge. PostgreSQL reste la "
        "source de vérité, complétée par Elasticsearch pour la recherche et Redis pour le "
        "cache.",
    )
