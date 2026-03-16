import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchPages, keywordSearch } from '@/core/search/vector-search'
import type { SavedPage } from '@/types/page.types'

// ── Fixtures ──────────────────────────────────────────────────────────────────
function makePage(overrides: Partial<SavedPage>): SavedPage {
  return {
    id: 'test-id',
    url: 'https://example.com',
    title: 'Test Page',
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

// ── Mock pages-store ──────────────────────────────────────────────────────────
vi.mock('@/core/db/pages-store', () => ({
  getAllPages: vi.fn(),
}))

import { getAllPages } from '@/core/db/pages-store'
const mockGetAllPages = getAllPages as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGetAllPages.mockReset()
})

// ── searchPages ───────────────────────────────────────────────────────────────
describe('searchPages', () => {
  it('retourne les pages triées par score décroissant', async () => {
    const pageA = makePage({
      id: 'a',
      title: 'React hooks tutorial',
      content: 'Learn about React hooks in depth',
      summary: 'React hooks guide',
      // embedding orthogonal → cosine = 0, mais keyword fort
      embedding: [1, 0],
    })
    const pageB = makePage({
      id: 'b',
      title: 'Vue.js introduction',
      content: 'Getting started with Vue',
      summary: 'Vue guide',
      embedding: [0, 1],
    })

    mockGetAllPages.mockResolvedValue([pageA, pageB])

    // queryEmbedding proche de pageA ([1,0])
    const results = await searchPages([1, 0], 'react hooks', 10)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].page.id).toBe('a')
    expect(results[0].score).toBeGreaterThan(results[1]?.score ?? -1)
  })

  it('filtre les pages sans embedding', async () => {
    const withEmbed = makePage({ id: 'x', embedding: [1, 0], title: 'React', content: 'React content' })
    const noEmbed   = makePage({ id: 'y', embedding: [], title: 'Vue', content: 'Vue content' })

    mockGetAllPages.mockResolvedValue([withEmbed, noEmbed])

    const results = await searchPages([1, 0], 'react', 10)
    const ids = results.map(r => r.page.id)
    expect(ids).toContain('x')
    expect(ids).not.toContain('y')
  })

  it('respecte la limite de résultats', async () => {
    const pages = Array.from({ length: 20 }, (_, i) =>
      makePage({
        id: `p${i}`,
        title: `Page ${i} about react`,
        content: `Content about react ${i}`,
        embedding: [1, 0],
      })
    )
    mockGetAllPages.mockResolvedValue(pages)

    const results = await searchPages([1, 0], 'react', 5)
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('retourne [] si aucune page', async () => {
    mockGetAllPages.mockResolvedValue([])
    const results = await searchPages([1, 0], 'react', 10)
    expect(results).toEqual([])
  })
})

// ── keywordSearch ─────────────────────────────────────────────────────────────
describe('keywordSearch', () => {
  it('trouve les pages par mot-clé dans le titre', async () => {
    const pages = [
      makePage({ id: '1', title: 'TypeScript advanced types', content: 'Deep dive into TypeScript' }),
      makePage({ id: '2', title: 'CSS Grid layout', content: 'Modern CSS techniques' }),
    ]
    mockGetAllPages.mockResolvedValue(pages)

    const results = await keywordSearch('typescript', 10)
    expect(results.length).toBe(1)
    expect(results[0].page.id).toBe('1')
  })

  it('trouve les pages par mot-clé dans le contenu', async () => {
    const pages = [
      makePage({ id: '1', title: 'Blog post', content: 'This article covers async await patterns in JavaScript' }),
      makePage({ id: '2', title: 'Other post', content: 'Unrelated content about cooking' }),
    ]
    mockGetAllPages.mockResolvedValue(pages)

    const results = await keywordSearch('async await', 10)
    expect(results.some(r => r.page.id === '1')).toBe(true)
  })

  it('retourne un snippet non vide', async () => {
    const pages = [
      makePage({ id: '1', title: 'Guide React', content: 'Learn React hooks and components thoroughly' }),
    ]
    mockGetAllPages.mockResolvedValue(pages)

    const results = await keywordSearch('react', 10)
    expect(results[0].snippet.length).toBeGreaterThan(0)
  })

  it('ignore les mots de moins de 3 caractères', async () => {
    const pages = [
      makePage({ id: '1', title: 'Page A', content: 'Some content here' }),
    ]
    mockGetAllPages.mockResolvedValue(pages)

    // "to" et "be" sont ignorés (< 3 chars)
    const results = await keywordSearch('to be', 10)
    expect(results).toEqual([])
  })

  it('retourne [] si aucune page', async () => {
    mockGetAllPages.mockResolvedValue([])
    const results = await keywordSearch('test', 10)
    expect(results).toEqual([])
  })
})
