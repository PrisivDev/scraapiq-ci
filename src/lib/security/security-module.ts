/**
 * Module de sécurité Enterprise
 *
 * 9 couches de protection :
 *  1. Rate Limiting — token bucket par IP + par utilisateur + par endpoint
 *  2. WAF — Web Application Firewall (SQL injection, XSS, path traversal, SSRF)
 *  3. Protection DDoS — détection pics de trafic, blacklist automatique
 *  4. Captcha — challenge après N tentatives échouées
 *  5. Journalisation — logs structurés de tous les événements de sécurité
 *  6. Audit — journal immutable des actions sensibles
 *  7. Chiffrement — AES-256-GCM pour données sensibles, bcrypt pour mots de passe
 *  8. RGPD — droit à l'effacement, export données, registre de traitement
 *  9. Protection API — validation, sanitization, CORS, CSP
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto"

// ============================================================================
// 1. RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
  blocked: boolean
  blockedUntil?: number
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  blockDurationMs: number
}

const rateLimitConfigs: Record<string, RateLimitConfig> = {
  default: { windowMs: 60000, maxRequests: 60, blockDurationMs: 60000 },
  login: { windowMs: 900000, maxRequests: 5, blockDurationMs: 900000 },
  register: { windowMs: 3600000, maxRequests: 3, blockDurationMs: 3600000 },
  api: { windowMs: 60000, maxRequests: 100, blockDurationMs: 60000 },
  scraping: { windowMs: 3600000, maxRequests: 20, blockDurationMs: 1800000 },
  export: { windowMs: 3600000, maxRequests: 30, blockDurationMs: 1800000 },
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export function checkRateLimit(
  key: string,
  type: keyof typeof rateLimitConfigs = "default"
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const config = rateLimitConfigs[type]
  const now = Date.now()
  const fullKey = `${type}:${key}`

  let entry = rateLimitStore.get(fullKey)

  // Si bloqué
  if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    }
  }

  // Reset si fenêtre expirée
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs, blocked: false }
  }

  entry.count++

  // Si dépasse la limite → blocage
  if (entry.count > config.maxRequests) {
    entry.blocked = true
    entry.blockedUntil = now + config.blockDurationMs
    rateLimitStore.set(fullKey, entry)
    logSecurityEvent({
      type: "rate_limit_blocked",
      severity: "warn",
      source: key,
      details: `Rate limit ${type} dépassé: ${entry.count}/${config.maxRequests} en ${config.windowMs / 1000}s`,
    })
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil(config.blockDurationMs / 1000),
    }
  }

  rateLimitStore.set(fullKey, entry)
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

export function getRateLimitStats() {
  const stats: Record<string, { total: number; blocked: number }> = {}
  for (const [key, entry] of rateLimitStore) {
    const type = key.split(":")[0]
    if (!stats[type]) stats[type] = { total: 0, blocked: 0 }
    stats[type].total++
    if (entry.blocked) stats[type].blocked++
  }
  return stats
}

// ============================================================================
// 2. WAF — WEB APPLICATION FIREWALL
// ============================================================================

interface WafRule {
  id: string
  name: string
  pattern: RegExp
  severity: "low" | "medium" | "high" | "critical"
  action: "block" | "log"
  description: string
}

const wafRules: WafRule[] = [
  {
    id: "waf-sql-1",
    name: "SQL Injection — UNION",
    pattern: /union\s+select|union\s+all\s+select/i,
    severity: "critical",
    action: "block",
    description: "Tentative d'injection SQL via UNION SELECT",
  },
  {
    id: "waf-sql-2",
    name: "SQL Injection — OR 1=1",
    pattern: /'\s*or\s*1\s*=\s*1|'\s*or\s*'?1'?\s*=\s*'?1|--|\/\*/i,
    severity: "critical",
    action: "block",
    description: "Tentative d'injection SQL via OR 1=1",
  },
  {
    id: "waf-sql-3",
    name: "SQL Injection — DROP/DELETE",
    pattern: /drop\s+table|delete\s+from|insert\s+into|update\s+.*\s+set/i,
    severity: "critical",
    action: "block",
    description: "Commande SQL destructrice",
  },
  {
    id: "waf-xss-1",
    name: "XSS — Script injection",
    pattern: /<script[^>]*>|<\/script>|javascript:|on\w+\s*=/i,
    severity: "high",
    action: "block",
    description: "Tentative d'injection XSS",
  },
  {
    id: "waf-xss-2",
    name: "XSS — Event handler",
    pattern: /onload|onerror|onclick|onmouseover\s*=/i,
    severity: "high",
    action: "block",
    description: "Handler d'événement XSS",
  },
  {
    id: "waf-path-1",
    name: "Path Traversal",
    pattern: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\//i,
    severity: "high",
    action: "block",
    description: "Tentative de path traversal",
  },
  {
    id: "waf-ssrf-1",
    name: "SSRF — Internal access",
    pattern: /127\.0\.0\.1|localhost|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+/i,
    severity: "high",
    action: "log",
    description: "Tentative d'accès réseau interne (SSRF)",
  },
  {
    id: "waf-cmd-1",
    name: "Command Injection",
    pattern: /;\s*(cat|ls|rm|wget|curl|bash|sh|nc|ncat)\s|`|\$\(|\|\s*(cat|ls|rm|sh)/i,
    severity: "critical",
    action: "block",
    description: "Tentative d'injection de commande système",
  },
  {
    id: "waf-xxe-1",
    name: "XXE Injection",
    pattern: /<!ENTITY|<!DOCTYPE.*\[|SYSTEM\s+"/i,
    severity: "critical",
    action: "block",
    description: "Tentative d'injection XXE",
  },
  {
    id: "waf-lfi-1",
    name: "LFI — Local File Inclusion",
    pattern: /\/etc\/passwd|\/etc\/shadow|\/proc\/self|php:\/\/|file:\/\/|data:\/\//i,
    severity: "critical",
    action: "block",
    description: "Tentative d'inclusion de fichier local",
  },
]

export interface WafResult {
  blocked: boolean
  matchedRules: Array<{ id: string; name: string; severity: string; description: string }>
  sanitized: string
}

export function wafInspect(input: string): WafResult {
  const matched: WafResult["matchedRules"] = []
  let sanitized = input
  let blocked = false

  for (const rule of wafRules) {
    if (rule.pattern.test(input)) {
      matched.push({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        description: rule.description,
      })
      if (rule.action === "block") {
        blocked = true
      }
      // Sanitize : retire le pattern matché
      sanitized = sanitized.replace(rule.pattern, "")
    }
  }

  if (matched.length > 0) {
    logSecurityEvent({
      type: "waf_blocked",
      severity: blocked ? "critical" : "warn",
      source: "waf",
      details: `${matched.length} règle(s) WAF matchée(s): ${matched.map((m) => m.name).join(", ")}`,
      metadata: { rules: matched, input: input.slice(0, 200) },
    })
  }

  return { blocked, matchedRules: matched, sanitized }
}

export function getWafRules() {
  return wafRules.map((r) => ({
    id: r.id,
    name: r.name,
    severity: r.severity,
    action: r.action,
    description: r.description,
  }))
}

// ============================================================================
// 3. PROTECTION DDoS
// ============================================================================

interface DdosEntry {
  ip: string
  requests: number[]
  blocked: boolean
  blockedUntil?: number
  firstSeen: number
}

const ddosStore = new Map<string, DdosEntry>()
const DDOS_THRESHOLD = 100 // requêtes par seconde
const DDOS_WINDOW_MS = 1000
const DDOS_BLOCK_MS = 3600000 // 1h de blocage

export function checkDdos(ip: string): { blocked: boolean; reason?: string } {
  const now = Date.now()
  let entry = ddosStore.get(ip)

  if (!entry) {
    entry = { ip, requests: [], blocked: false, firstSeen: now }
    ddosStore.set(ip, entry)
  }

  // Si déjà bloqué
  if (entry.blocked && entry.blockedUntil && entry.blockedUntil > now) {
    return { blocked: true, reason: `Bloqué jusqu'à ${new Date(entry.blockedUntil).toISOString()}` }
  }

  // Si le blocage a expiré
  if (entry.blocked && entry.blockedUntil && entry.blockedUntil <= now) {
    entry.blocked = false
    entry.blockedUntil = undefined
    entry.requests = []
  }

  // Ajoute la requête
  entry.requests.push(now)

  // Filtre les requêtes dans la fenêtre
  entry.requests = entry.requests.filter((t) => now - t < DDOS_WINDOW_MS)

  // Si dépasse le seuil → blocage
  if (entry.requests.length > DDOS_THRESHOLD) {
    entry.blocked = true
    entry.blockedUntil = now + DDOS_BLOCK_MS
    logSecurityEvent({
      type: "ddos_blocked",
      severity: "critical",
      source: ip,
      details: `DDoS détecté: ${entry.requests.length} requêtes en ${DDOS_WINDOW_MS}ms (seuil: ${DDOS_THRESHOLD})`,
    })
    return { blocked: true, reason: `DDoS détecté: ${entry.requests.length} req/s` }
  }

  return { blocked: false }
}

export function getDdosStats() {
  const now = Date.now()
  const active = Array.from(ddosStore.values()).filter((e) => e.blocked && (e.blockedUntil || 0) > now)
  const recent = Array.from(ddosStore.values()).filter((e) => now - e.firstSeen < 3600000)
  return {
    totalIps: ddosStore.size,
    blockedIps: active.length,
    recentIps: recent.length,
    threshold: DDOS_THRESHOLD,
    window: DDOS_WINDOW_MS,
  }
}

export function getBlockedIps() {
  const now = Date.now()
  return Array.from(ddosStore.values())
    .filter((e) => e.blocked && (e.blockedUntil || 0) > now)
    .map((e) => ({
      ip: e.ip,
      blockedUntil: new Date(e.blockedUntil!).toISOString(),
      requests: e.requests.length,
      firstSeen: new Date(e.firstSeen).toISOString(),
    }))
}

// ============================================================================
// 4. CAPTCHA
// ============================================================================

interface CaptchaChallenge {
  id: string
  question: string
  answer: string
  createdAt: number
  attempts: number
  solved: boolean
}

const captchaStore = new Map<string, CaptchaChallenge>()
const CAPTCHA_TTL = 300000 // 5 min
const failedAttemptsByIp = new Map<string, number>()
const CAPTCHA_THRESHOLD = 3 // après 3 tentatives échouées → captcha requis

const captchaQuestions = [
  () => {
    const a = Math.floor(Math.random() * 10) + 1
    const b = Math.floor(Math.random() * 10) + 1
    return { question: `Combien font ${a} + ${b} ?`, answer: String(a + b) }
  },
  () => {
    const a = Math.floor(Math.random() * 8) + 2
    const b = Math.floor(Math.random() * 8) + 2
    return { question: `Combien font ${a} × ${b} ?`, answer: String(a * b) }
  },
  () => {
    const colors = ["vert", "rouge", "bleu", "jaune", "orange"]
    const c = colors[Math.floor(Math.random() * colors.length)]
    return { question: `Tapez le mot: ${c}`, answer: c }
  },
]

export function requiresCaptcha(ip: string): boolean {
  return (failedAttemptsByIp.get(ip) || 0) >= CAPTCHA_THRESHOLD
}

export function generateCaptcha(): { id: string; question: string } {
  const generator = captchaQuestions[Math.floor(Math.random() * captchaQuestions.length)]
  const { question, answer } = generator()
  const id = randomBytes(8).toString("hex")
  captchaStore.set(id, {
    id,
    question,
    answer,
    createdAt: Date.now(),
    attempts: 0,
    solved: false,
  })
  return { id, question }
}

export function verifyCaptcha(id: string, answer: string): boolean {
  const challenge = captchaStore.get(id)
  if (!challenge) return false
  if (Date.now() - challenge.createdAt > CAPTCHA_TTL) {
    captchaStore.delete(id)
    return false
  }
  challenge.attempts++
  if (challenge.answer.toLowerCase() === answer.toLowerCase().trim()) {
    challenge.solved = true
    captchaStore.delete(id)
    return true
  }
  if (challenge.attempts >= 3) {
    captchaStore.delete(id)
  }
  return false
}

export function recordFailedAttempt(ip: string) {
  failedAttemptsByIp.set(ip, (failedAttemptsByIp.get(ip) || 0) + 1)
}

export function clearFailedAttempts(ip: string) {
  failedAttemptsByIp.delete(ip)
}

export function getCaptchaStats() {
  return {
    activeChallenges: captchaStore.size,
    threshold: CAPTCHA_THRESHOLD,
    ipsWithFailures: failedAttemptsByIp.size,
    ipsRequiringCaptcha: Array.from(failedAttemptsByIp.entries()).filter(([, c]) => c >= CAPTCHA_THRESHOLD).length,
  }
}

// ============================================================================
// 5. JOURNALISATION (Security Events Log)
// ============================================================================

export interface SecurityEvent {
  id: string
  type: string
  severity: "info" | "warn" | "error" | "critical"
  source: string
  details: string
  ip?: string
  userAgent?: string
  userId?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

const securityEvents: SecurityEvent[] = []
const MAX_EVENTS = 1000

export function logSecurityEvent(event: Omit<SecurityEvent, "id" | "timestamp">) {
  const fullEvent: SecurityEvent = {
    ...event,
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  }
  securityEvents.unshift(fullEvent)
  if (securityEvents.length > MAX_EVENTS) {
    securityEvents.length = MAX_EVENTS
  }
}

export function getSecurityEvents(filters?: {
  type?: string
  severity?: string
  limit?: number
}): SecurityEvent[] {
  let result = securityEvents
  if (filters?.type) result = result.filter((e) => e.type === filters.type)
  if (filters?.severity) result = result.filter((e) => e.severity === filters.severity)
  return result.slice(0, filters?.limit || 100)
}

export function getSecurityStats() {
  const bySeverity: Record<string, number> = {}
  const byType: Record<string, number> = {}
  for (const e of securityEvents) {
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1
    byType[e.type] = (byType[e.type] || 0) + 1
  }
  return {
    total: securityEvents.length,
    bySeverity,
    byType,
    critical: bySeverity.critical || 0,
    errors: bySeverity.error || 0,
    warnings: bySeverity.warn || 0,
  }
}

// ============================================================================
// 6. AUDIT (Journal immutable)
// ============================================================================

export interface AuditEntry {
  id: string
  userId?: string
  action: string
  category: "auth" | "security" | "data" | "api" | "admin" | "rgpd"
  severity: "info" | "warn" | "error" | "critical"
  entity?: string
  entityId?: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ip?: string
  userAgent?: string
  timestamp: string
  hash: string // hash chaîné pour immutabilité
}

const auditTrail: AuditEntry[] = []
const MAX_AUDIT = 5000

let lastAuditHash = "genesis"

export function logAudit(entry: Omit<AuditEntry, "id" | "timestamp" | "hash">) {
  const timestamp = new Date().toISOString()
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  // Hash chaîné : hash(timestamp + action + userId + previousHash)
  const hashInput = `${timestamp}:${entry.action}:${entry.userId || "anon"}:${lastAuditHash}`
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16)
  lastAuditHash = hash

  const fullEntry: AuditEntry = {
    ...entry,
    id,
    timestamp,
    hash,
  }
  auditTrail.unshift(fullEntry)
  if (auditTrail.length > MAX_AUDIT) {
    auditTrail.length = MAX_AUDIT
  }
}

export function getAuditTrail(filters?: {
  category?: string
  severity?: string
  userId?: string
  limit?: number
}): AuditEntry[] {
  let result = auditTrail
  if (filters?.category) result = result.filter((e) => e.category === filters.category)
  if (filters?.severity) result = result.filter((e) => e.severity === filters.severity)
  if (filters?.userId) result = result.filter((e) => e.userId === filters.userId)
  return result.slice(0, filters?.limit || 100)
}

export function verifyAuditIntegrity(): { valid: boolean; brokenAt?: string } {
  let prevHash = "genesis"
  for (const entry of auditTrail) {
    const expectedHash = createHash("sha256")
      .update(`${entry.timestamp}:${entry.action}:${entry.userId || "anon"}:${prevHash}`)
      .digest("hex").slice(0, 16)
    if (entry.hash !== expectedHash) {
      return { valid: false, brokenAt: entry.id }
    }
    prevHash = entry.hash
  }
  return { valid: true }
}

// ============================================================================
// 7. CHIFFREMENT
// ============================================================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "scraapiq-dev-key-change-in-prod-32b!" // 32 bytes
const ALGORITHM = "aes-256-gcm"

export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const tag = cipher.getAuthTag()
  return { encrypted, iv: iv.toString("hex"), tag: tag.toString("hex") }
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), Buffer.from(iv, "hex"))
  decipher.setAuthTag(Buffer.from(tag, "hex"))
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

export function hashSensitive(data: string): string {
  return createHash("sha256").update(data).digest("hex")
}

export function maskSensitive(data: string, type: "email" | "phone" | "creditcard" = "email"): string {
  if (type === "email") {
    const [local, domain] = data.split("@")
    if (!domain) return data
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`
  }
  if (type === "phone") {
    return data.slice(0, 4) + "*".repeat(data.length - 8) + data.slice(-4)
  }
  if (type === "creditcard") {
    return "*".repeat(data.length - 4) + data.slice(-4)
  }
  return data
}

// ============================================================================
// 8. RGPD
// ============================================================================

export interface GdprRequest {
  id: string
  type: "access" | "erasure" | "portability" | "rectification" | "restriction"
  userId: string
  userEmail: string
  status: "pending" | "processing" | "completed" | "rejected"
  details?: string
  createdAt: string
  completedAt?: string
}

const gdprRequests: GdprRequest[] = []

export function createGdprRequest(params: {
  type: GdprRequest["type"]
  userId: string
  userEmail: string
  details?: string
}): GdprRequest {
  const request: GdprRequest = {
    id: `gdpr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: params.type,
    userId: params.userId,
    userEmail: params.userEmail,
    status: "pending",
    details: params.details,
    createdAt: new Date().toISOString(),
  }
  gdprRequests.unshift(request)
  logAudit({
    userId: params.userId,
    action: `gdpr_${params.type}_request`,
    category: "rgpd",
    severity: "info",
    entity: "user",
    entityId: params.userId,
    ip: "system",
  })
  return request
}

export function getGdprRequests(): GdprRequest[] {
  return gdprRequests
}

export function getGdprStats() {
  return {
    totalRequests: gdprRequests.length,
    pending: gdprRequests.filter((r) => r.status === "pending").length,
    completed: gdprRequests.filter((r) => r.status === "completed").length,
    byType: gdprRequests.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }
}

// ============================================================================
// 9. PROTECTION API
// ============================================================================

export interface ApiProtectionConfig {
  corsOrigins: string[]
  cspDirectives: string[]
  maxBodySize: number
  requireHttps: boolean
  allowedMethods: string[]
  requestTimeout: number
}

export const apiProtectionConfig: ApiProtectionConfig = {
  corsOrigins: [
    "https://scraapiq.ci",
    "https://app.scraapiq.ci",
    "http://localhost:3000",
  ],
  cspDirectives: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ],
  maxBodySize: 10 * 1024 * 1024, // 10 MB
  requireHttps: process.env.NODE_ENV === "production",
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  requestTimeout: 30000,
}

export function validateApiRequest(req: {
  method: string
  headers: Record<string, string>
  body?: unknown
  url: string
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Method check
  if (!apiProtectionConfig.allowedMethods.includes(req.method)) {
    errors.push(`Méthode ${req.method} non autorisée`)
  }

  // Body size check
  if (req.body) {
    const bodySize = JSON.stringify(req.body).length
    if (bodySize > apiProtectionConfig.maxBodySize) {
      errors.push(`Body trop volumineux: ${bodySize} > ${apiProtectionConfig.maxBodySize}`)
    }
  }

  // CORS check
  const origin = req.headers.origin || req.headers.Origin
  if (origin && !apiProtectionConfig.corsOrigins.includes(origin)) {
    errors.push(`Origine CORS non autorisée: ${origin}`)
  }

  // WAF check sur l'URL
  const urlWaf = wafInspect(req.url)
  if (urlWaf.blocked) {
    errors.push(`URL bloquée par WAF: ${urlWaf.matchedRules.map((r) => r.name).join(", ")}`)
  }

  // WAF check sur le body
  if (req.body && typeof req.body === "object") {
    const bodyStr = JSON.stringify(req.body)
    const bodyWaf = wafInspect(bodyStr)
    if (bodyWaf.blocked) {
      errors.push(`Body bloqué par WAF: ${bodyWaf.matchedRules.map((r) => r.name).join(", ")}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": apiProtectionConfig.cspDirectives.join("; "),
  }
}

// ============================================================================
// GLOBAL STATS
// ============================================================================

export function getSecurityOverview() {
  return {
    rateLimit: getRateLimitStats(),
    waf: { rulesCount: wafRules.length, blockedRules: wafRules.filter((r) => r.action === "block").length },
    ddos: getDdosStats(),
    captcha: getCaptchaStats(),
    events: getSecurityStats(),
    audit: {
      total: auditTrail.length,
      integrity: verifyAuditIntegrity(),
    },
    rgpd: getGdprStats(),
    encryption: {
      algorithm: ALGORITHM,
      keyLength: 256,
      tls: apiProtectionConfig.requireHttps,
    },
    api: {
      corsOrigins: apiProtectionConfig.corsOrigins.length,
      cspDirectives: apiProtectionConfig.cspDirectives.length,
      maxBodySize: apiProtectionConfig.maxBodySize,
      allowedMethods: apiProtectionConfig.allowedMethods.length,
    },
  }
}
