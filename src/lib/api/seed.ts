/**
 * Production: no auto-seed. Companies must come from real scraping.
 *
 * This file previously auto-seeded the Company table with the geoCompanies
 * mock data when the table was empty. That behaviour has been disabled for
 * production: the REST API `/api/v1/companies` now returns an empty list
 * until real scraping jobs insert rows into the Company table.
 *
 * The function is kept (returns 0 immediately) so existing callers — e.g.
 * `GET /api/v1/companies` — don't break their import.
 */
import { db } from "@/lib/db"

export async function seedCompaniesIfEmpty(): Promise<number> {
  // Production: no auto-seed. Companies must come from real scraping.
  // Return the current count (0 if empty) so callers can still branch on it.
  try {
    const count = await db.company.count()
    return count
  } catch {
    return 0
  }
}
