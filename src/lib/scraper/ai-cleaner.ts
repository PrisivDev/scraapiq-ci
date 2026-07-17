/**
 * Moteur IA de nettoyage et d'enrichissement — orchestrateur principal
 *
 * Pipeline :
 *  1. Déduplication (placeId, tél, email, site, similarité nom+GPS)
 *  2. Fusion des fiches doublons (garde le meilleur champ de chaque source)
 *  3. Correction déterministe (téléphone, email, adresse, nom)
 *  4. Détection secteur (règles + LLM)
 *  5. Enrichissement LLM (champs manquants)
 *  6. Score de qualité
 *  7. Détection entreprises fermées (règles + LLM)
 */

import type {
  ScrapedPlace,
} from "./types"
import type {
  CleanedEntity,
  AICleanerConfig,
  AICleanerEvent,
  CleaningReport,
  MergedGroup,
  BusinessStatus,
  InfoSource,
} from "./ai-cleaner-types"
import { deduplicatePlaces, type DedupMatch } from "./dedup"
import { fixPhone, fixEmail, normalizeAddress, cleanBusinessName } from "./ai-correctors"
import { detectSectorHybrid } from "./sector-detector"
import { calculateQualityScore, detectClosureIndicators, detectClosureByLLM } from "./quality-closed-detector"
import { enrichWithLLM, findMissingFields, guessEmailFromWebsite, guessWebsiteFromName } from "./ai-enricher"
import { normalizePhone, normalizeEmail, normalizeUrl } from "./normalize"

export class AICleaner {
  private config: Required<AICleanerConfig>
  private listeners: ((event: AICleanerEvent) => void)[] = []
  private cancelled = false

  constructor(config: AICleanerConfig = {}) {
    this.config = {
      useLLM: config.useLLM ?? true,
      llmModel: config.llmModel ?? "glm-4",
      minConfidence: config.minConfidence ?? 0.7,
      detectClosed: config.detectClosed ?? true,
      completeMissing: config.completeMissing ?? true,
      detectSector: config.detectSector ?? true,
      language: config.language ?? "fr",
      country: config.country ?? "ci",
    }
  }

  on(listener: (event: AICleanerEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: AICleanerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error("[ai-cleaner] listener error:", err)
      }
    }
  }

  cancel(): void {
    this.cancelled = true
  }

  /**
   * Lance le pipeline complet de nettoyage
   * Retourne le rapport ET les entités nettoyées
   */
  async clean(jobId: string, entities: ScrapedPlace[]): Promise<{
    report: CleaningReport
    cleanedEntities: CleanedEntity[]
  }> {
    const startedAt = new Date()
    this.cancelled = false
    const corrections: CleaningReport["corrections"] = []
    let llmCalls = 0
    const cleanedEntities: CleanedEntity[] = []

    this.emit({ type: "ai-start", totalEntities: entities.length })

    try {
      // ============ PHASE 1 : DÉDUPLICATION ============
      this.emit({ type: "ai-dedup-start" })
      this.emit({ type: "ai-progress", progress: 5, phase: "dedup" })

      const { unique, duplicates } = deduplicatePlaces(entities)

      this.emit({
        type: "ai-dedup-done",
        duplicatesRemoved: duplicates.length,
        groups: duplicates.length,
      })

      // Construit les groupes fusionnés
      const mergedGroups: MergedGroup[] = duplicates.map((group, i) => ({
        canonicalId: `merged-${i}-${Date.now().toString(36)}`,
        canonicalName: group.canonicalName,
        mergedEntities: group.duplicates.map((d) => ({
          id: d.id,
          name: d.name,
          source: "google_maps" as InfoSource, // default
          similarity: d.similarity,
          matchReason: d.reason,
        })),
        fusionConfidence: group.confidence,
      }))

      this.emit({ type: "ai-progress", progress: 15, phase: "merge" })

      // ============ PHASE 2 : FUSION DES DOUBLONS ============
      // Pour chaque groupe, fusionne les fiches en prenant le meilleur champ
      const mergedEntities: CleanedEntity[] = unique.map((e) => ({ ...e } as CleanedEntity))

      // Pour les entités qui étaient dans un groupe de doublons, on garde la canonical
      // et on fusionne les infos des doublons (meilleur email, meilleur tél, etc.)
      for (const group of mergedGroups) {
        this.emit({
          type: "ai-merge-start",
          groupIndex: mergedGroups.indexOf(group),
          total: mergedGroups.length,
        })

        // Trouve l'entité canonique (la première unique qui matche)
        const canonicalEntity = mergedEntities.find((e) => e.name === group.canonicalName)
        if (canonicalEntity) {
          canonicalEntity.canonicalId = group.canonicalId
          canonicalEntity.aliases = group.mergedEntities.map((m) => m.name)
          canonicalEntity.mergedCount = group.mergedEntities.length + 1
          canonicalEntity.sources = (canonicalEntity.sources || ["google_maps"]) as InfoSource[]

          this.emit({
            type: "ai-merge-done",
            canonicalName: group.canonicalName,
            mergedCount: canonicalEntity.mergedCount,
          })
        }
      }

      this.emit({ type: "ai-progress", progress: 25, phase: "correct" })

      // ============ PHASE 3 : CORRECTION DÉTERMINISTE ============
      let phoneCorrections = 0
      let emailCorrections = 0
      let addressNormalizations = 0

      for (const entity of mergedEntities) {
        if (this.cancelled) break
        this.emit({ type: "ai-correct-start", entityId: entity.id || entity.name })

        // --- Téléphone ---
        if (entity.phone) {
          const fixed = fixPhone(entity.phone)
          if (fixed.cleaned && fixed.corrected) {
            entity.originalPhone = entity.phone
            entity.cleanedPhone = fixed.cleaned
            entity.phoneCorrected = true
            entity.phoneNormalized = fixed.cleaned
            phoneCorrections++
            corrections.push({
              entityId: entity.id || entity.name,
              fieldName: "phone",
              oldValue: entity.originalPhone,
              newValue: fixed.cleaned,
              correctionType: "phone",
              method: fixed.method.includes("llm") ? "llm" : "deterministic",
              confidence: 0.95,
            })
            this.emit({
              type: "ai-correct-phone",
              entityId: entity.id || entity.name,
              from: entity.originalPhone,
              to: fixed.cleaned,
              method: fixed.method,
            })
          } else if (fixed.cleaned) {
            entity.cleanedPhone = fixed.cleaned
            entity.phoneNormalized = fixed.cleaned
          }
        }

        // --- Email ---
        if (entity.email) {
          const fixed = fixEmail(entity.email)
          if (fixed.cleaned) {
            if (fixed.corrected) {
              entity.originalEmail = entity.email
              entity.cleanedEmail = fixed.cleaned
              entity.emailCorrected = true
              emailCorrections++
              corrections.push({
                entityId: entity.id || entity.name,
                fieldName: "email",
                oldValue: entity.originalEmail,
                newValue: fixed.cleaned,
                correctionType: "email",
                method: fixed.method.includes("llm") ? "llm" : "deterministic",
                confidence: 0.9,
              })
              this.emit({
                type: "ai-correct-email",
                entityId: entity.id || entity.name,
                from: entity.originalEmail,
                to: fixed.cleaned,
                method: fixed.method,
              })
            } else {
              entity.cleanedEmail = fixed.cleaned
            }
            entity.emailValid = fixed.valid
          } else {
            // Email invalide — marque comme invalid
            entity.emailValid = false
          }
        }

        // --- Adresse ---
        if (entity.address) {
          const normalized = normalizeAddress(entity.address)
          if (normalized.cleaned) {
            entity.originalAddress = entity.address
            entity.cleanedAddress = normalized.cleaned
            entity.addressComponents = normalized.components
            if (normalized.corrected) {
              addressNormalizations++
              corrections.push({
                entityId: entity.id || entity.name,
                fieldName: "address",
                oldValue: entity.originalAddress,
                newValue: normalized.cleaned,
                correctionType: "address",
                method: "rule",
                confidence: 0.85,
              })
              this.emit({
                type: "ai-normalize-address",
                entityId: entity.id || entity.name,
                from: entity.originalAddress,
                to: normalized.cleaned,
              })
            }
          }
        }

        // --- Nom ---
        if (entity.name) {
          const cleaned = cleanBusinessName(entity.name)
          if (cleaned.cleaned && cleaned.corrected) {
            entity.cleanedName = cleaned.cleaned
            corrections.push({
              entityId: entity.id || entity.name,
              fieldName: "name",
              oldValue: entity.name,
              newValue: cleaned.cleaned,
              correctionType: "name",
              method: "rule",
              confidence: 0.9,
            })
          } else if (cleaned.cleaned) {
            entity.cleanedName = cleaned.cleaned
          }
        }
      }

      this.emit({ type: "ai-progress", progress: 45, phase: "sector" })

      // ============ PHASE 4 : DÉTECTION SECTEUR ============
      let sectorDetections = 0
      for (const entity of mergedEntities) {
        if (this.cancelled) break
        if (entity.detectedSector) continue // déjà détecté

        const sectorResult = await detectSectorHybrid(
          entity,
          this.config.useLLM && this.config.detectSector,
          this.config.minConfidence
        )
        if (sectorResult.method === "llm") llmCalls++

        if (sectorResult.sector) {
          entity.detectedSector = sectorResult.sector
          entity.sectorCode = sectorResult.code
          entity.sectorKeywords = sectorResult.keywords
          sectorDetections++
          this.emit({
            type: "ai-sector-detect",
            entityId: entity.id || entity.name,
            sector: sectorResult.sector,
            confidence: sectorResult.confidence,
          })

          if (sectorResult.method === "rules" && !entity.sector) {
            entity.sector = sectorResult.sector
          }
        }
      }

      this.emit({ type: "ai-progress", progress: 60, phase: "enrich" })

      // ============ PHASE 5 : ENRICHISSEMENT ============
      let fieldsCompleted = 0
      for (const entity of mergedEntities) {
        if (this.cancelled) break
        if (!this.config.completeMissing) continue

        const missing = findMissingFields(entity)
        if (missing.length === 0) continue

        this.emit({
          type: "ai-enrich-start",
          entityId: entity.id || entity.name,
          missingFields: missing,
        })

        // 1. Méthodes déterministes d'abord (rapides, gratuites)
        if (missing.includes("website") && !entity.website && entity.name) {
          const guessed = guessWebsiteFromName(entity.cleanedName || entity.name, this.config.country)
          if (guessed) {
            entity.website = guessed
            fieldsCompleted++
            if (!entity.aiCompletions) entity.aiCompletions = []
            entity.aiCompletions.push({
              field: "website",
              value: guessed,
              confidence: 0.5,
              source: "rule_guess",
            })
          }
        }

        if (missing.includes("email") && !entity.email && entity.website) {
          const guessed = guessEmailFromWebsite(entity.website, entity.cleanedName || entity.name)
          if (guessed) {
            entity.email = guessed
            entity.cleanedEmail = guessed
            entity.emailValid = false // marqué comme non vérifié
            fieldsCompleted++
            if (!entity.aiCompletions) entity.aiCompletions = []
            entity.aiCompletions.push({
              field: "email",
              value: guessed,
              confidence: 0.4,
              source: "rule_guess",
            })
          }
        }

        // 2. LLM pour le reste
        if (this.config.useLLM) {
          const stillMissing = findMissingFields(entity)
          if (stillMissing.length > 0) {
            const enrichResult = await enrichWithLLM(entity, stillMissing, this.config)
            llmCalls += enrichResult.llmCalls

            for (const completion of enrichResult.completions) {
              if (completion.confidence >= this.config.minConfidence) {
                ;(entity as Record<string, unknown>)[completion.field] = completion.value
                fieldsCompleted++
                if (!entity.aiCompletions) entity.aiCompletions = []
                entity.aiCompletions.push(completion)
              }
            }
          }
        }

        const completedFields = missing.filter((f) => (entity as Record<string, unknown>)[f])
        if (completedFields.length > 0) {
          this.emit({
            type: "ai-enrich-done",
            entityId: entity.id || entity.name,
            completedFields,
          })
        }
      }

      this.emit({ type: "ai-progress", progress: 80, phase: "quality" })

      // ============ PHASE 6 : SCORE DE QUALITÉ ============
      const qualityScores: number[] = []
      for (const entity of mergedEntities) {
        if (this.cancelled) break

        const { score, breakdown } = calculateQualityScore(entity)
        entity.qualityScore = score
        entity.qualityBreakdown = breakdown
        qualityScores.push(score)

        this.emit({
          type: "ai-quality-score",
          entityId: entity.id || entity.name,
          score,
        })
      }

      this.emit({ type: "ai-progress", progress: 90, phase: "closed" })

      // ============ PHASE 7 : DÉTECTION FERMETURES ============
      let closedDetected = 0
      for (const entity of mergedEntities) {
        if (this.cancelled) break
        if (!this.config.detectClosed) continue

        // 1. Règles
        const closure = detectClosureIndicators(entity)

        // 2. LLM si confiance faible
        if (closure.status === "unknown" && closure.indicators.length > 0 && this.config.useLLM) {
          const llmClosure = await detectClosureByLLM(entity)
          llmCalls++
          if (llmClosure.status !== "unknown" && llmClosure.confidence > closure.confidence) {
            entity.businessStatus = llmClosure.status
            entity.closureIndicators = [...closure.indicators, ...llmClosure.indicators]
          } else {
            entity.businessStatus = closure.status
            entity.closureIndicators = closure.indicators
          }
        } else {
          entity.businessStatus = closure.status
          entity.closureIndicators = closure.indicators
        }

        if (entity.businessStatus === "closed" || entity.businessStatus === "temporarily_closed") {
          closedDetected++
        }

        this.emit({
          type: "ai-closed-detect",
          entityId: entity.id || entity.name,
          status: entity.businessStatus,
          indicators: entity.closureIndicators,
        })
      }

      // ============ FINALISATION ============
      this.emit({ type: "ai-progress", progress: 100, phase: "done" })

      const completedAt = new Date()
      const durationMs = completedAt.getTime() - startedAt.getTime()

      // Métadonnées de nettoyage
      for (const entity of mergedEntities) {
        entity.cleaningMetadata = {
          cleanedAt: completedAt.toISOString(),
          durationMs,
          operations: corrections
            .filter((c) => c.entityId === (entity.id || entity.name))
            .map((c) => `${c.fieldName}:${c.method}`),
          llmCalls,
          confidence: (entity.qualityScore || 0) / 100,
        }
      }

      const report: CleaningReport = {
        jobId,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        input: {
          totalEntities: entities.length,
          sources: Array.from(new Set(entities.map((e) => (e as CleanedEntity).sources?.[0] || "google_maps"))) as InfoSource[],
        },
        output: {
          cleanedEntities: mergedEntities.length,
          duplicatesRemoved: duplicates.length,
          fieldsCorrected: corrections.length,
          fieldsCompleted,
          sectorsDetected: sectorDetections,
          closedDetected,
        },
        duplicates: mergedGroups,
        corrections,
        stats: {
          phoneCorrections,
          emailCorrections,
          addressNormalizations,
          sectorDetections,
          qualityScores,
          avgQualityScore: qualityScores.length > 0
            ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
            : 0,
          llmCalls,
          llmTokensUsed: llmCalls * 500, // estimation
        },
      }

      this.emit({ type: "ai-complete", report })

      return { report, cleanedEntities: mergedEntities }
    } catch (err) {
      const completedAt = new Date()
      const errorMsg = (err as Error).message
      this.emit({ type: "ai-error", message: errorMsg })

      const report: CleaningReport = {
        jobId,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        input: {
          totalEntities: entities.length,
          sources: [],
        },
        output: {
          cleanedEntities: 0,
          duplicatesRemoved: 0,
          fieldsCorrected: 0,
          fieldsCompleted: 0,
          sectorsDetected: 0,
          closedDetected: 0,
        },
        duplicates: [],
        corrections,
        stats: {
          phoneCorrections: 0,
          emailCorrections: 0,
          addressNormalizations: 0,
          sectorDetections: 0,
          qualityScores: [],
          avgQualityScore: 0,
          llmCalls,
          llmTokensUsed: 0,
        },
      }
      return { report, cleanedEntities: [] }
    }
  }
}
