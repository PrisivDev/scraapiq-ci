/**
 * GET /api/v1/docs — OpenAPI 3.0 spec (JSON)
 *
 * The /api/v1/docs/ui HTML page is served by src/app/api/v1/docs/ui/route.ts
 */
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function buildOpenApiSpec(req: NextRequest) {
  const url = new URL(req.url)
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")
  const host = req.headers.get("x-forwarded-host") || url.host
  const baseUrl = `${proto}://${host}`

  const companySchema = {
    type: "object",
    properties: {
      id: { type: "string", example: "clxxxxxx" },
      name: { type: "string", example: "Orange CI - Agence Cocody" },
      sector: { type: "string", nullable: true, example: "Télécommunications" },
      commune: { type: "string", nullable: true, example: "Cocody" },
      city: { type: "string", nullable: true, example: "Abidjan" },
      address: { type: "string", nullable: true, example: "Bd Latrille, Cocody" },
      phone: { type: "string", nullable: true, example: "+225 01 23 45 67 89" },
      email: { type: "string", nullable: true, example: "contact@orange.ci" },
      website: { type: "string", nullable: true, example: "https://www.orange.ci" },
      rccm: { type: "string", nullable: true, example: "CI-ABJ-2018-B-12345" },
      lat: { type: "number", nullable: true, example: 5.3511 },
      lng: { type: "number", nullable: true, example: -3.9956 },
      rating: { type: "number", nullable: true, example: 4.5 },
      reviewCount: { type: "integer", nullable: true, example: 320 },
      status: { type: "string", example: "active", enum: ["active", "closed", "relocated"] },
      description: { type: "string", nullable: true },
      employees: { type: "string", nullable: true, example: "100-500" },
      sources: { type: "string", example: "[\"google-maps\"]" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  }

  const webhookSchema = {
    type: "object",
    properties: {
      id: { type: "string", example: "clxxxxxx" },
      url: { type: "string", example: "https://example.com/webhook" },
      events: {
        type: "array",
        items: { type: "string" },
        example: ["company.created", "company.updated", "company.deleted"],
      },
      secret: { type: "string", nullable: true, example: "abcd••••" },
      isActive: { type: "boolean", example: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      deliveriesCount: { type: "integer", example: 12 },
    },
  }

  const paginationMetaSchema = {
    type: "object",
    properties: {
      page: { type: "integer", example: 1 },
      limit: { type: "integer", example: 20 },
      total: { type: "integer", example: 60 },
      totalPages: { type: "integer", example: 3 },
      hasNext: { type: "boolean", example: true },
      hasPrev: { type: "boolean", example: false },
    },
  }

  const errorSchema = {
    type: "object",
    properties: {
      success: { type: "boolean", example: false },
      error: { type: "string", example: "Not found" },
      code: { type: "string", example: "NOT_FOUND" },
    },
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "ScrapIQ CI REST API",
      description:
        "API REST complète pour gérer les entreprises ivoiriennes, webhooks, et plus.\n\n" +
        "## Authentification\n\n" +
        "Trois méthodes supportées :\n" +
        "1. **Cookie** : `scraapiq_access` (HTTP-only, après `/api/auth/login`)\n" +
        "2. **Bearer** : `Authorization: Bearer <token>`\n" +
        "3. **API Key** : `X-API-Key: <key>`\n\n" +
        "## Pagination\n\n" +
        "Tous les endpoints de liste acceptent `page` (default 1) et `limit` (default 20, max 100).\n\n" +
        "## Tri & recherche\n\n" +
        "Utilisez `?sort=field&order=asc|desc` et `?q=terme` pour chercher.",
      version: "1.0.0",
      contact: { name: "ScrapIQ CI", url: "https://scraapiq.ci" },
    },
    servers: [
      { url: `${baseUrl}/api/v1`, description: "API v1" },
      { url: "/api/v1", description: "Relative" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
        cookieAuth: { type: "apiKey", in: "cookie", name: "scraapiq_access" },
      },
      schemas: {
        Company: companySchema,
        Webhook: webhookSchema,
        PaginationMeta: paginationMetaSchema,
        Error: errorSchema,
      },
    },
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }, { cookieAuth: [] }],
    paths: {
      "/": {
        get: {
          summary: "API info",
          description: "Returns API version, endpoint list, and supported auth methods.",
          security: [],
          responses: {
            "200": {
              description: "API info",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/docs": {
        get: {
          summary: "OpenAPI 3.0 spec",
          description: "Returns the full OpenAPI 3.0 specification as JSON.",
          security: [],
          responses: {
            "200": {
              description: "OpenAPI spec",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/docs/ui": {
        get: {
          summary: "Swagger UI",
          description: "Serves the Swagger UI HTML page (uses CDN).",
          security: [],
          responses: {
            "200": { description: "HTML page", content: { "text/html": { schema: { type: "string" } } } },
          },
        },
      },
      "/companies": {
        get: {
          summary: "List companies",
          description: "Returns a paginated, filterable, sortable, searchable list of companies.",
          tags: ["Companies"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Items per page (max 100)" },
            { name: "q", in: "query", schema: { type: "string" }, description: "Search term (name, sector, address, description)" },
            { name: "sector", in: "query", schema: { type: "string" }, description: "Filter by sector" },
            { name: "city", in: "query", schema: { type: "string" }, description: "Filter by city" },
            { name: "commune", in: "query", schema: { type: "string" }, description: "Filter by commune" },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "closed", "relocated"] }, description: "Filter by status" },
            { name: "minRating", in: "query", schema: { type: "number" }, description: "Minimum rating (0-5)" },
            { name: "sort", in: "query", schema: { type: "string", enum: ["name", "sector", "city", "commune", "rating", "reviewCount", "createdAt", "updatedAt"] }, description: "Sort field" },
            { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "asc" }, description: "Sort order" },
          ],
          responses: {
            "200": {
              description: "Paginated list of companies",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: { type: "array", items: { $ref: "#/components/schemas/Company" } },
                      meta: { $ref: "#/components/schemas/PaginationMeta" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          summary: "Create a company",
          tags: ["Companies"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    sector: { type: "string" },
                    commune: { type: "string" },
                    city: { type: "string" },
                    address: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                    website: { type: "string" },
                    rccm: { type: "string" },
                    lat: { type: "number" },
                    lng: { type: "number" },
                    rating: { type: "number" },
                    reviewCount: { type: "integer" },
                    description: { type: "string" },
                    employees: { type: "string" },
                    status: { type: "string", enum: ["active", "closed", "relocated"] },
                    sources: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Company created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Company" },
                      message: { type: "string", example: "Company created" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/companies/{id}": {
        get: {
          summary: "Get a single company",
          tags: ["Companies"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Company found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Company" },
                    },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        put: {
          summary: "Update a company",
          tags: ["Companies"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", properties: companySchema.properties },
              },
            },
          },
          responses: {
            "200": {
              description: "Company updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Company" },
                      message: { type: "string", example: "Company updated" },
                    },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          summary: "Delete a company",
          tags: ["Companies"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Company deleted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object", properties: { id: { type: "string" } } },
                      message: { type: "string", example: "Company deleted" },
                    },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks": {
        get: {
          summary: "List webhooks",
          tags: ["Webhooks"],
          responses: {
            "200": {
              description: "Webhook list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "array", items: { $ref: "#/components/schemas/Webhook" } },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          summary: "Create a webhook",
          tags: ["Webhooks"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "events"],
                  properties: {
                    url: { type: "string" },
                    events: { type: "array", items: { type: "string" } },
                    isActive: { type: "boolean" },
                    secret: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Webhook created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Webhook" },
                      message: { type: "string", example: "Webhook created" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks/{id}": {
        put: {
          summary: "Update a webhook",
          tags: ["Webhooks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    events: { type: "array", items: { type: "string" } },
                    isActive: { type: "boolean" },
                    secret: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Webhook updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/Webhook" },
                      message: { type: "string", example: "Webhook updated" },
                    },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          summary: "Delete a webhook",
          tags: ["Webhooks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Webhook deleted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object", properties: { id: { type: "string" } } },
                      message: { type: "string", example: "Webhook deleted" },
                    },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks/{id}/test": {
        post: {
          summary: "Send a test event",
          tags: ["Webhooks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Test result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          deliveryId: { type: "string" },
                          webhookId: { type: "string" },
                          url: { type: "string" },
                          event: { type: "string" },
                          httpStatus: { type: "integer", nullable: true },
                          status: { type: "string", enum: ["success", "failed"] },
                          response: { type: "string" },
                          error: { type: "string", nullable: true },
                        },
                      },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
  }
}

export async function GET(req: NextRequest) {
  const spec = buildOpenApiSpec(req)
  return NextResponse.json(spec, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
