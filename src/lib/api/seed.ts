/**
 * Seeds the Company table with the geoCompanies sample data on first call.
 *
 * Called by `GET /api/v1/companies` when the table is empty.
 */
import { db } from "@/lib/db"
import { geoCompanies } from "@/lib/geo-data"

export async function seedCompaniesIfEmpty(): Promise<number> {
  const count = await db.company.count()
  if (count > 0) return count

  // Map geo-data status → REST API status
  const statusMap: Record<string, string> = {
    verified: "active",
    enriched: "active",
    partial: "active",
  }

  await db.company.createMany({
    data: geoCompanies.map((c) => ({
      name: c.name,
      sector: c.sector,
      commune: c.commune,
      city: c.city,
      address: c.address,
      phone: c.phone || null,
      lat: c.lat,
      lng: c.lng,
      rating: c.rating || null,
      reviewCount: c.reviewCount || null,
      status: statusMap[c.status] || "active",
      employees: c.employees || null,
      sources: JSON.stringify(["google-maps"]),
    })),
  })

  return geoCompanies.length
}
