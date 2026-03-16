import { useState, useEffect, useCallback } from 'react'
import { getResurfaceItems } from '@/core/resuface/resuface'
import type { ResurfaceItem } from '@/types/page.types'

export function useResuface() {
  const [items, setItems] = useState<ResurfaceItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setItems(await getResurfaceItems(3))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { items, loading, load }
}
