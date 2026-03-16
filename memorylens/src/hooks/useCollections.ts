import { useState, useEffect, useCallback } from 'react'
import {
  getAllCollections, saveCollection,
  deleteCollection, addPageToCollection, removePageFromCollection
} from '@/core/db/collections-store'
import { getAllPages } from '@/core/db/pages-store'
import type { Collection, SavedPage } from '@/types/page.types'

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setCollections(await getAllCollections())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (name: string, color: string, icon: string) => {
    const col: Collection = {
      id: crypto.randomUUID(),
      name, color, icon,
      pageIds: [],
      createdAt: Date.now(),
    }
    await saveCollection(col)
    setCollections(prev => [...prev, col])
    return col
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteCollection(id)
    setCollections(prev => prev.filter(c => c.id !== id))
  }, [])

  const addPage = useCallback(async (colId: string, pageId: string) => {
    await addPageToCollection(colId, pageId)
    setCollections(prev => prev.map(c =>
      c.id === colId && !c.pageIds.includes(pageId)
        ? { ...c, pageIds: [...c.pageIds, pageId] }
        : c
    ))
  }, [])

  const removePage = useCallback(async (colId: string, pageId: string) => {
    await removePageFromCollection(colId, pageId)
    setCollections(prev => prev.map(c =>
      c.id === colId ? { ...c, pageIds: c.pageIds.filter(id => id !== pageId) } : c
    ))
  }, [])

  const getPagesForCollection = useCallback(async (colId: string): Promise<SavedPage[]> => {
    const col = collections.find(c => c.id === colId)
    if (!col || col.pageIds.length === 0) return []
    // Charger uniquement les pages de la collection via getPage (1 appel par page)
    // plutôt que getAllPages() qui charge tout le store
    const { getPage } = await import('@/core/db/pages-store')
    const results = await Promise.all(col.pageIds.map(id => getPage(id)))
    return results.filter((p): p is SavedPage => p !== undefined)
  }, [collections])

  return { collections, loading, load, create, remove, addPage, removePage, getPagesForCollection }
}
