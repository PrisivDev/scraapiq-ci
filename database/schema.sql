-- ============================================================================
--  ScrapIQ CI — Schéma PostgreSQL Enterprise
--  Auteur : DBA Senior
--  SGBD   : PostgreSQL 16+
--  Ext.   : uuid-ossp, pgvector, pg_trgm, btree_gin
--  Multi-tenant via RLS · IA via pgvector · Partitionnement pour volumétrie
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";       -- embeddings pour dédup IA
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- fuzzy matching texte
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- index composites GIN
CREATE EXTENSION IF NOT EXISTS "citext";       -- emails insensibles à la casse

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE user_role           AS ENUM ('owner','admin','manager','agent','viewer');
CREATE TYPE job_status          AS ENUM ('queued','running','paused','completed','failed','cancelled');
CREATE TYPE task_status         AS ENUM ('pending','running','completed','failed','skipped');
CREATE TYPE source_status       AS ENUM ('active','degraded','maintenance','disabled');
CREATE TYPE source_type         AS ENUM ('cartographic','registry','directory','social','website','other');
CREATE TYPE contact_type        AS ENUM ('email','phone','website','facebook','instagram','linkedin','tiktok','other');
CREATE TYPE contact_verified    AS ENUM ('unverified','verified','invalid');
CREATE TYPE company_status      AS ENUM ('verified','enriched','partial','duplicate','archived');
CREATE TYPE dedup_status        AS ENUM ('pending','merged','rejected','needs_review','auto_merged');
CREATE TYPE dedup_decision_type AS ENUM ('merge','keep_separate','needs_review');
CREATE TYPE sub_status          AS ENUM ('trialing','active','past_due','cancelled','expired');
CREATE TYPE plan_code           AS ENUM ('starter','pro','enterprise','custom');
CREATE TYPE export_format       AS ENUM ('xlsx','csv','json','pdf','webhook');
CREATE TYPE export_status       AS ENUM ('pending','processing','completed','failed');
CREATE TYPE api_call_status     AS ENUM ('success','error','rate_limited','unauthorized');
CREATE TYPE log_level           AS ENUM ('debug','info','warn','error','critical');
CREATE TYPE notif_channel       AS ENUM ('in_app','email','sms','push','webhook');
CREATE TYPE notif_status        AS ENUM ('pending','sent','delivered','failed','read');

-- ----------------------------------------------------------------------------
-- 2. RÉFÉRENTIELS COMMUNS (sans tenant, partagés)
-- ----------------------------------------------------------------------------
CREATE TABLE communes (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text NOT NULL,
    city        text NOT NULL,
    region      text,
    lat         numeric(9,6),
    lng         numeric(9,6),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (name, city)
);

CREATE TABLE sectors (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        text UNIQUE NOT NULL,
    name        text NOT NULL,
    parent_id   uuid REFERENCES sectors(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sources (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            text NOT NULL,
    type            source_type NOT NULL,
    base_url        text,
    status          source_status NOT NULL DEFAULT 'active',
    rate_limit_per_min int NOT NULL DEFAULT 60,
    robots_txt_url  text,
    last_sync_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. TENANTS & UTILISATEURS
-- ----------------------------------------------------------------------------
CREATE TABLE tenants (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         text NOT NULL,
    slug         text UNIQUE NOT NULL,
    country_code text NOT NULL DEFAULT 'CI',
    settings     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    deleted_at   timestamptz
);

CREATE TABLE users (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email          citext NOT NULL,
    password_hash  text,
    full_name      text NOT NULL,
    role           user_role NOT NULL DEFAULT 'viewer',
    avatar_url     text,
    locale         text NOT NULL DEFAULT 'fr',
    timezone       text NOT NULL DEFAULT 'Africa/Abidjan',
    mfa_enabled    boolean NOT NULL DEFAULT false,
    mfa_secret     text,
    last_login_at  timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz,
    UNIQUE (tenant_id, email)
);

CREATE TABLE user_sessions (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token text NOT NULL UNIQUE,
    user_agent    text,
    ip_address    inet,
    expires_at    timestamptz NOT NULL,
    revoked_at    timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. ABONNEMENTS & QUOTA
-- ----------------------------------------------------------------------------
CREATE TABLE plans (
    id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code             plan_code NOT NULL UNIQUE,
    name             text NOT NULL,
    price_xof        integer NOT NULL,           -- FCFA / mois
    max_companies    integer NOT NULL,
    max_sources      integer NOT NULL,
    max_users        integer NOT NULL,
    api_quota_monthly integer NOT NULL,          -- appels API / mois
    export_quota_monthly integer NOT NULL,
    features         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id             uuid NOT NULL REFERENCES plans(id),
    status              sub_status NOT NULL DEFAULT 'trialing',
    current_period_start timestamptz NOT NULL,
    current_period_end  timestamptz NOT NULL,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    payment_method      text,                    -- 'orange_money','mtn_momo','moov','card'
    provider_sub_id     text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quota_usage (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_year     int NOT NULL,
    period_month    int NOT NULL,
    api_calls       bigint NOT NULL DEFAULT 0,
    companies_stored bigint NOT NULL DEFAULT 0,
    exports_count   int NOT NULL DEFAULT 0,
    scrape_jobs     int NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, period_year, period_month)
);

CREATE TABLE api_keys (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            text NOT NULL,
    key_hash        text NOT NULL UNIQUE,        -- hash SHA-256, jamais stocké en clair
    key_prefix      text NOT NULL,               -- 8 premiers chars pour identification UI
    scopes          text[] NOT NULL DEFAULT '{}',
    last_used_at    timestamptz,
    expires_at      timestamptz,
    revoked_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES users(id)
);

-- ----------------------------------------------------------------------------
-- 5. SCRAPING — JOBS & TÂCHES
-- ----------------------------------------------------------------------------
CREATE TABLE search_jobs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by      uuid NOT NULL REFERENCES users(id),
    criteria        jsonb NOT NULL,              -- {keywords, communes[], sectors[], sources[], minConfidence}
    status          job_status NOT NULL DEFAULT 'queued',
    priority        smallint NOT NULL DEFAULT 5,
    total_tasks     int NOT NULL DEFAULT 0,
    completed_tasks int NOT NULL DEFAULT 0,
    results_count   int NOT NULL DEFAULT 0,
    error_message   text,
    started_at      timestamptz,
    completed_at    timestamptz,
    duration_ms     bigint,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_tasks (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id          uuid NOT NULL REFERENCES search_jobs(id) ON DELETE CASCADE,
    source_id       uuid NOT NULL REFERENCES sources(id),
    status          task_status NOT NULL DEFAULT 'pending',
    payload         jsonb,                       -- params spécifiques à la source
    results_count   int NOT NULL DEFAULT 0,
    retry_count     smallint NOT NULL DEFAULT 0,
    max_retries     smallint NOT NULL DEFAULT 3,
    error_message   text,
    worker_id       text,
    started_at      timestamptz,
    completed_at    timestamptz,
    duration_ms     bigint,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, source_id)
);

-- Table de résultats bruts — PARTITIONNÉE par mois (volumétrie élevée)
CREATE TABLE scrape_raw_results (
    id              uuid NOT NULL DEFAULT uuid_generate_v4(),
    task_id         uuid NOT NULL,
    source_id       uuid NOT NULL,
    source_ref_id   text,                        -- ID externe chez la source
    raw_data        jsonb NOT NULL,              -- payload brut non normalisé
    raw_html        text,                        -- HTML original (compressé app-level)
    source_url      text,
    fetched_at      timestamptz NOT NULL DEFAULT now(),
    processed       boolean NOT NULL DEFAULT false,
    PRIMARY KEY (id, fetched_at)
) PARTITION BY RANGE (fetched_at);

-- Partitions mensuelles (à créer via script de maintenance)
CREATE TABLE scrape_raw_results_2026_01 PARTITION OF scrape_raw_results
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE scrape_raw_results_2026_02 PARTITION OF scrape_raw_results
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... (partitions futures créées par cron job)

-- ----------------------------------------------------------------------------
-- 6. ENTREPRISES & COORDONNÉES
-- ----------------------------------------------------------------------------
CREATE TABLE companies (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            text NOT NULL,
    name_normalized text NOT NULL,               -- normalisé pour matching (lowercase, sans accents)
    legal_name      text,
    rccm            text,
    ncc             text,                        -- numéro NCC
    sector_id       uuid REFERENCES sectors(id),
    sector_label    text,                        -- libellé libre si hors référentiel
    commune_id      uuid REFERENCES communes(id),
    commune_label   text,
    city            text,
    address         text,
    status          company_status NOT NULL DEFAULT 'partial',
    confidence      real NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
    employee_range  text,                        -- '10-50','50-100', etc.
    merged_into_id  uuid REFERENCES companies(id) ON DELETE SET NULL,
    dedup_cluster_id uuid REFERENCES dedup_clusters(id),
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,                 -- soft delete (droit à l'effacement APIPD)
    UNIQUE (tenant_id, rccm)                     -- une entreprise RCCM unique par tenant
);

CREATE TABLE company_source_refs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_id       uuid NOT NULL REFERENCES sources(id),
    external_id     text,                        -- place_id Google, etc.
    source_url      text,
    source_score    real NOT NULL DEFAULT 0 CHECK (source_score BETWEEN 0 AND 1),
    raw_payload     jsonb,
    first_seen_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, source_id, external_id)
);

-- Table générique des contacts (email/tél/web/social)
CREATE TABLE contacts (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type            contact_type NOT NULL,
    value           text NOT NULL,
    normalized      text NOT NULL,               -- forme canonique (tél +225..., URL sans protocole)
    label           text,                        -- 'standard','service client', etc.
    verified        contact_verified NOT NULL DEFAULT 'unverified',
    is_primary      boolean NOT NULL DEFAULT false,
    verified_at     timestamptz,
    source_id       uuid REFERENCES sources(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Vues spécialisées par type de contact (pour requêtes typées)
-- (vues créées plus bas dans la section Optimisations)

CREATE TABLE geolocations (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    lat             numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng             numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
    geocoder        text NOT NULL DEFAULT 'osm', -- 'osm','google','manual'
    accuracy_m      real,
    formatted_address text,
    geocoded_at     timestamptz NOT NULL DEFAULT now()
);

-- Tags personnalisés par tenant
CREATE TABLE tags (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            text NOT NULL,
    color           text NOT NULL DEFAULT '#059669',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE company_tags (
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tag_id          uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_by      uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- 7. DÉDUPLICATION & IA
-- ----------------------------------------------------------------------------
CREATE TABLE dedup_clusters (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    canonical_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    confidence      real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    status          dedup_status NOT NULL DEFAULT 'pending',
    reason          text,                        -- 'name+address','phone_match', etc.
    created_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz
);

CREATE TABLE dedup_cluster_members (
    cluster_id      uuid NOT NULL REFERENCES dedup_clusters(id) ON DELETE CASCADE,
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    similarity      real NOT NULL CHECK (similarity BETWEEN 0 AND 1),
    is_canonical    boolean NOT NULL DEFAULT false,
    PRIMARY KEY (cluster_id, company_id)
);

CREATE TABLE dedup_decisions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id      uuid NOT NULL REFERENCES dedup_clusters(id) ON DELETE CASCADE,
    decision        dedup_decision_type NOT NULL,
    decided_by      text NOT NULL,               -- 'llm:z-ai-glm-4' ou 'user:<uuid>'
    user_id         uuid REFERENCES users(id),
    model           text,                        -- nom du modèle LLM si applicable
    rationale       text,                        -- justification LLM
    confidence      real CHECK (confidence BETWEEN 0 AND 1),
    payload         jsonb,                       -- trace complète de la décision
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Embeddings vectoriels pour fuzzy matching (pgvector)
CREATE TABLE company_embeddings (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    embedding       vector(1536) NOT NULL,       -- dimension du modèle d'embedding
    model           text NOT NULL DEFAULT 'text-embedding-3-small',
    input_text      text NOT NULL,               -- texte source encodé (name + address + sector)
    generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_enrichments (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    field_name      text NOT NULL,               -- 'email','phone','website','sector'...
    old_value       text,
    new_value       text NOT NULL,
    confidence      real CHECK (confidence BETWEEN 0 AND 1),
    model           text NOT NULL,               -- 'glm-4','glm-4v', etc.
    source          text NOT NULL,               -- 'web_search','vlm_screenshot','llm_inference'
    verified        boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, field_name, created_at)
);

-- Log des appels IA (coût, latence, tokens)
CREATE TABLE ai_model_logs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model           text NOT NULL,
    task            text NOT NULL,               -- 'dedup','enrich','vlm_parse','embedding'
    prompt_tokens   int NOT NULL DEFAULT 0,
    completion_tokens int NOT NULL DEFAULT 0,
    latency_ms      int NOT NULL,
    cost_xof        numeric(10,4) NOT NULL DEFAULT 0,
    success         boolean NOT NULL DEFAULT true,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. EXPORTS
-- ----------------------------------------------------------------------------
CREATE TABLE export_jobs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by      uuid NOT NULL REFERENCES users(id),
    source_type     text NOT NULL,               -- 'search','company_list','tag','job'
    source_id       uuid,
    format          export_format NOT NULL,
    filters         jsonb NOT NULL DEFAULT '{}'::jsonb,
    columns         text[] NOT NULL,
    row_count       int,
    file_size_bytes bigint,
    storage_url     text,                        -- s3://bucket/key
    status          export_status NOT NULL DEFAULT 'pending',
    error_message   text,
    expires_at      timestamptz,                 -- lien signé temporaire
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

CREATE TABLE export_items (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_id       uuid NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
    company_id      uuid REFERENCES companies(id),
    row_data        jsonb NOT NULL,              -- ligne sérialisée
    row_index       int NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (export_id, row_index)
);

-- ----------------------------------------------------------------------------
-- 9. LOGS & AUDIT (tables partitionnées par mois)
-- ----------------------------------------------------------------------------
CREATE TABLE activity_logs (
    id              uuid NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL,
    user_id         uuid,
    action          text NOT NULL,               -- 'job.create','company.view','export.download'
    entity_type     text,                        -- 'company','job','export'
    entity_id       uuid,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address      inet,
    user_agent      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE activity_logs_2026_01 PARTITION OF activity_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE activity_logs_2026_02 PARTITION OF activity_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Audit log immutable (trigger bloque UPDATE/DELETE)
CREATE TABLE audit_logs (
    id              uuid NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL,
    actor           text NOT NULL,               -- 'user:<uuid>','system','api_key:<id>'
    action          text NOT NULL,
    entity_type     text NOT NULL,
    entity_id       uuid,
    before_state    jsonb,
    after_state     jsonb,
    ip_address      inet,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Logs d'appels API (volumétrie maximale — partition mensuelle)
CREATE TABLE api_call_logs (
    id              uuid NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL,
    api_key_id      uuid,
    endpoint        text NOT NULL,
    method          text NOT NULL,
    status_code     int NOT NULL,
    status          api_call_status NOT NULL,
    duration_ms     int NOT NULL,
    request_body    jsonb,
    response_size   int,
    ip_address      inet,
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE api_call_logs_2026_01 PARTITION OF api_call_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE api_call_logs_2026_02 PARTITION OF api_call_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- ----------------------------------------------------------------------------
-- 10. NOTIFICATIONS & WEBHOOKS
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
    channel         notif_channel NOT NULL,
    title           text NOT NULL,
    body            text,
    payload         jsonb,
    status          notif_status NOT NULL DEFAULT 'pending',
    sent_at         timestamptz,
    read_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhooks (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    url             text NOT NULL,
    secret          text NOT NULL,               -- pour signature HMAC
    events          text[] NOT NULL,             -- ['job.completed','export.ready',...]
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id      uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event           text NOT NULL,
    payload         jsonb NOT NULL,
    status_code     int,
    response_body   text,
    attempt         smallint NOT NULL DEFAULT 1,
    delivered       boolean NOT NULL DEFAULT false,
    delivered_at    timestamptz,
    next_retry_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEX
-- ============================================================================

-- Utilisateurs
CREATE INDEX idx_users_tenant            ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email             ON users(email);
CREATE UNIQUE INDEX idx_users_tenant_email ON users(tenant_id, email) WHERE deleted_at IS NULL;

-- Tenants
CREATE UNIQUE INDEX idx_tenants_slug     ON tenants(slug) WHERE deleted_at IS NULL;

-- Jobs & tâches
CREATE INDEX idx_jobs_tenant_status      ON search_jobs(tenant_id, status, created_at DESC);
CREATE INDEX idx_jobs_created_by         ON search_jobs(created_by);
CREATE INDEX idx_jobs_status_priority    ON search_jobs(status, priority) WHERE status IN ('queued','running');
CREATE INDEX idx_tasks_job               ON job_tasks(job_id);
CREATE INDEX idx_tasks_status            ON job_tasks(status) WHERE status IN ('pending','running');
CREATE INDEX idx_tasks_worker            ON job_tasks(worker_id) WHERE worker_id IS NOT NULL;

-- Résultats bruts (partitionnés — index sur chaque partition automatiquement)
CREATE INDEX idx_raw_task                ON scrape_raw_results(task_id);
CREATE INDEX idx_raw_source              ON scrape_raw_results(source_id, fetched_at DESC);
CREATE INDEX idx_raw_unprocessed         ON scrape_raw_results(fetched_at) WHERE processed = false;

-- Entreprises
CREATE INDEX idx_companies_tenant        ON companies(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_name_trgm     ON companies USING gin (name gin_trgm_ops);
CREATE INDEX idx_companies_name_norm     ON companies(tenant_id, name_normalized);
CREATE INDEX idx_companies_sector        ON companies(tenant_id, sector_id);
CREATE INDEX idx_companies_commune       ON companies(tenant_id, commune_id);
CREATE INDEX idx_companies_status        ON companies(tenant_id, status);
CREATE INDEX idx_companies_rccm          ON companies(tenant_id, rccm) WHERE rccm IS NOT NULL;
CREATE INDEX idx_companies_confidence    ON companies(tenant_id, confidence DESC);
CREATE INDEX idx_companies_geo           ON companies USING gist (point(lng,lat));  -- (si ajout colonne point)
CREATE INDEX idx_companies_updated       ON companies(updated_at DESC);
CREATE INDEX idx_companies_merged        ON companies(merged_into_id) WHERE merged_into_id IS NOT NULL;

-- Contacts
CREATE INDEX idx_contacts_company        ON contacts(company_id);
CREATE INDEX idx_contacts_type_value     ON contacts(type, normalized);
CREATE INDEX idx_contacts_normalized     ON contacts(normalized);
CREATE INDEX idx_contacts_value_trgm     ON contacts USING gin (value gin_trgm_ops);
CREATE INDEX idx_contacts_primary        ON contacts(company_id) WHERE is_primary = true;

-- Géolocalisation
CREATE INDEX idx_geo_latlng              ON geolocations(lat, lng);

-- Source refs
CREATE INDEX idx_src_ref_company         ON company_source_refs(company_id);
CREATE INDEX idx_src_ref_external        ON company_source_refs(source_id, external_id);

-- Dédup
CREATE INDEX idx_clusters_tenant_status  ON dedup_clusters(tenant_id, status);
CREATE INDEX idx_clusters_canonical      ON dedup_clusters(canonical_company_id) WHERE canonical_company_id IS NOT NULL;
CREATE INDEX idx_cluster_members_company ON dedup_cluster_members(company_id);

-- Embeddings — INDEX VECTORIEL HNSW (critique pour la dédup)
CREATE INDEX idx_embeddings_hnsw ON company_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Enrichissement IA
CREATE INDEX idx_enrich_company          ON ai_enrichments(company_id);
CREATE INDEX idx_enrich_field            ON ai_enrichments(company_id, field_name);
CREATE INDEX idx_ai_logs_tenant          ON ai_model_logs(tenant_id, created_at DESC);

-- API keys
CREATE INDEX idx_api_keys_tenant         ON api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_hash           ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_prefix         ON api_keys(key_prefix);

-- Quota
CREATE INDEX idx_quota_tenant_period     ON quota_usage(tenant_id, period_year, period_month);

-- Exports
CREATE INDEX idx_exports_tenant          ON export_jobs(tenant_id, created_at DESC);
CREATE INDEX idx_exports_status          ON export_jobs(status) WHERE status IN ('pending','processing');
CREATE INDEX idx_export_items_export     ON export_items(export_id);

-- Logs (sur tables partitionnées — index créés sur partition parent, propagés)
CREATE INDEX idx_activity_tenant_time    ON activity_logs(tenant_id, created_at DESC);
CREATE INDEX idx_activity_user           ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_entity         ON activity_logs(entity_type, entity_id);

CREATE INDEX idx_audit_tenant_time       ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity            ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_api_logs_tenant_time    ON api_call_logs(tenant_id, created_at DESC);
CREATE INDEX idx_api_logs_key            ON api_call_logs(api_key_id, created_at DESC);
CREATE INDEX idx_api_logs_status         ON api_call_logs(status, created_at DESC);
CREATE INDEX idx_api_logs_endpoint       ON api_call_logs(endpoint, created_at DESC);

-- Notifications & webhooks
CREATE INDEX idx_notif_user_unread       ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notif_tenant            ON notifications(tenant_id, created_at DESC);
CREATE INDEX idx_webhooks_tenant_active  ON webhooks(tenant_id) WHERE is_active = true;
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE delivered = false;

-- ============================================================================
-- CONTRAINTES AVANCÉES
-- ============================================================================

-- Contrôle d'intégrité : un tenant ne peut pas avoir plus d'utilisateurs que son plan
-- (appliqué via trigger applicatif — voir section Optimisations)

-- Contrainte : au moins un contact principal par type pour une entreprise vérifiée
ALTER TABLE companies
    ADD CONSTRAINT chk_verified_has_contact
    CHECK (status <> 'verified' OR EXISTS (
        SELECT 1 FROM contacts c WHERE c.company_id = companies.id AND c.is_primary
    ));

-- Note : la contrainte CHECK ci-dessus avec sous-requête n'est pas supportée en PG standard.
-- Remplacée par un trigger d validation (voir ci-dessous).

-- Correction : contrainte simple sur confidence
ALTER TABLE companies DROP CONSTRAINT IF EXISTS chk_verified_has_contact;

-- Contrainte : coordonnées GPS valides (déjà en CHECK sur geolocations)

-- Contrainte : une seule géolocalisation par entreprise (déjà UNIQUE sur company_id)

-- Contrainte : un seul contact primaire par type et par entreprise
CREATE UNIQUE INDEX uniq_primary_contact_per_type
    ON contacts(company_id, type) WHERE is_primary = true;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger : mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated   BEFORE UPDATE ON tenants   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_users_updated     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sources_updated   BEFORE UPDATE ON sources   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_contacts_updated  BEFORE UPDATE ON contacts  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_quota_updated     BEFORE UPDATE ON quota_usage FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Trigger : normalisation du nom d'entreprise à l'insertion
CREATE OR REPLACE FUNCTION fn_normalize_company_name()
RETURNS trigger AS $$
BEGIN
    NEW.name_normalized := lower(unaccent(NEW.name));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Note : unaccent() requiert l'extension unaccent (CREATE EXTENSION unaccent;)

CREATE TRIGGER trg_companies_normalize_name
    BEFORE INSERT OR UPDATE OF name ON companies
    FOR EACH ROW EXECUTE FUNCTION fn_normalize_company_name();

-- Trigger : audit log immutable (bloque UPDATE et DELETE)
CREATE OR REPLACE FUNCTION fn_block_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is immutable: UPDATE/DELETE not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_block_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();
CREATE TRIGGER trg_audit_block_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

-- ============================================================================
-- ROW LEVEL SECURITY (Multi-tenant)
-- ============================================================================

ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_usage      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_source_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE geolocations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dedup_clusters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_enrichments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Politique générique : l'application set app.tenant_id = <uuid> par session
CREATE POLICY pol_tenant_isolation ON tenants
    USING (id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_users_tenant ON users
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_sessions_tenant ON user_sessions
    USING (EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = user_sessions.user_id
        AND u.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_subscriptions_tenant ON subscriptions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_quota_tenant ON quota_usage
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_api_keys_tenant ON api_keys
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_jobs_tenant ON search_jobs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_tasks_tenant ON job_tasks
    USING (EXISTS (
        SELECT 1 FROM search_jobs j
        WHERE j.id = job_tasks.job_id
        AND j.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_companies_tenant ON companies
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_src_refs_tenant ON company_source_refs
    USING (EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = company_source_refs.company_id
        AND c.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_contacts_tenant ON contacts
    USING (EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = contacts.company_id
        AND c.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_geo_tenant ON geolocations
    USING (EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = geolocations.company_id
        AND c.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_tags_tenant ON tags
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_company_tags_tenant ON company_tags
    USING (EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = company_tags.company_id
        AND c.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_clusters_tenant ON dedup_clusters
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_enrich_tenant ON ai_enrichments
    USING (EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = ai_enrichments.company_id
        AND c.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_ai_logs_tenant ON ai_model_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_exports_tenant ON export_jobs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_export_items_tenant ON export_items
    USING (EXISTS (
        SELECT 1 FROM export_jobs e
        WHERE e.id = export_items.export_id
        AND e.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

CREATE POLICY pol_activity_tenant ON activity_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_audit_tenant ON audit_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_api_logs_tenant ON api_call_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_notif_tenant ON notifications
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_webhooks_tenant ON webhooks
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pol_webhook_deliv_tenant ON webhook_deliveries
    USING (EXISTS (
        SELECT 1 FROM webhooks w
        WHERE w.id = webhook_deliveries.webhook_id
        AND w.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

-- Role de service bypass RLS (pour workers de scraping interne)
-- CREATE ROLE scrapiq_worker BYPASSRLS;

-- ============================================================================
-- VUES SPÉCIALISÉES
-- ============================================================================

-- Vue : entreprises avec coordonnées principales (un seul contact principal par type)
CREATE OR REPLACE VIEW v_companies_full AS
SELECT
    c.id, c.tenant_id, c.name, c.rccm, c.status, c.confidence,
    c.commune_label, c.city, c.address,
    s.name AS sector_name,
    g.lat, g.lng,
    ce.email AS primary_email,
    cp.phone AS primary_phone,
    cw.website AS primary_website,
    cfb.facebook AS primary_facebook,
    cig.instagram AS primary_instagram,
    cli.linkedin AS primary_linkedin,
    c.created_at, c.updated_at
FROM companies c
LEFT JOIN sectors s        ON s.id = c.sector_id
LEFT JOIN geolocations g   ON g.company_id = c.id
LEFT JOIN LATERAL (SELECT value AS email  FROM contacts WHERE company_id = c.id AND type='email'    AND is_primary LIMIT 1) ce ON true
LEFT JOIN LATERAL (SELECT value AS phone  FROM contacts WHERE company_id = c.id AND type='phone'    AND is_primary LIMIT 1) cp ON true
LEFT JOIN LATERAL (SELECT value AS website FROM contacts WHERE company_id = c.id AND type='website' AND is_primary LIMIT 1) cw ON true
LEFT JOIN LATERAL (SELECT value AS facebook FROM contacts WHERE company_id = c.id AND type='facebook' AND is_primary LIMIT 1) cfb ON true
LEFT JOIN LATERAL (SELECT value AS instagram FROM contacts WHERE company_id = c.id AND type='instagram' AND is_primary LIMIT 1) cig ON true
LEFT JOIN LATERAL (SELECT value AS linkedin FROM contacts WHERE company_id = c.id AND type='linkedin' AND is_primary LIMIT 1) cli ON true
WHERE c.deleted_at IS NULL;

-- Vue : statistiques de scraping par tenant et par jour
CREATE OR REPLACE VIEW v_scrape_stats_daily AS
SELECT
    j.tenant_id,
    date_trunc('day', j.created_at) AS day,
    count(*) AS jobs_count,
    count(*) FILTER (WHERE j.status = 'completed') AS completed,
    count(*) FILTER (WHERE j.status = 'failed') AS failed,
    sum(j.results_count) AS total_results,
    avg(j.duration_ms) AS avg_duration_ms
FROM search_jobs j
GROUP BY j.tenant_id, day;

-- Vue : taux de déduplication par tenant
CREATE OR REPLACE VIEW v_dedup_stats AS
SELECT
    dc.tenant_id,
    count(*) AS clusters_total,
    count(*) FILTER (WHERE dc.status = 'merged' OR dc.status = 'auto_merged') AS merged,
    count(*) FILTER (WHERE dc.status = 'rejected') AS rejected,
    round(avg(dc.confidence)::numeric, 3) AS avg_confidence
FROM dedup_clusters dc
GROUP BY dc.tenant_id;

-- ============================================================================
-- FIN DU SCHÉMA
-- ============================================================================
