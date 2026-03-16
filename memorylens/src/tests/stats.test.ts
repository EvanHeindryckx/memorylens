import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getDomainStats,
  getDayStats,
  getTopCategories,
  getWeeklyPace,
  getStreak,
  getPeakHour,
  getTotalReadTime,
} from '@/core/analytics/stats'
import type { SavedPage } from '@/types/page.types'

// ── Mock pages-store ──────────────────────────────────────────────────────────
vi.mock('@/core/db/pages-store', () => ({
  getAllPages: vi.fn(),
}))

import { getAllPages } from '@/core/db/pages-store'
const mockGetAllPages = getAllPages as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGetAllPages.mockReset()
})

// ── Fixture ───────────────────────────────────────────────────────────────────
function makePage(overrides: Partial<SavedPage>): SavedPage {
  return {
    id: 'id',
    url: 'https://example.com',
    title: 'Title',
    domain: 'example.com',
    visitedAt: Date.now(),
    duration: 60,
    summary: '',
    content: '',
    embedding: [],
    category: 'other',
    tags: [],
    notes: '',
    favicon: '',
    ...overrides,
  }
}

const NOW = Date.now()
const DAY = 86_400_000

// ── getDomainStats ────────────────────────────────────────────────────────────
describe('getDomainStats', () => {
  it('agrège correctement par domaine', async () => {
    mockGetAllPages.mockResolvedValue([
      makePage({ domain: 'github.com', visitedAt: NOW, duration: 30 }),
      makePage({ domain: 'github.com', visitedAt: NOW, duration: 90 }),
      makePage({ domain: 'notion.so',  visitedAt: NOW, duration: 60 }),
    ])
    const stats = await getDomainStats(30)
    const gh = stats.find(s => s.domain === 'github.com')!
    expect(gh.count).toBe(2)
    expect(gh.totalDuration).toBe(120)
  })

  it('ignore les pages hors fenêtre de temps', async () => {
    mockGetAllPages.mockResolvedValue([
      makePage({ domain: 'old.com', visitedAt: NOW - 40 * DAY }),
      makePage({ domain: 'new.com', visitedAt: NOW }),
    ])
    const stats = await getDomainStats(30)
    expect(stats.find(s => s.domain === 'old.com')).toBeUndefined()
    expect(stats.find(s => s.domain === 'new.com')).toBeDefined()
  })

  it('limite à 10 domaines', async () => {
    const pages = Array.from({ length: 15 }, (_, i) =>
      makePage({ domain: `site${i}.com`, visitedAt: NOW })
    )
    mockGetAllPages.mockResolvedValue(pages)
    const stats = await getDomainStats(30)
    expect(stats.length).toBeLessThanOrEqual(10)
  })

  it('retourne [] si aucune page', async () => {
    mockGetAllPages.mockResolvedValue([])
    expect(await getDomainStats()).toEqual([])
  })
})

// ── getDayStats ───────────────────────────────────────────────────────────────
describe('getDayStats', () => {
  it('retourne exactement N jours', async () => {
    mockGetAllPages.mockResolvedValue([])
    const stats = await getDayStats(7)
    expect(stats.length).toBe(7)
  })

  it('remplit les jours vides avec count=0', async () => {
    mockGetAllPages.mockResolvedValue([])
    const stats = await getDayStats(7)
    expect(stats.every(d => d.count === 0)).toBe(true)
  })

  it('incrémente le count pour les pages du jour', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockGetAllPages.mockResolvedValue([
      makePage({ visitedAt: NOW }),
      makePage({ visitedAt: NOW }),
    ])
    const stats = await getDayStats(7)
    const todayStat = stats.find(d => d.date === today)
    expect(todayStat?.count).toBe(2)
  })
})

// ── getTopCategories ──────────────────────────────────────────────────────────
describe('getTopCategories', () => {
  it('trie par count décroissant', async () => {
    mockGetAllPages.mockResolvedValue([
      makePage({ category: 'video',         visitedAt: NOW }),
      makePage({ category: 'video',         visitedAt: NOW }),
      makePage({ category: 'documentation', visitedAt: NOW }),
    ])
    const cats = await getTopCategories(30)
    expect(cats[0].category).toBe('video')
    expect(cats[0].count).toBe(2)
  })

  it('retourne [] si aucune page', async () => {
    mockGetAllPages.mockResolvedValue([])
    expect(await getTopCategories()).toEqual([])
  })
})

// ── getWeeklyPace ─────────────────────────────────────────────────────────────
describe('getWeeklyPace', () => {
  it('distingue cette semaine et la semaine dernière', async () => {
    mockGetAllPages.mockResolvedValue([
      makePage({ visitedAt: NOW - 1 * DAY }),           // cette semaine
      makePage({ visitedAt: NOW - 2 * DAY }),           // cette semaine
      makePage({ visitedAt: NOW - 8 * DAY }),           // semaine dernière
    ])
    const { thisWeek, lastWeek } = await getWeeklyPace()
    expect(thisWeek).toBe(2)
    expect(lastWeek).toBe(1)
  })

  it('retourne 0/0 si aucune page', async () => {
    mockGetAllPages.mockResolvedValue([])
    const { thisWeek, lastWeek } = await getWeeklyPace()
    expect(thisWeek).toBe(0)
    expect(lastWeek).toBe(0)
  })
})

// ── getStreak ─────────────────────────────────────────────────────────────────
describe('getStreak', () => {
  it('retourne 0 si aucune page', async () => {
    mockGetAllPages.mockResolvedValue([])
    expect(await getStreak()).toBe(0)
  })

  it('compte les jours consécutifs', async () => {
    // Générer des pages sur 3 jours consécutifs en heure locale
    const pages = [0, 1, 2].map(i => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(12, 0, 0, 0) // midi → jamais ambigu entre UTC et local
      return makePage({ visitedAt: d.getTime() })
    })
    mockGetAllPages.mockResolvedValue(pages)
    expect(await getStreak()).toBeGreaterThanOrEqual(3)
  })

  it("s'arrête à un jour manquant", async () => {
    // Aujourd'hui + il y a 2 jours → pas de page hier → streak = 1
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    twoDaysAgo.setHours(12, 0, 0, 0)
    mockGetAllPages.mockResolvedValue([
      makePage({ visitedAt: today.getTime() }),
      makePage({ visitedAt: twoDaysAgo.getTime() }),
    ])
    expect(await getStreak()).toBe(1)
  })
})

// ── getPeakHour ───────────────────────────────────────────────────────────────
describe('getPeakHour', () => {
  it('retourne l\'heure avec le plus de visites', async () => {
    const target = 14 // 14h
    const pages = Array.from({ length: 5 }, () => {
      const d = new Date()
      d.setHours(target, 0, 0, 0)
      return makePage({ visitedAt: d.getTime() })
    })
    pages.push(makePage({ visitedAt: (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d.getTime() })() }))
    mockGetAllPages.mockResolvedValue(pages)

    const peak = await getPeakHour(30)
    expect(peak).toBe(target)
  })
})

// ── getTotalReadTime ──────────────────────────────────────────────────────────
describe('getTotalReadTime', () => {
  it('somme toutes les durées', async () => {
    mockGetAllPages.mockResolvedValue([
      makePage({ duration: 100 }),
      makePage({ duration: 200 }),
      makePage({ duration: 300 }),
    ])
    expect(await getTotalReadTime()).toBe(600)
  })

  it('retourne 0 si aucune page', async () => {
    mockGetAllPages.mockResolvedValue([])
    expect(await getTotalReadTime()).toBe(0)
  })
})
