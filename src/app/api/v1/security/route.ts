/**
 * GET /api/v1/security — vue d'ensemble sécurité
 * GET /api/v1/security?view=events — événements de sécurité
 * GET /api/v1/security?view=audit — trail d'audit
 * GET /api/v1/security?view=waf — règles WAF
 * GET /api/v1/security?view=ddos — IPs bloquées DDoS
 * GET /api/v1/security?view=gdpr — demandes RGPD
 * POST /api/v1/security — actions (create_gdpr, test_waf, test_ddos)
 */
import { NextRequest } from "next/server"
import {
  getSecurityOverview, getSecurityEvents, getAuditTrail, getWafRules,
  getBlockedIps, getGdprRequests, createGdprRequest, wafInspect,
  logSecurityEvent, logAudit,
} from "@/lib/security/security-module"
import { jsonResponse, errorResponse } from "@/lib/auth/helpers"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const view = searchParams.get("view")

  if (view === "events") {
    return jsonResponse({
      events: getSecurityEvents({
        type: searchParams.get("type") || undefined,
        severity: searchParams.get("severity") || undefined,
        limit: parseInt(searchParams.get("limit") || "100"),
      }),
    })
  }

  if (view === "audit") {
    return jsonResponse({
      audit: getAuditTrail({
        category: searchParams.get("category") || undefined,
        severity: searchParams.get("severity") || undefined,
        limit: parseInt(searchParams.get("limit") || "100"),
      }),
    })
  }

  if (view === "waf") {
    return jsonResponse({ rules: getWafRules() })
  }

  if (view === "ddos") {
    return jsonResponse({ blockedIps: getBlockedIps() })
  }

  if (view === "gdpr") {
    return jsonResponse({ requests: getGdprRequests() })
  }

  // Default: overview
  return jsonResponse(getSecurityOverview())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === "create_gdpr") {
    const { type, userId, userEmail, details } = body
    if (!type || !userId || !userEmail) {
      return errorResponse("type, userId, userEmail requis", 400)
    }
    const request = createGdprRequest({ type, userId, userEmail, details })
    return jsonResponse({ success: true, request }, { status: 201 })
  }

  if (action === "test_waf") {
    const { input } = body
    if (!input) return errorResponse("input requis", 400)
    const result = wafInspect(input)
    return jsonResponse({ result })
  }

  if (action === "simulate_attack") {
    const attacks = [
      "1' OR 1=1 --",
      "<script>alert('XSS')</script>",
      "../../../etc/passwd",
      "DROP TABLE users;",
      "'; DROP TABLE companies; --",
    ]
    const results = attacks.map((a) => ({ input: a, ...wafInspect(a) }))
    return jsonResponse({ results })
  }

  return errorResponse("Action invalide", 400)
}
