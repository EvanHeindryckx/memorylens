import { useState, useEffect, useCallback } from 'react'
import { getDomainStats, getDayStats, getTopCategories, getWeeklyPace } from '@/core/analytics/stats'
import type { DomainStat, DayStat } from '@/types/page.types'

export function useAnalytics(days = 30) {
  const [domainStats, setDomainStats] = useState<DomainStat[]>([])
  const [dayStats, setDayStats] = useState<DayStat[]>([])
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([])
  const [pace, setPace] = useState<{ thisWeek: number; lastWeek: number }>({ thisWeek: 0, lastWeek: 0 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [d, s, c, p] = await Promise.all([
      getDomainStats(days),
      getDayStats(days),
      getTopCategories(days),
      getWeeklyPace(),
    ])
    setDomainStats(d)
    setDayStats(s)
    setCategories(c)
    setPace(p)
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  return { domainStats, dayStats, categories, pace, loading, load }
}
