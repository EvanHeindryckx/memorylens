import { useState, useCallback, useRef } from 'react'
import { searchPages, keywordSearch } from '@/core/search/vector-search'
import type { SearchResult } from '@/types/page.types'

// Embedding via offscreen
async function getQueryEmbedding(text: string): Promise<number[]> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_EMBEDDING', payload: { text } },
      (response: { success: boolean; embedding: number[] }) => {
        if (chrome.runtime.lastError || !response?.embedding) {
          resolve([])
        } else {
          resolve(response.embedding)
        }
      }
    )
  })
}

const DEBOUNCE_MS = 300

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    setQuery(q)

    // Annuler le timer précédent
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    // Afficher le spinner immédiatement pour le feedback visuel
    setLoading(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const embedding = await getQueryEmbedding(q)
        const found = embedding.length > 0
          ? await searchPages(embedding, q)
          : await keywordSearch(q)
        setResults(found)
      } catch {
        const found = await keywordSearch(q)
        setResults(found)
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
  }, [])

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setResults([])
    setQuery('')
    setLoading(false)
  }, [])

  return { results, loading, query, search, clear }
}
