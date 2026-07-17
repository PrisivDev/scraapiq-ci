/**
 * Liveness probe — GET /api/health
 *
 * Lightweight: confirms the Node process is alive and can answer HTTP.
 * Does NOT check DB / Redis / external APIs (that's /api/ready's job).
 *
 * Used by load balancers (Caddy / Kubernetes / Cloudflare) as the
 * "liveness" probe — if this fails, the LB restarts the pod.
 *
 * Target response time: < 5ms.
 */
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "1.0.0",
    },
    { status: 200 }
  )
}
