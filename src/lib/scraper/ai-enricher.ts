/**
 * Enrichisseur LLM — complète les champs manquants via z-ai
 *
 * Cas d'usage :
 *  - Email manquant → déduit depuis le site web
 *  - Site web manquant → déduit depuis le nom + ville
 *  - Secteur manquant → déduit depuis la description
 *  - Description manquante → générée depuis nom + secteur
 *  - Horaires manquants → inférés depuis le secteur (générique)
 */

import ZAI from "z-ai-web-dev-sdk"
import type { CleanedEntity, AICleanerConfig } from "./ai-cleaner-types"

/**
 * Identifie les champs manquants éligibles à l'enrichissement IA
 */
export function findMissingFields(entity: CleanedEntity): string[] {
  const missing: string[] = []

  if (!entity.email) missing.push("email")
  if (!entity.website) missing.push("website")
  if (!entity.description || entity.description.length < 50) missing.push("description")
  if (!entity.sector && !entity.detectedSector) missing.push("sector")
  if (!entity.hours || entity.hours.length === 0) missing.push("hours")
  if (!entity.address) missing.push("address")
  if (!entity.phone) missing.push("phone")

  return missing
}

/**
 * Enrichit une entité via LLM
 * Construit un prompt avec les informations disponibles et demande à l'IA de compléter
 */
export async function enrichWithLLM(
  entity: CleanedEntity,
  missingFields: string[],
  config: AICleanerConfig = {}
): Promise<{
  completions: Array<{ field: string; value: string; confidence: number; source: string }>
  llmCalls: number
}> {
  const completions: Array<{ field: string; value: string; confidence: number; source: string }> = []
  let llmCalls = 0

  if (missingFields.length === 0) {
    return { completions, llmCalls }
  }

  const minConfidence = config.minConfidence ?? 0.7

  try {
    const zai = await ZAI.create()

    // Construit le contexte
    const context = {
      name: entity.name,
      sector: entity.detectedSector || entity.sector,
      category: entity.category,
      city: entity.city,
      commune: entity.commune_label,
      address: entity.cleanedAddress || entity.address,
      phone: entity.cleanedPhone || entity.phone,
      website: entity.website,
      description: entity.description?.slice(0, 300),
    }

    const fieldsToComplete = missingFields.filter((f) =>
      ["email", "website", "description", "hours", "address"].includes(f)
    )

    if (fieldsToComplete.length === 0) {
      return { completions, llmCalls }
    }

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un expert en enrichment de données B2B pour les entreprises ivoiriennes. À partir des informations disponibles sur une entreprise, complète les champs manquants.

IMPORTANT :
- Pour l'email : devine à partir du site web (contact@, info@, service.client@)
- Pour le site web : déduis à partir du nom + secteur (ex: "Orange CI" → "orange.ci")
- Pour la description : génère 1-2 phrases professionnelles basées sur le secteur
- Pour les horaires : propose des horaires standards pour le secteur (ex: resto 11h-23h)
- Pour l'adresse : ne devine JAMAIS une adresse précise, retourne null si incertain

Réponds UNIQUEMENT avec un JSON valide :
{
  "email": {"value": "contact@exemple.ci", "confidence": 0.8} ou null,
  "website": {"value": "https://exemple.ci", "confidence": 0.9} ou null,
  "description": {"value": "texte", "confidence": 0.7} ou null,
  "hours": [{"day": "Lundi", "hours": "09:00-18:00"}] ou null,
  "address": null  // ne devine jamais
}

Si tu ne peux pas déduire un champ avec une confiance >= 0.6, retourne null.`,
        },
        {
          role: "user",
          content: `Entreprise :\n${JSON.stringify(context, null, 2)}\n\nChamps à compléter : ${fieldsToComplete.join(", ")}`,
        },
      ],
      thinking: { type: "disabled" },
    })

    llmCalls++

    const response = completion.choices[0]?.message?.content || ""
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { completions, llmCalls }
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Mapping
    if (parsed.email?.value && parsed.email.confidence >= minConfidence) {
      completions.push({
        field: "email",
        value: parsed.email.value,
        confidence: parsed.email.confidence,
        source: "llm_inference",
      })
    }
    if (parsed.website?.value && parsed.website.confidence >= minConfidence) {
      completions.push({
        field: "website",
        value: parsed.website.value,
        confidence: parsed.website.confidence,
        source: "llm_inference",
      })
    }
    if (parsed.description?.value && parsed.description.confidence >= minConfidence) {
      completions.push({
        field: "description",
        value: parsed.description.value,
        confidence: parsed.description.confidence,
        source: "llm_inference",
      })
    }
    if (parsed.hours && Array.isArray(parsed.hours)) {
      completions.push({
        field: "hours",
        value: JSON.stringify(parsed.hours),
        confidence: 0.6,
        source: "llm_inference",
      })
    }

    return { completions, llmCalls }
  } catch (err) {
    console.error("[ai] enrichWithLLM error:", err)
    return { completions, llmCalls }
  }
}

/**
 * Déduit un email à partir du site web (méthode déterministe, sans LLM)
 */
export function guessEmailFromWebsite(website: string, name: string): string | null {
  if (!website) return null
  try {
    const url = new URL(website.startsWith("http") ? website : "https://" + website)
    const domain = url.hostname.replace(/^www\./, "")

    // Patterns courants
    const slugName = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10)

    const candidates = [
      `contact@${domain}`,
      `info@${domain}`,
      `service.client@${domain}`,
      `communication@${domain}`,
      `${slugName}@${domain}`,
    ]

    // Retourne le plus probable (contact@)
    return candidates[0]
  } catch {
    return null
  }
}

/**
 * Déduit un site web à partir du nom (méthode déterministe)
 */
export function guessWebsiteFromName(name: string, country = "ci"): string | null {
  if (!name) return null

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^(sarl|sa|eurl|sas|sci|ets|group|groupe)/, "")
    .slice(0, 20)

  if (slug.length < 3) return null

  return `https://www.${slug}.${country}`
}
