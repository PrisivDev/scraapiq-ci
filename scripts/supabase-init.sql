-- ============================================================================
-- ScrapIQ CI — Script SQL complet pour Supabase
-- ============================================================================
-- À exécuter dans Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Ce script :
--   1. Active l'extension pgvector (pour la déduplication IA)
--   2. Crée toutes les 23 tables du schéma
--   3. Crée les index pour les performances
--   4. Crée le premier utilisateur OWNER (admin)
--
-- APRÈS avoir exécuté ce script :
--   - Les tables seront visibles dans Supabase (Table Editor)
--   - Vous pourrez vous connecter avec ADMIN_EMAIL / ADMIN_PASSWORD
--
-- ⚠️ Remplacez les valeurs ci-dessous avant d'exécuter :
-- ============================================================================

-- === À PERSONNALISER (remplacez par vos valeurs) ===
-- Email de l'admin
-- Mot de passe : utilisez le générateur bcrypt ci-dessous, OU laissez tel quel
--   et changez le mot de passe après votre première connexion via /account/security

-- ============================================================================
-- ÉTAPE 0 : Extension pgvector
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ÉTAPE 1 : Enum (PostgreSQL natif)
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ÉTAPE 2 : Tables
-- ============================================================================

-- Organization
CREATE TABLE IF NOT EXISTS "Organization" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "plan"        TEXT NOT NULL DEFAULT 'starter',
  "ownerId"     TEXT NOT NULL,
  "settings"    TEXT NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX IF NOT EXISTS "Organization_slug_idx" ON "Organization"("slug");

-- Workspace
CREATE TABLE IF NOT EXISTS "Workspace" (
  "id"              TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_organizationId_slug_key" ON "Workspace"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "Workspace_organizationId_idx" ON "Workspace"("organizationId");

-- User
CREATE TABLE IF NOT EXISTS "User" (
  "id"                    TEXT NOT NULL,
  "email"                 TEXT NOT NULL,
  "emailVerified"         TIMESTAMP(3),
  "passwordHash"          TEXT,
  "name"                  TEXT,
  "avatarUrl"             TEXT,
  "locale"                TEXT NOT NULL DEFAULT 'fr',
  "timezone"              TEXT NOT NULL DEFAULT 'Africa/Abidjan',
  "twoFactorEnabled"      BOOLEAN NOT NULL DEFAULT false,
  "twoFactorSecret"       TEXT,
  "twoFactorBackupCodes"  TEXT,
  "twoFactorEnabledAt"    TIMESTAMP(3),
  "status"                TEXT NOT NULL DEFAULT 'active',
  "lastLoginAt"           TIMESTAMP(3),
  "lastLoginIp"           TEXT,
  "failedLoginAttempts"   INTEGER NOT NULL DEFAULT 0,
  "lockedUntil"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");

-- Member
CREATE TABLE IF NOT EXISTS "Member" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "workspaceId"     TEXT,
  "role"            "MemberRole" NOT NULL DEFAULT 'VIEWER',
  "permissions"     TEXT NOT NULL DEFAULT '[]',
  "invitedBy"       TEXT,
  "invitedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"      TIMESTAMP(3),
  "status"          TEXT NOT NULL DEFAULT 'pending'
);
CREATE UNIQUE INDEX IF NOT EXISTS "Member_userId_organizationId_workspaceId_key" ON "Member"("userId", "organizationId", "workspaceId");
CREATE INDEX IF NOT EXISTS "Member_userId_idx" ON "Member"("userId");
CREATE INDEX IF NOT EXISTS "Member_organizationId_idx" ON "Member"("organizationId");

-- Account (OAuth)
CREATE TABLE IF NOT EXISTS "Account" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refreshToken"      TEXT,
  "accessToken"       TEXT,
  "expiresAt"         INTEGER,
  "tokenType"         TEXT,
  "scope"             TEXT,
  "idToken"           TEXT,
  "sessionState"      TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

-- Session
CREATE TABLE IF NOT EXISTS "Session" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "token"       TEXT NOT NULL,
  "ip"          TEXT,
  "userAgent"   TEXT,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- RefreshToken
CREATE TABLE IF NOT EXISTS "RefreshToken" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "token"       TEXT NOT NULL,
  "family"      TEXT NOT NULL,
  "ip"          TEXT,
  "userAgent"   TEXT,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "revokedAt"   TIMESTAMP(3),
  "replacedBy"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_family_idx" ON "RefreshToken"("family");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- JwtBlacklist
CREATE TABLE IF NOT EXISTS "JwtBlacklist" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "jti"         TEXT NOT NULL,
  "reason"      TEXT NOT NULL DEFAULT 'logout',
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "JwtBlacklist_jti_key" ON "JwtBlacklist"("jti");
CREATE INDEX IF NOT EXISTS "JwtBlacklist_userId_idx" ON "JwtBlacklist"("userId");
CREATE INDEX IF NOT EXISTS "JwtBlacklist_expiresAt_idx" ON "JwtBlacklist"("expiresAt");

-- ApiKey
CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "keyHash"     TEXT NOT NULL,
  "keyPrefix"   TEXT NOT NULL,
  "scopes"      TEXT NOT NULL DEFAULT '[]',
  "lastUsedAt"  TIMESTAMP(3),
  "expiresAt"   TIMESTAMP(3),
  "revokedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");

-- License
CREATE TABLE IF NOT EXISTS "License" (
  "id"              TEXT NOT NULL,
  "key"             TEXT NOT NULL,
  "plan"            TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "maxUsers"        INTEGER NOT NULL DEFAULT 5,
  "maxCompanies"    INTEGER NOT NULL DEFAULT 10000,
  "maxApiCalls"     INTEGER NOT NULL DEFAULT 100000,
  "maxExports"      INTEGER NOT NULL DEFAULT 100,
  "maxSources"      INTEGER NOT NULL DEFAULT 3,
  "maxWorkspaces"   INTEGER NOT NULL DEFAULT 1,
  "features"        TEXT NOT NULL DEFAULT '[]',
  "status"          TEXT NOT NULL DEFAULT 'inactive',
  "activatedAt"     TIMESTAMP(3),
  "expiresAt"       TIMESTAMP(3),
  "organizationId"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "License_key_key" ON "License"("key");
CREATE INDEX IF NOT EXISTS "License_status_idx" ON "License"("status");
CREATE INDEX IF NOT EXISTS "License_organizationId_idx" ON "License"("organizationId");

-- Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "licenseId"           TEXT,
  "plan"                TEXT NOT NULL DEFAULT 'starter',
  "status"              TEXT NOT NULL DEFAULT 'trialing',
  "billingCycle"        TEXT NOT NULL DEFAULT 'monthly',
  "amountXOF"           INTEGER NOT NULL DEFAULT 25000,
  "currentPeriodStart"  TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd"    TIMESTAMP(3) NOT NULL,
  "cancelAtPeriodEnd"   BOOLEAN NOT NULL DEFAULT false,
  "paymentMethod"       TEXT,
  "providerSubId"       TEXT,
  "trialEndsAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Subscription_organizationId_idx" ON "Subscription"("organizationId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

-- Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "subscriptionId"  TEXT,
  "number"          TEXT NOT NULL,
  "amountXOF"       INTEGER NOT NULL,
  "taxXOF"          INTEGER NOT NULL DEFAULT 0,
  "totalXOF"        INTEGER NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "dueDate"         TIMESTAMP(3) NOT NULL,
  "paidAt"          TIMESTAMP(3),
  "items"           TEXT NOT NULL DEFAULT '[]',
  "pdfUrl"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_idx" ON "Invoice"("organizationId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_number_idx" ON "Invoice"("number");

-- QuotaUsage
CREATE TABLE IF NOT EXISTS "QuotaUsage" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "periodYear"      INTEGER NOT NULL,
  "periodMonth"     INTEGER NOT NULL,
  "apiCalls"        INTEGER NOT NULL DEFAULT 0,
  "companiesStored" INTEGER NOT NULL DEFAULT 0,
  "exportsCount"    INTEGER NOT NULL DEFAULT 0,
  "scrapeJobs"      INTEGER NOT NULL DEFAULT 0,
  "usersCount"      INTEGER NOT NULL DEFAULT 0,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuotaUsage_organizationId_periodYear_periodMonth_key" ON "QuotaUsage"("organizationId", "periodYear", "periodMonth");
CREATE INDEX IF NOT EXISTS "QuotaUsage_organizationId_idx" ON "QuotaUsage"("organizationId");

-- AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT,
  "action"      TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "metadata"    TEXT NOT NULL DEFAULT '{}',
  "ip"          TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_category_idx" ON "AuditLog"("category");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Company
CREATE TABLE IF NOT EXISTS "Company" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT,
  "name"            TEXT NOT NULL,
  "sector"          TEXT,
  "commune"         TEXT,
  "city"            TEXT,
  "address"         TEXT,
  "phone"           TEXT,
  "email"           TEXT,
  "website"         TEXT,
  "rccm"            TEXT,
  "lat"             DOUBLE PRECISION,
  "lng"             DOUBLE PRECISION,
  "rating"          DOUBLE PRECISION,
  "reviewCount"     INTEGER,
  "status"          TEXT NOT NULL DEFAULT 'active',
  "description"     TEXT,
  "employees"       TEXT,
  "sources"         TEXT NOT NULL DEFAULT '[]',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Company_name_idx" ON "Company"("name");
CREATE INDEX IF NOT EXISTS "Company_sector_idx" ON "Company"("sector");
CREATE INDEX IF NOT EXISTS "Company_city_idx" ON "Company"("city");
CREATE INDEX IF NOT EXISTS "Company_commune_idx" ON "Company"("commune");
CREATE INDEX IF NOT EXISTS "Company_status_idx" ON "Company"("status");
CREATE INDEX IF NOT EXISTS "Company_organizationId_idx" ON "Company"("organizationId");

-- CompanyEmbedding (pgvector)
CREATE TABLE IF NOT EXISTS "CompanyEmbedding" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "embedding"   vector(1536),
  "model"       TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyEmbedding_companyId_key" ON "CompanyEmbedding"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyEmbedding_companyId_idx" ON "CompanyEmbedding"("companyId");

-- RestApiLog
CREATE TABLE IF NOT EXISTS "RestApiLog" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT,
  "method"      TEXT NOT NULL,
  "path"        TEXT NOT NULL,
  "status"      INTEGER NOT NULL,
  "durationMs"  INTEGER NOT NULL DEFAULT 0,
  "ip"          TEXT,
  "userAgent"   TEXT,
  "requestBody" TEXT,
  "responseSize" INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RestApiLog_userId_idx" ON "RestApiLog"("userId");
CREATE INDEX IF NOT EXISTS "RestApiLog_path_idx" ON "RestApiLog"("path");
CREATE INDEX IF NOT EXISTS "RestApiLog_createdAt_idx" ON "RestApiLog"("createdAt");

-- Webhook
CREATE TABLE IF NOT EXISTS "Webhook" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "url"             TEXT NOT NULL,
  "events"          TEXT NOT NULL DEFAULT '[]',
  "secret"          TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Webhook_organizationId_idx" ON "Webhook"("organizationId");

-- WebhookDelivery
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id"          TEXT NOT NULL,
  "webhookId"   TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "eventType"   TEXT NOT NULL,
  "payload"     TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "statusCode"  INTEGER,
  "response"    TEXT,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

-- Notification
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT,
  "channel"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "payload"     TEXT NOT NULL DEFAULT '{}',
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "priority"    TEXT NOT NULL DEFAULT 'normal',
  "recipient"   TEXT,
  "senderId"    TEXT,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "error"       TEXT,
  "sentAt"      TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_status_idx" ON "Notification"("status");
CREATE INDEX IF NOT EXISTS "Notification_channel_idx" ON "Notification"("channel");

-- AlertRule
CREATE TABLE IF NOT EXISTS "AlertRule" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "metric"        TEXT NOT NULL,
  "condition"     TEXT NOT NULL,
  "threshold"     DOUBLE PRECISION NOT NULL,
  "channels"      TEXT NOT NULL DEFAULT '[]',
  "cooldownMin"   INTEGER NOT NULL DEFAULT 60,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "lastTriggeredAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ScheduledReport
CREATE TABLE IF NOT EXISTS "ScheduledReport" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "type"        TEXT NOT NULL,
  "frequency"   TEXT NOT NULL,
  "format"      TEXT NOT NULL DEFAULT 'xlsx',
  "channels"    TEXT NOT NULL DEFAULT '[]',
  "config"      TEXT NOT NULL DEFAULT '{}',
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt"   TIMESTAMP(3),
  "nextRunAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ReportExecution
CREATE TABLE IF NOT EXISTS "ReportExecution" (
  "id"          TEXT NOT NULL,
  "reportId"    TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "fileUrl"     TEXT,
  "fileSize"    INTEGER,
  "error"       TEXT,
  "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ReportExecution_reportId_idx" ON "ReportExecution"("reportId");

-- ScrapeJobRecord
CREATE TABLE IF NOT EXISTS "ScrapeJobRecord" (
  "id"                 TEXT NOT NULL,
  "jobId"              TEXT NOT NULL,
  "organizationId"     TEXT,
  "userId"             TEXT,
  "keyword"            TEXT NOT NULL,
  "city"               TEXT,
  "commune"            TEXT,
  "neighborhood"       TEXT,
  "status"             TEXT NOT NULL DEFAULT 'queued',
  "progress"           INTEGER NOT NULL DEFAULT 0,
  "resultsCount"       INTEGER NOT NULL DEFAULT 0,
  "processedCount"     INTEGER NOT NULL DEFAULT 0,
  "duplicatesDetected" INTEGER NOT NULL DEFAULT 0,
  "errors"             TEXT NOT NULL DEFAULT '[]',
  "duration"           INTEGER,
  "startedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScrapeJobRecord_jobId_key" ON "ScrapeJobRecord"("jobId");
CREATE INDEX IF NOT EXISTS "ScrapeJobRecord_organizationId_idx" ON "ScrapeJobRecord"("organizationId");
CREATE INDEX IF NOT EXISTS "ScrapeJobRecord_status_idx" ON "ScrapeJobRecord"("status");
CREATE INDEX IF NOT EXISTS "ScrapeJobRecord_userId_idx" ON "ScrapeJobRecord"("userId");
CREATE INDEX IF NOT EXISTS "ScrapeJobRecord_createdAt_idx" ON "ScrapeJobRecord"("createdAt");

-- ============================================================================
-- ÉTAPE 3 : Clés étrangères (relations)
-- ============================================================================
DO $$
BEGIN
  -- Organization → User (owner)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Organization_ownerId_fkey') THEN
    ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT;
  END IF;

  -- Workspace → Organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Workspace_organizationId_fkey') THEN
    ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;

  -- Member → User, Organization, Workspace
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Member_userId_fkey') THEN
    ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Member_organizationId_fkey') THEN
    ALTER TABLE "Member" ADD CONSTRAINT "Member_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Member_workspaceId_fkey') THEN
    ALTER TABLE "Member" ADD CONSTRAINT "Member_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
  END IF;

  -- Account → User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;

  -- Session → User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;

  -- RefreshToken → User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefreshToken_userId_fkey') THEN
    ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;

  -- JwtBlacklist → User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JwtBlacklist_userId_fkey') THEN
    ALTER TABLE "JwtBlacklist" ADD CONSTRAINT "JwtBlacklist_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;

  -- ApiKey → User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_userId_fkey') THEN
    ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;

  -- License → Organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'License_organizationId_fkey') THEN
    ALTER TABLE "License" ADD CONSTRAINT "License_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
  END IF;

  -- Subscription → Organization, License
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_organizationId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_licenseId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_licenseId_fkey"
      FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE SET NULL;
  END IF;

  -- Invoice → Organization, Subscription
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_organizationId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_subscriptionId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL;
  END IF;

  -- QuotaUsage → Organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuotaUsage_organizationId_fkey') THEN
    ALTER TABLE "QuotaUsage" ADD CONSTRAINT "QuotaUsage_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
  END IF;

  -- AuditLog → User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;

  -- Company → Organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Company_organizationId_fkey') THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
  END IF;

  -- CompanyEmbedding → Company
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyEmbedding_companyId_fkey') THEN
    ALTER TABLE "CompanyEmbedding" ADD CONSTRAINT "CompanyEmbedding_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
  END IF;

  -- ScrapeJobRecord → Organization, User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScrapeJobRecord_organizationId_fkey') THEN
    ALTER TABLE "ScrapeJobRecord" ADD CONSTRAINT "ScrapeJobRecord_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScrapeJobRecord_userId_fkey') THEN
    ALTER TABLE "ScrapeJobRecord" ADD CONSTRAINT "ScrapeJobRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 4 : Créer le premier utilisateur OWNER
-- ============================================================================
-- ⚠️ REMPLACEZ les valeurs ci-dessous par les vôtres !

-- Pour générer le hash bcrypt de votre mot de passe, utilisez un générateur en ligne :
-- https://bcrypt-generator.com/
-- OU si vous avez Node.js : node -e "console.log(require('bcryptjs').hashSync('VOTRE_MDP', 10))"

-- Remplacez :
--   'admin@votre-domaine.ci'  → votre email (même que ADMIN_EMAIL sur Vercel)
--   '$2a$10$...'              → le hash bcrypt de votre mot de passe
--   'Votre Nom'               → votre nom d'affichage

INSERT INTO "User" ("id", "email", "name", "passwordHash", "locale", "timezone", "status", "createdAt", "updatedAt")
VALUES (
  'admin-owner-001',
  'admin@votre-domaine.ci',           -- ⚠️ REMPLACEZ par votre email
  'Admin Owner',                      -- ⚠️ REMPLACEZ par votre nom
  '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4W3pFqH8xLPm2TlqVbkXSmCQvB.',  -- ⚠️ REMPLACEZ par le hash de votre mot de passe (celui-ci = "password" — NE L'UTILISEZ PAS en prod)
  'fr',
  'Africa/Abidjan',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;

-- ============================================================================
-- ÉTAPE 5 : Créer l'organisation + workspace + membership
-- ============================================================================
INSERT INTO "Organization" ("id", "name", "slug", "plan", "ownerId", "settings", "createdAt", "updatedAt")
SELECT
  'org-admin-001',
  'Mon Organisation',
  'mon-organisation',
  'starter',
  "User"."id",
  '{}',
  NOW(),
  NOW()
FROM "User"
WHERE "User"."email" = 'admin@votre-domaine.ci'  -- ⚠️ MÊME EMAIL que ci-dessus
AND NOT EXISTS (SELECT 1 FROM "Organization" WHERE "slug" = 'mon-organisation');

INSERT INTO "Workspace" ("id", "name", "slug", "organizationId", "createdAt", "updatedAt")
SELECT
  'workspace-admin-001',
  'Workspace principal',
  'main',
  'org-admin-001',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Workspace" WHERE "slug" = 'main' AND "organizationId" = 'org-admin-001');

INSERT INTO "Member" ("id", "userId", "organizationId", "workspaceId", "role", "permissions", "status", "invitedAt", "acceptedAt")
SELECT
  'member-admin-001',
  "User"."id",
  'org-admin-001',
  'workspace-admin-001',
  'OWNER',
  '[]',
  'active',
  NOW(),
  NOW()
FROM "User"
WHERE "User"."email" = 'admin@votre-domaine.ci'  -- ⚠️ MÊME EMAIL
AND NOT EXISTS (SELECT 1 FROM "Member" WHERE "userId" = (SELECT "id" FROM "User" WHERE "email" = 'admin@votre-domaine.ci') AND "organizationId" = 'org-admin-001');

-- ============================================================================
-- ÉTAPE 6 : Créer une licence Starter + quota initial
-- ============================================================================
INSERT INTO "License" ("id", "key", "plan", "name", "maxUsers", "maxCompanies", "maxApiCalls", "maxExports", "maxSources", "maxWorkspaces", "features", "status", "activatedAt", "expiresAt", "organizationId", "createdAt", "updatedAt")
SELECT
  'license-admin-001',
  'SQCI-ADMIN-STARTER-2026',
  'starter',
  'Starter',
  5,
  5000,
  25000,
  30,
  3,
  1,
  '["basic_scraping", "export_csv", "export_xlsx"]',
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',
  'org-admin-001',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "License" WHERE "organizationId" = 'org-admin-001');

INSERT INTO "QuotaUsage" ("id", "organizationId", "periodYear", "periodMonth", "apiCalls", "companiesStored", "exportsCount", "scrapeJobs", "usersCount", "updatedAt")
SELECT
  'quota-admin-001',
  'org-admin-001',
  EXTRACT(YEAR FROM NOW())::INTEGER,
  EXTRACT(MONTH FROM NOW())::INTEGER,
  0,
  0,
  0,
  0,
  1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "QuotaUsage"
  WHERE "organizationId" = 'org-admin-001'
  AND "periodYear" = EXTRACT(YEAR FROM NOW())::INTEGER
  AND "periodMonth" = EXTRACT(MONTH FROM NOW())::INTEGER
);

-- ============================================================================
-- ✅ TERMINÉ !
-- ============================================================================
-- Vérifiez que tout est bien créé :
SELECT 'Tables créées' AS status, COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'Utilisateur admin' AS status, email, name FROM "User" WHERE email = 'admin@votre-domaine.ci';
SELECT 'Organisation' AS status, name, slug, plan FROM "Organization" WHERE slug = 'mon-organisation';

-- Maintenant :
-- 1. Vérifiez dans Supabase → Table Editor que vous voyez les 25 tables
-- 2. Connectez-vous sur votre URL Vercel avec votre email + mot de passe
-- 3. Vous serez connecté en tant que OWNER
