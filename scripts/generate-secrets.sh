#!/usr/bin/env bash
# =============================================================================
# ScrapIQ CI — Production secret generator
# =============================================================================
# Generates all cryptographic secrets required by .env.example and prints them
# in `KEY=value` format, ready to copy-paste into .env / .env.production.
#
# Usage:
#   bash scripts/generate-secrets.sh              # print secrets to stdout
#   bash scripts/generate-secrets.sh --write      # write a full .env.production
#                                                 # ( backs up the existing one )
#   bash scripts/generate-secrets.sh --check      # verify .env has no leftover
#                                                 # placeholders / weak secrets
#   bash scripts/generate-secrets.sh --help       # show this help
#
# Requirements: openssl(1), bash 4+, awk(1) (for --check length validation).
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# Colours (only emitted when stdout is a TTY — safe to pipe / redirect)
# -----------------------------------------------------------------------------
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; CYAN=''; BOLD=''; NC=''
fi

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

# gen_bytes <len> <fmt>
#   len  = number of random bytes
#   fmt  = "base64" (default) or "hex"
gen_bytes() {
  local len="${1:-32}"
  local fmt="${2:-base64}"
  if [ "$fmt" = "hex" ]; then
    openssl rand -hex "$len"
  else
    openssl rand -base64 "$len" | tr -d '\n'
  fi
}

# gen_aes_key — emits EXACTLY 32 bytes of UTF-8 (256-bit AES key).
# We need 32 chars (not 32 random bytes — base64 of 32 bytes is 44 chars).
# Solution: 24 random bytes → base64 (32 chars exactly) → strip newlines.
gen_aes_key() {
  openssl rand -base64 24 | tr -d '\n' | head -c 32
}

# -----------------------------------------------------------------------------
# Generate every secret required by .env.example
# -----------------------------------------------------------------------------
# --- JWT signing secrets ------------------------------------------------------
# jose HS256 requires ≥32 bytes of entropy. We use 48 bytes for the legacy
# single-secret (matching the previous generator's behaviour) and 32 bytes
# for the split access/refresh secrets (per the task spec).
JWT_SECRET="$(gen_bytes 48 base64)"
JWT_ACCESS_SECRET="$(gen_bytes 32 base64)"
JWT_REFRESH_SECRET="$(gen_bytes 32 base64)"

# --- AES-256-GCM encryption keys (MUST be exactly 32 bytes UTF-8) ------------
ENCRYPTION_KEY="$(gen_aes_key)"
TWOFACTOR_ENCRYPTION_KEY="$(gen_aes_key)"
SESSION_ENCRYPTION_KEY="$(gen_aes_key)"

# --- HMAC / hashing secrets ---------------------------------------------------
WEBHOOK_SIGNING_SECRET="$(gen_bytes 32 base64)"     # HMAC-SHA256 signing key
API_KEY_SALT="$(gen_bytes 16 hex)"                  # 32-char hex salt for sk_live_ hashing

# -----------------------------------------------------------------------------
# Mode: print secrets to stdout
# -----------------------------------------------------------------------------
print_secrets() {
  echo -e "${CYAN}${BOLD}=== ScrapIQ CI — secrets generated $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===${NC}"
  echo -e "${YELLOW}Copy the block below into .env (dev) or .env.production (prod).${NC}"
  echo -e "${YELLOW}Do NOT commit these values — they are unique to this invocation.${NC}"
  echo ""
  echo -e "${GREEN}# --- JWT signing secrets ---${NC}"
  echo "JWT_SECRET=${JWT_SECRET}"
  echo "JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}"
  echo "JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}"
  echo ""
  echo -e "${GREEN}# --- AES-256-GCM encryption keys (32-byte UTF-8) ---${NC}"
  echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}"
  echo "TWOFACTOR_ENCRYPTION_KEY=${TWOFACTOR_ENCRYPTION_KEY}"
  echo "SESSION_ENCRYPTION_KEY=${SESSION_ENCRYPTION_KEY}"
  echo ""
  echo -e "${GREEN}# --- HMAC / hashing secrets ---${NC}"
  echo "WEBHOOK_SIGNING_SECRET=${WEBHOOK_SIGNING_SECRET}"
  echo "API_KEY_SALT=${API_KEY_SALT}"
  echo ""
  echo -e "${CYAN}--- Variables to fill in manually (not generated) ---${NC}"
  echo -e "${YELLOW}# Database (PostgreSQL):${NC}"
  echo 'DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/scraapiq?schema=public"'
  echo -e "${YELLOW}# z-ai SDK:${NC}"
  echo "ZAI_API_KEY="
  echo -e "${YELLOW}# OAuth providers:${NC}"
  echo "GOOGLE_CLIENT_ID="
  echo "GOOGLE_CLIENT_SECRET="
  echo "MICROSOFT_CLIENT_ID="
  echo "MICROSOFT_CLIENT_SECRET="
  echo -e "${YELLOW}# Redis (pick one shape):${NC}"
  echo "REDIS_URL=redis://:password@host:6379"
  echo -e "${YELLOW}# Email / SMTP:${NC}"
  echo "SMTP_URL=smtp://USER:PASSWORD@smtp.provider.com:587"
  echo -e "${YELLOW}# Payments:${NC}"
  echo "STRIPE_SECRET_KEY="
  echo "STRIPE_WEBHOOK_SECRET="
  echo "ORANGE_MONEY_CLIENT_ID="
  echo "ORANGE_MONEY_CLIENT_SECRET="
  echo "ORANGE_MONEY_MERCHANT_KEY="
  echo "MTN_MOMO_SUBSCRIPTION_KEY="
  echo "MTN_MOMO_API_USER="
  echo "MTN_MOMO_API_KEY="
}

# -----------------------------------------------------------------------------
# Mode: write a full .env.production file (backing up any existing one)
# -----------------------------------------------------------------------------
write_env() {
  local target="${1:-.env.production}"
  if [ -f "$target" ]; then
    echo -e "${RED}⚠️  $target exists — backing up to $target.bak${NC}"
    cp "$target" "$target.bak"
  fi
  cat > "$target" <<EOF
# =============================================================================
# ScrapIQ CI — .env.production
# =============================================================================
# Generated by scripts/generate-secrets.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ⚠️  NEVER commit this file. Add .env.production to .gitignore.
# =============================================================================

# --- Application ---
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.scraapiq.ci
NEXT_PUBLIC_API_URL=https://app.scraapiq.ci/api
ALLOWED_ORIGINS=https://scraapiq.ci

# --- Database (PostgreSQL 16 + pgvector) — REPLACE ---
DATABASE_URL="postgresql://CHANGE_ME:CHANGE_ME@CHANGE_ME:5432/scraapiq?schema=public"
DIRECT_URL="postgresql://CHANGE_ME:CHANGE_ME@CHANGE_ME:5432/scraapiq?schema=public"

# --- JWT signing secrets (generated) ---
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ISSUER=scraapiq-ci
JWT_AUDIENCE=scraapiq-users

# --- AES-256-GCM encryption keys (generated, 32-byte UTF-8) ---
ENCRYPTION_KEY=${ENCRYPTION_KEY}
TWOFACTOR_ENCRYPTION_KEY=${TWOFACTOR_ENCRYPTION_KEY}
SESSION_ENCRYPTION_KEY=${SESSION_ENCRYPTION_KEY}

# --- HMAC / hashing secrets (generated) ---
WEBHOOK_SIGNING_SECRET=${WEBHOOK_SIGNING_SECRET}
API_KEY_SALT=${API_KEY_SALT}

# --- OAuth providers (fill in) ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OAUTH_GOOGLE_CALLBACK_URL=https://app.scraapiq.ci/api/oauth/google/callback
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
OAUTH_MICROSOFT_TENANT=common
OAUTH_MICROSOFT_CALLBACK_URL=https://app.scraapiq.ci/api/oauth/microsoft/callback

# --- AI (z-ai-web-dev-sdk) ---
ZAI_API_KEY=

# --- Redis / BullMQ ---
REDIS_URL=redis://:CHANGE_ME@CHANGE_ME:6379

# --- Email / SMTP ---
SMTP_URL=smtp://CHANGE_ME:CHANGE_ME@smtp.provider.com:587
FROM_EMAIL=noreply@scraapiq.ci
FROM_NAME=ScrapIQ CI

# --- Payments ---
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
ORANGE_MONEY_CLIENT_ID=
ORANGE_MONEY_CLIENT_SECRET=
ORANGE_MONEY_MERCHANT_KEY=
MTN_MOMO_SUBSCRIPTION_KEY=
MTN_MOMO_API_USER=
MTN_MOMO_API_KEY=

# --- Monitoring / observability ---
SENTRY_DSN=
LOG_LEVEL=info

# --- Scraping / Playwright ---
PLAYWRIGHT_NO_SANDBOX=true
SCRAPER_PROXY_POOL=
EOF
  echo -e "${GREEN}✓ $target created${NC}"
  echo -e "${YELLOW}Edit it now to fill in DATABASE_URL, ZAI_API_KEY, REDIS_URL, OAuth & payment credentials.${NC}"
}

# -----------------------------------------------------------------------------
# Mode: verify that an env file has no leftover placeholders / weak secrets
# -----------------------------------------------------------------------------
check_env() {
  local target="${1:-.env}"
  if [ ! -f "$target" ]; then
    echo -e "${RED}✗ $target not found${NC}"
    exit 1
  fi
  echo -e "${CYAN}Checking $target ...${NC}"
  local issues=0
  # Parse once into an associative array
  declare -A values
  local key value
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    # strip surrounding quotes
    value="${value#\"}"; value="${value%\"}"
    values["$key"]="$value"
  done < "$target"

  # Critical keys must be present AND non-empty AND not a placeholder
  local critical_keys=(
    JWT_SECRET ENCRYPTION_KEY TWOFACTOR_ENCRYPTION_KEY SESSION_ENCRYPTION_KEY
    WEBHOOK_SIGNING_SECRET API_KEY_SALT DATABASE_URL ZAI_API_KEY
  )
  for key in "${critical_keys[@]}"; do
    if [ -z "${values[$key]+x}" ]; then
      echo -e "${RED}✗ $key is MISSING${NC}"
      issues=$((issues + 1))
    elif [ -z "${values[$key]}" ]; then
      echo -e "${RED}✗ $key is EMPTY${NC}"
      issues=$((issues + 1))
    elif [[ "${values[$key]}" == *"<replace"* ]] \
      || [[ "${values[$key]}" == "CHANGE_ME" ]] \
      || [[ "${values[$key]}" == *"-change-in-prod"* ]] \
      || [[ "${values[$key]}" == *"dev-secret"* ]] \
      || [[ "${values[$key]}" == *"dev-key-change"* ]]; then
      echo -e "${RED}✗ $key still contains a placeholder: ${values[$key]}${NC}"
      issues=$((issues + 1))
    fi
  done

  # Length validations
  if [ -n "${values[JWT_SECRET]+x}" ] && [ ${#values[JWT_SECRET]} -lt 32 ]; then
    echo -e "${RED}✗ JWT_SECRET too short (${#values[JWT_SECRET]} chars, ≥32 required)${NC}"
    issues=$((issues + 1))
  fi
  for k in ENCRYPTION_KEY TWOFACTOR_ENCRYPTION_KEY SESSION_ENCRYPTION_KEY; do
    if [ -n "${values[$k]+x}" ] && [ "${values[$k]}" != "" ] && [ ${#values[$k]} -ne 32 ]; then
      echo -e "${RED}✗ $k must be exactly 32 chars (got ${#values[$k]})${NC}"
      issues=$((issues + 1))
    fi
  done

  if [ "$issues" -eq 0 ]; then
    echo -e "${GREEN}✓ All critical secrets are configured${NC}"
    exit 0
  else
    echo -e "${RED}✗ $issues issue(s) detected${NC}"
    exit 1
  fi
}

# -----------------------------------------------------------------------------
# Mode: help
# -----------------------------------------------------------------------------
print_help() {
  cat <<EOF
ScrapIQ CI — secret generator

Usage:
  bash scripts/generate-secrets.sh              Print generated secrets to stdout.
  bash scripts/generate-secrets.sh --write      Write a full .env.production file.
                                                (backs up any existing one to .bak)
  bash scripts/generate-secrets.sh --write PATH Write to PATH instead of .env.production.
  bash scripts/generate-secrets.sh --check      Verify .env has no placeholders.
  bash scripts/generate-secrets.sh --check PATH Verify PATH instead of .env.
  bash scripts/generate-secrets.sh --help       Show this help.

Generated secrets (8 total):
  JWT_SECRET                 48-byte base64 (jose HS256, ≥32-byte requirement)
  JWT_ACCESS_SECRET          32-byte base64 (forward-looking split-secret)
  JWT_REFRESH_SECRET         32-byte base64 (forward-looking split-secret)
  ENCRYPTION_KEY             32-byte UTF-8   (AES-256-GCM at-rest encryption)
  TWOFACTOR_ENCRYPTION_KEY   32-byte UTF-8   (TOTP secret + backup-code encryption)
  SESSION_ENCRYPTION_KEY     32-byte UTF-8   (session cookie encryption)
  WEBHOOK_SIGNING_SECRET     32-byte base64  (HMAC-SHA256 outbound webhook signing)
  API_KEY_SALT               32-char hex     (salt for hashing sk_live_ API keys)
EOF
}

# -----------------------------------------------------------------------------
# Dispatch
# -----------------------------------------------------------------------------
case "${1:-}" in
  --write)
    write_env "${2:-.env.production}"
    ;;
  --check)
    check_env "${2:-.env}"
    ;;
  --help|-h)
    print_help
    ;;
  "")
    print_secrets
    ;;
  *)
    echo -e "${RED}Unknown argument: $1${NC}" >&2
    print_help >&2
    exit 1
    ;;
esac
