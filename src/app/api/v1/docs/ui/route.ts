/**
 * GET /api/v1/docs/ui — Swagger UI (HTML)
 * Loads the OpenAPI spec from /api/v1/docs and renders it via Swagger UI CDN.
 */
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ScrapIQ CI REST API · Swagger UI</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui.css" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  #wrapper { display: flex; flex-direction: column; height: 100vh; }
  #topbar { background: linear-gradient(135deg, #047857 0%, #0d9488 100%); color: white; padding: 14px 24px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  #topbar .logo { width: 36px; height: 36px; background: rgba(255,255,255,0.18); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; }
  #topbar h1 { font-size: 18px; font-weight: 700; margin: 0; }
  #topbar .subtitle { font-size: 12px; opacity: 0.85; }
  #topbar .spacer { flex: 1; }
  #topbar .badge { background: rgba(255,255,255,0.18); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  #swagger-ui { flex: 1; overflow: auto; }
  .swagger-ui .topbar { display: none !important; }
</style>
</head>
<body>
<div id="wrapper">
  <div id="topbar">
    <div class="logo">S</div>
    <div>
      <h1>ScrapIQ CI REST API</h1>
      <div class="subtitle">v1 · CRUD · JWT · Pagination · Filtres · Tri · Recherche · Webhooks</div>
    </div>
    <div class="spacer"></div>
    <div class="badge">v1.0.0</div>
  </div>
  <div id="swagger-ui"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
<script>
  window.onload = () => {
    window.ui = SwaggerUIBundle({
      url: "/api/v1/docs",
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout",
      docExpansion: "list",
      operationsSorter: "alpha",
      tagsSorter: "alpha",
      filter: true,
      tryItOutEnabled: false,
      requestSnippetsEnabled: true,
    });
  };
</script>
</body>
</html>`
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
