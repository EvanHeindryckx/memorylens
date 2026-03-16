import { getAllPages } from '@/core/db/pages-store'
import { extractSnippet } from '@/core/utils'
import type { SearchResult } from '@/types/page.types'

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function keywordScore(text: string, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const lower = text.toLowerCase()
  let hits = 0
  for (const word of words) {
    if (lower.includes(word)) hits++
  }
  return words.length > 0 ? hits / words.length : 0
}

export async function searchPages(
  queryEmbedding: number[],
  queryText: string,
  limit = 20
): Promise<SearchResult[]> {
  const pages = await getAllPages()

  const hasQueryEmbedding = queryEmbedding.length > 0

  const scored = pages
    .filter(p => p.embedding && p.embedding.length > 0)
    .map(page => {
      const vecScore = hasQueryEmbedding
        ? cosineSimilarity(queryEmbedding, page.embedding)
        : 0
      const kwScore = keywordScore(
        `${page.title} ${page.content} ${page.summary}`,
        queryText
      )
      // Hybride : 70% sémantique + 30% keyword (si embedding dispo)
      // Sinon : 100% keyword
      const score = hasQueryEmbedding
        ? vecScore * 0.7 + kwScore * 0.3
        : kwScore
      const snippet = extractSnippet(
        page.content || page.summary || page.title,
        queryText
      )
      return { page, score, snippet }
    })
    // Seuil adaptatif : 0.1 pour hybride, 0.3 pour keyword seul
    .filter(r => r.score > (hasQueryEmbedding ? 0.1 : 0.3))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}

// Recherche keyword pure (fallback sans embedding)
export async function keywordSearch(
  queryText: string,
  limit = 20
): Promise<SearchResult[]> {
  const pages = await getAllPages()
  const scored = pages
    .map(page => {
      const score = keywordScore(
        `${page.title} ${page.content} ${page.summary}`,
        queryText
      )
      const snippet = extractSnippet(
        page.content || page.summary || page.title,
        queryText
      )
      return { page, score, snippet }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}
