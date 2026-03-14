import type { TextSearchStore } from '../text-search-store'
import type { TextSearchOpts, TextSearchResult } from '../types'

interface LocalDoc {
  fields: Record<string, string>
  metadata?: Record<string, unknown>
}

/** BM25 parameters (standard defaults) */
const K1 = 1.2
const B = 0.75
const WORD_RE = /\w+/g

/**
 * LocalTextSearchStore — Zero-dependency, in-memory TextSearchStore with BM25 ranking.
 *
 * Indexes documents by multiple text fields and performs case-insensitive
 * word matching with BM25 scoring. No file persistence — rebuilt
 * from graph data each session. Suitable as a better-sqlite3 FTS fallback.
 */
export class LocalTextSearchStore implements TextSearchStore {
  private docs: Map<string, LocalDoc> = new Map()

  async open(_config: unknown): Promise<void> {
    this.docs = new Map()
  }

  async close(): Promise<void> {
    this.docs = new Map()
  }

  async index(
    id: string,
    fields: Record<string, string>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.docs.set(id, { fields, metadata })
  }

  async remove(id: string): Promise<void> {
    this.docs.delete(id)
  }

  async search(query: string, opts?: TextSearchOpts): Promise<TextSearchResult[]> {
    const terms = tokenize(query)
    if (terms.length === 0)
      return []

    const topK = opts?.topK ?? 50
    const fieldFilter = opts?.fields

    // Collect all field texts per document for BM25 corpus stats
    const corpus: Array<{ id: string, doc: LocalDoc, tokens: string[] }> = []
    for (const [id, doc] of this.docs) {
      const fieldEntries = fieldFilter
        ? Object.entries(doc.fields).filter(([k]) => fieldFilter.includes(k))
        : Object.entries(doc.fields)
      const tokens = fieldEntries.flatMap(([, v]) => tokenize(v))
      corpus.push({ id, doc, tokens })
    }

    const N = corpus.length
    if (N === 0)
      return []

    const avgdl = corpus.reduce((sum, d) => sum + d.tokens.length, 0) / N
    if (avgdl === 0)
      return []

    // Compute document frequency for each query term (prefix matching)
    const df = new Map<string, number>()
    for (const term of terms) {
      let count = 0
      for (const entry of corpus) {
        if (entry.tokens.some(t => t.startsWith(term)))
          count++
      }
      df.set(term, count)
    }

    const results: TextSearchResult[] = []

    for (const entry of corpus) {
      const dl = entry.tokens.length
      if (dl === 0)
        continue

      let score = 0
      for (const term of terms) {
        const tf = entry.tokens.filter(t => t.startsWith(term)).length
        if (tf === 0)
          continue
        const n = df.get(term) ?? 0
        const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1)
        score += idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * dl / avgdl))
      }

      if (score > 0) {
        results.push({ id: entry.id, score, fields: entry.doc.fields })
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  async indexBatch(docs: Array<{ id: string, fields: Record<string, string> }>): Promise<void> {
    for (const doc of docs) {
      this.docs.set(doc.id, { fields: doc.fields })
    }
  }
}

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(WORD_RE)
  return matches ?? []
}
