import { useState, useEffect, useCallback } from 'react'
import { getRecentPages, deletePage, updatePageNotes, getTotalCount } from '@/core/db/pages-store'
import type { SavedPage } from '@/types/page.types'

export function useHistory(limit = 50) {
  const [pages, setPages] = useState<SavedPage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [recent, count] = await Promise.all([
      getRecentPages(limit),
      getTotalCount(),
    ])
    setPages(recent)
    setTotal(count)
    setLoading(false)
  }, [limit])

  useEffect(() => { load() }, [load])

  const remove = useCallback(async (id: string) => {
    await deletePage(id)
    setPages(prev => prev.filter(p => p.id !== id))
    setTotal(prev => prev - 1)
  }, [])

  const addNote = useCallback(async (id: string, notes: string) => {
    await updatePageNotes(id, notes)
    setPages(prev => prev.map(p => p.id === id ? { ...p, notes } : p))
  }, [])

  // Patch local — appelé par PageCard après pin/tags/notes
  const update = useCallback((id: string, patch: Partial<SavedPage>) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }, [])

  return { pages, total, loading, load, remove, addNote, update }
}
