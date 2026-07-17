/**
 * GET /api/v1
 * Public API info endpoint — version, endpoints list, auth methods.
 */
import { NextResponse } from "next/server"
import { sendSuccess } from "@/lib/api/helpers"

export const dynamic = "force-dynamic"

export async function GET() {
  return sendSuccess(
    {
      name: "ScrapIQ CI REST API",
      version: "1.0.0",
      versionLabel: "v1",
      description:
        "REST API pour gérer les entreprises ivoiriennes, webhooks, et plus. " +
        "Authentification JWT (cookie ou Bearer) ou API key.",
      baseUrl: "/api/v1",
      auth: {
        methods: [
          {
            type: "jwt-cookie",
            description: "Cookie HTTP-only scraapiq_access (après login via /api/auth/login)",
          },
          {
            type: "bearer",
            description: "Authorization: Bearer <access_token>",
          },
          {
            type: "api-key",
            description: "X-API-Key: <your_api_key>",
          },
        ],
        loginEndpoint: "/api/auth/login",
      },
      endpoints: [
        {
          method: "GET",
          path: "/api/v1",
          description: "API info",
          auth: false,
        },
        {
          method: "GET",
          path: "/api/v1/docs",
          description: "OpenAPI 3.0 spec (JSON)",
          auth: false,
        },
        {
          method: "GET",
          path: "/api/v1/docs/ui",
          description: "Swagger UI (HTML)",
          auth: false,
        },
        {
          method: "GET",
          path: "/api/v1/companies",
          description: "List companies with pagination, filters, sort, search",
          auth: true,
        },
        {
          method: "POST",
          path: "/api/v1/companies",
          description: "Create a company",
          auth: true,
        },
        {
          method: "GET",
          path: "/api/v1/companies/{id}",
          description: "Get a single company",
          auth: true,
        },
        {
          method: "PUT",
          path: "/api/v1/companies/{id}",
          description: "Update a company",
          auth: true,
        },
        {
          method: "DELETE",
          path: "/api/v1/companies/{id}",
          description: "Delete a company",
          auth: true,
        },
        {
          method: "GET",
          path: "/api/v1/webhooks",
          description: "List webhooks",
          auth: true,
        },
        {
          method: "POST",
          path: "/api/v1/webhooks",
          description: "Create a webhook",
          auth: true,
        },
        {
          method: "PUT",
          path: "/api/v1/webhooks/{id}",
          description: "Update a webhook",
          auth: true,
        },
        {
          method: "DELETE",
          path: "/api/v1/webhooks/{id}",
          description: "Delete a webhook",
          auth: true,
        },
        {
          method: "POST",
          path: "/api/v1/webhooks/{id}/test",
          description: "Send a test event to a webhook",
          auth: true,
        },
      ],
      features: [
        "Pagination (page, limit — max 100)",
        "Filters (sector, city, commune, status, minRating)",
        "Sorting (sort, order)",
        "Search (q — name, sector, address)",
        "Webhooks (event delivery)",
        "Audit logging (RestApiLog)",
      ],
    },
    { message: "ScrapIQ CI REST API v1" }
  )
}
