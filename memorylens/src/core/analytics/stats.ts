import { getAllPages } from '@/core/db/pages-store'
import type { DomainStat, DayStat } from '@/types/page.types'

export async function getDomainStats(days = 30): Promise<DomainStat[]> {
  const cutoff = Date.now() - days * 86400_000
  const pages = (await getAllPages()).filter(p => p.visitedAt >= cutoff)

  const map: Record<string, DomainStat> = {}
  for (const p of pages) {
    if (!map[p.domain]) {
      map[p.domain] = { domain: p.domain, count: 0, totalDuration: 0, favicon: p.favicon }
    }
    map[p.domain].count++
    map[p.domain].totalDuration += p.duration
  }

  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10)
}

export async function getDayStats(days = 30): Promise<DayStat[]> {
  const cutoff = Date.now() - days * 86400_000
  const pages = (await getAllPages()).filter(p => p.visitedAt >= cutoff)

  const map: Record<string, DayStat> = {}
  for (const p of pages) {
    const date = new Date(p.visitedAt).toISOString().slice(0, 10)
    if (!map[date]) map[date] = { date, count: 0, totalDuration: 0 }
    map[date].count++
    map[date].totalDuration += p.duration
  }

  // Remplir les jours vides
  const result: DayStat[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000)
    const date = d.toISOString().slice(0, 10)
    result.push(map[date] ?? { date, count: 0, totalDuration: 0 })
  }
  return result
}

export async function getTopCategories(days = 30): Promise<{ category: string; count: number }[]> {
  const cutoff = Date.now() - days * 86400_000
  const pages = (await getAllPages()).filter(p => p.visitedAt >= cutoff)
  const map: Record<string, number> = {}
  for (const p of pages) {
    map[p.category] = (map[p.category] ?? 0) + 1
  }
  return Object.entries(map)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getWeeklyPace(): Promise<{ thisWeek: number; lastWeek: number }> {
  const now = Date.now()
  const pages = await getAllPages()
  const thisWeek = pages.filter(p => p.visitedAt >= now - 7 * 86400_000).length
  const lastWeek = pages.filter(p =>
    p.visitedAt >= now - 14 * 86400_000 && p.visitedAt < now - 7 * 86400_000
  ).length
  return { thisWeek, lastWeek }
}

export async function getStreak(): Promise<number> {
  const pages = await getAllPages()
  // ⚠️ Utiliser toLocaleDateString pour respecter le fuseau horaire local
  //    (toISOString() est UTC → décalage à minuit selon la timezone)
  const days = new Set(
    pages.map(p => new Date(p.visitedAt).toLocaleDateString('fr-CA')) // 'fr-CA' → format YYYY-MM-DD en local
  )
  let streak = 0
  let d = new Date()
  // Si aujourd'hui est encore vide, commencer à vérifier depuis hier
  const todayStr = d.toLocaleDateString('fr-CA')
  if (!days.has(todayStr)) {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  }
  while (true) {
    const key = d.toLocaleDateString('fr-CA')
    if (!days.has(key)) break
    streak++
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  }
  return streak
}

export async function getPeakHour(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 86400_000
  const pages = (await getAllPages()).filter(p => p.visitedAt >= cutoff)
  const hours = new Array(24).fill(0)
  for (const p of pages) hours[new Date(p.visitedAt).getHours()]++
  return hours.indexOf(Math.max(...hours))
}

export async function getTotalReadTime(): Promise<number> {
  const pages = await getAllPages()
  return pages.reduce((s, p) => s + (p.duration ?? 0), 0)
}
