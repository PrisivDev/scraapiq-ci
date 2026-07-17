/**
 * Moteur de recherche type Elasticsearch — en mémoire
 *
 * Implémente les concepts clés d'Elasticsearch :
 *  - Analyzer (tokenizer + lowercase + accents stripping + stopwords)
 *  - Inverted index (terme → liste de documents avec positions)
 *  - BM25 scoring (Okapi BM25, comme Elasticsearch par défaut)
 *  - Fuzzy matching (Levenshtein distance, comme Elasticsearch ~1)
 *  - Multi-match (recherche sur plusieurs champs avec boosts)
 *  - Bool query (must, should, filter)
 *  - Aggregations (terms, par champ)
 *  - Highlights (match contexts)
 *  - Facets (compteurs par catégorie)
 */

export interface IndexedDocument {
  id: string
  fields: Record<string, unknown>
}

export interface SearchHit {
  id: string
  score: number
  source: Record<string, unknown>
  highlight?: Record<string, string[]>
}

export interface SearchRequest {
  query: string
  fields?: string[]
  filters?: Record<string, string | string[]>
  fuzzy?: boolean
  fuzzyDistance?: number
  size?: number
  from?: number
  aggregations?: string[]
}

export interface SearchResponse {
  took: number
  total: number
  hits: SearchHit[]
  aggregations: Record<string, Array<{ key: string; count: number }>>
  suggestions: string[]
}

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au", "aux",
  "ce", "cet", "cette", "ces", "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses",
  "nous", "vous", "ils", "elles", "est", "sont", "etre", "avoir", "pour", "par", "avec",
  "sans", "sur", "sous", "dans", "hors", "vers", "chez", "entre", "pendant", "avant", "apres",
  "the", "an", "and", "or", "to", "of", "in", "on", "at", "for", "with", "without",
])

export function analyze(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

export function tokenize(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

interface Posting {
  docId: string
  termFrequency: number
  positions: number[]
}

interface FieldIndex {
  postings: Map<string, Posting[]>
  docCount: number
  totalTermFrequency: number
  fieldLengths: Map<string, number>
}

export class InMemoryElasticsearch {
  private documents = new Map<string, IndexedDocument>()
  private fieldIndexes = new Map<string, FieldIndex>()
  private searchableFields: string[]
  private avgFieldLength = new Map<string, number>()

  constructor(searchableFields: string[] = ["name", "sector", "commune", "city", "address"]) {
    this.searchableFields = searchableFields
  }

  index(doc: IndexedDocument): void {
    this.documents.set(doc.id, doc)

    for (const field of this.searchableFields) {
      const value = doc.fields[field]
      if (value === undefined || value === null) continue

      const text = String(value)
      const tokens = analyze(text)

      if (!this.fieldIndexes.has(field)) {
        this.fieldIndexes.set(field, {
          postings: new Map(),
          docCount: 0,
          totalTermFrequency: 0,
          fieldLengths: new Map(),
        })
      }

      const fieldIndex = this.fieldIndexes.get(field)!
      fieldIndex.docCount++
      fieldIndex.fieldLengths.set(doc.id, tokens.length)
      fieldIndex.totalTermFrequency += tokens.length

      const termPositions = new Map<string, number[]>()
      tokens.forEach((token, pos) => {
        if (!termPositions.has(token)) termPositions.set(token, [])
        termPositions.get(token)!.push(pos)
      })

      for (const [term, positions] of termPositions) {
        if (!fieldIndex.postings.has(term)) {
          fieldIndex.postings.set(term, [])
        }
        fieldIndex.postings.get(term)!.push({
          docId: doc.id,
          termFrequency: positions.length,
          positions,
        })
      }
    }

    this.recomputeAvgFieldLengths()
  }

  indexBatch(docs: IndexedDocument[]): void {
    for (const doc of docs) this.index(doc)
  }

  private recomputeAvgFieldLengths(): void {
    for (const [field, idx] of this.fieldIndexes) {
      this.avgFieldLength.set(field, idx.docCount > 0 ? idx.totalTermFrequency / idx.docCount : 0)
    }
  }

  search(request: SearchRequest): SearchResponse {
    const startTime = Date.now()
    const {
      query,
      fields = this.searchableFields,
      filters = {},
      fuzzy = true,
      fuzzyDistance = 2,
      size = 10,
      from = 0,
      aggregations = [],
    } = request

    const queryTerms = analyze(query)
    const scores = new Map<string, number>()

    for (const field of fields) {
      const fieldIndex = this.fieldIndexes.get(field)
      if (!fieldIndex) continue

      const fieldBoost = this.getFieldBoost(field)
      const avgLength = this.avgFieldLength.get(field) || 1

      for (const term of queryTerms) {
        const postings = fieldIndex.postings.get(term) || []
        let allPostings = [...postings]

        if (fuzzy && postings.length === 0) {
          const fuzzyTerms = this.findFuzzyTerms(field, term, fuzzyDistance)
          for (const ft of fuzzyTerms) {
            const fp = fieldIndex.postings.get(ft) || []
            allPostings = allPostings.concat(fp)
          }
        }

        const N = fieldIndex.docCount
        const df = allPostings.length
        if (df === 0) continue

        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
        const k1 = 1.2
        const b = 0.75

        for (const posting of allPostings) {
          const tf = posting.termFrequency
          const docLength = fieldIndex.fieldLengths.get(posting.docId) || avgLength
          const bm25 = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgLength))))
          const currentScore = scores.get(posting.docId) || 0
          scores.set(posting.docId, currentScore + bm25 * fieldBoost)
        }
      }
    }

    // Filtres
    let filteredDocIds: Set<string> | null = null
    for (const [filterField, filterValue] of Object.entries(filters)) {
      const values = Array.isArray(filterValue) ? filterValue : [filterValue]
      const matchingIds = new Set<string>()

      for (const doc of this.documents.values()) {
        const docValue = String(doc.fields[filterField] || "").toLowerCase()
        if (values.some((v) => v.toLowerCase() === docValue)) {
          matchingIds.add(doc.id)
        }
      }

      if (filteredDocIds === null) {
        filteredDocIds = matchingIds
      } else {
        filteredDocIds = new Set([...filteredDocIds].filter((id) => matchingIds.has(id)))
      }
    }

    if (filteredDocIds === null) {
      filteredDocIds = new Set(this.documents.keys())
    }

    let hits: SearchHit[] = []
    for (const [docId, score] of scores) {
      if (!filteredDocIds.has(docId)) continue
      const doc = this.documents.get(docId)
      if (!doc) continue
      hits.push({
        id: docId,
        score,
        source: doc.fields,
        highlight: this.highlight(doc, queryTerms, fields),
      })
    }

    if (hits.length === 0 && Object.keys(filters).length > 0) {
      for (const docId of filteredDocIds) {
        const doc = this.documents.get(docId)
        if (doc) {
          hits.push({ id: docId, score: 0, source: doc.fields })
        }
      }
    }

    hits.sort((a, b) => b.score - a.score)
    const total = hits.length
    const paginatedHits = hits.slice(from, from + size)

    // Aggregations
    const aggResults: SearchResponse["aggregations"] = {}
    for (const aggField of aggregations) {
      const counts = new Map<string, number>()
      for (const hit of hits) {
        const value = hit.source[aggField]
        if (value) {
          const key = String(value)
          counts.set(key, (counts.get(key) || 0) + 1)
        }
      }
      aggResults[aggField] = Array.from(counts.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
    }

    const suggestions = this.generateSuggestions(queryTerms)

    return {
      took: Date.now() - startTime,
      total,
      hits: paginatedHits,
      aggregations: aggResults,
      suggestions,
    }
  }

  private getFieldBoost(field: string): number {
    const boosts: Record<string, number> = {
      name: 3, sector: 2, commune: 1.5, city: 1.5, address: 1, category: 2, description: 0.5,
    }
    return boosts[field] || 1
  }

  private findFuzzyTerms(field: string, term: string, maxDistance: number): string[] {
    const fieldIndex = this.fieldIndexes.get(field)
    if (!fieldIndex) return []
    const fuzzyTerms: string[] = []
    for (const indexedTerm of fieldIndex.postings.keys()) {
      const distance = levenshtein(term, indexedTerm)
      if (distance <= maxDistance && distance > 0) {
        fuzzyTerms.push(indexedTerm)
      }
    }
    return fuzzyTerms.slice(0, 10)
  }

  private generateSuggestions(queryTerms: string[]): string[] {
    if (queryTerms.length === 0) return []
    const suggestions = new Set<string>()
    const lastTerm = queryTerms[queryTerms.length - 1]
    for (const fieldIndex of this.fieldIndexes.values()) {
      for (const term of fieldIndex.postings.keys()) {
        if (term.startsWith(lastTerm) && term !== lastTerm) {
          suggestions.add(term)
        }
        if (suggestions.size >= 5) break
      }
      if (suggestions.size >= 5) break
    }
    return Array.from(suggestions).slice(0, 5)
  }

  private highlight(doc: IndexedDocument, queryTerms: string[], fields: string[]): Record<string, string[]> {
    const highlights: Record<string, string[]> = {}
    for (const field of fields) {
      const value = doc.fields[field]
      if (!value) continue
      const text = String(value)
      const tokens = tokenize(text)
      let hasMatch = false
      const highlighted = tokens
        .map((token) => {
          const tokenClean = token.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          if (queryTerms.some((qt) => tokenClean.includes(qt) || qt.includes(tokenClean))) {
            hasMatch = true
            return `<mark>${token}</mark>`
          }
          return token
        })
        .join(" ")
      if (hasMatch) {
        highlights[field] = [highlighted]
      }
    }
    return highlights
  }

  stats(): { docCount: number; fieldCount: number; termCount: number } {
    let termCount = 0
    for (const fieldIndex of this.fieldIndexes.values()) {
      termCount += fieldIndex.postings.size
    }
    return {
      docCount: this.documents.size,
      fieldCount: this.fieldIndexes.size,
      termCount,
    }
  }
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[b.length][a.length]
}
