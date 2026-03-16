import { describe, it, expect } from 'vitest'
import {
  extractDomain,
  isExcluded,
  getFavicon,
  truncate,
  cleanText,
  extractSnippet,
  timeAgo,
  formatDuration,
  generateId,
  detectCategory,
} from '@/core/utils'

// ── extractDomain ─────────────────────────────────────────────────────────────
describe('extractDomain', () => {
  it('extrait le domaine sans www', () => {
    expect(extractDomain('https://www.github.com/user/repo')).toBe('github.com')
  })
  it('extrait le domaine simple', () => {
    expect(extractDomain('https://notion.so/page')).toBe('notion.so')
  })
  it('retourne "" pour une URL invalide', () => {
    expect(extractDomain('not-a-url')).toBe('')
  })
})

// ── isExcluded ────────────────────────────────────────────────────────────────
describe('isExcluded', () => {
  const excluded = ['accounts.google.com', 'login.', 'localhost']

  it('exclut une URL non-http', () => {
    expect(isExcluded('chrome://settings', excluded)).toBe(true)
  })
  it('exclut un domaine dans la liste', () => {
    expect(isExcluded('https://accounts.google.com/signin', excluded)).toBe(true)
  })
  it('exclut localhost', () => {
    expect(isExcluded('http://localhost:3000', excluded)).toBe(true)
  })
  it('ne pas exclure une URL normale', () => {
    expect(isExcluded('https://github.com', excluded)).toBe(false)
  })
})

// ── getFavicon ────────────────────────────────────────────────────────────────
describe('getFavicon', () => {
  it('retourne le chemin favicon.ico de l\'origin', () => {
    expect(getFavicon('https://github.com/user/repo')).toBe('https://github.com/favicon.ico')
  })
  it('retourne "" pour une URL invalide', () => {
    expect(getFavicon('invalid')).toBe('')
  })
})

// ── truncate ──────────────────────────────────────────────────────────────────
describe('truncate', () => {
  it('ne tronque pas si texte ≤ max', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })
  it('tronque et ajoute "…"', () => {
    const result = truncate('hello world', 5)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(6)
  })
})

// ── cleanText ─────────────────────────────────────────────────────────────────
describe('cleanText', () => {
  it('normalise les espaces multiples', () => {
    expect(cleanText('hello   world')).toBe('hello world')
  })
  it('réduit les sauts de ligne excessifs', () => {
    const result = cleanText('line1\n\n\n\nline2')
    expect(result).toBe('line1\n\nline2')
  })
  it('supprime les espaces en début/fin', () => {
    expect(cleanText('  hello  ')).toBe('hello')
  })
})

// ── extractSnippet ────────────────────────────────────────────────────────────
describe('extractSnippet', () => {
  it('retourne un extrait contenant le mot recherché', () => {
    const content = 'React is a JavaScript library for building user interfaces'
    const snippet = extractSnippet(content, 'library')
    expect(snippet).toContain('library')
  })
  it('tronque le contenu si le mot est absent', () => {
    const content = 'A'.repeat(300)
    const snippet = extractSnippet(content, 'xyz')
    expect(snippet.length).toBeLessThanOrEqual(205) // 200 + "…"
  })
})

// ── timeAgo ───────────────────────────────────────────────────────────────────
describe('timeAgo', () => {
  it('retourne "À l\'instant" pour < 1 min', () => {
    expect(timeAgo(Date.now() - 30_000)).toBe("À l'instant")
  })
  it('retourne "Il y a X min"', () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe('Il y a 5 min')
  })
  it('retourne "Il y a Xh"', () => {
    expect(timeAgo(Date.now() - 3 * 3600_000)).toBe('Il y a 3h')
  })
  it('retourne "Il y a Xj"', () => {
    expect(timeAgo(Date.now() - 2 * 86400_000)).toBe('Il y a 2j')
  })
})

// ── formatDuration ────────────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('secondes seules', () => {
    expect(formatDuration(45)).toBe('45s')
  })
  it('minutes', () => {
    expect(formatDuration(90)).toBe('1 min')
  })
  it('heures + minutes', () => {
    expect(formatDuration(3690)).toBe('1h1m')
  })
})

// ── generateId ────────────────────────────────────────────────────────────────
describe('generateId', () => {
  it('génère un UUID v4 valide', () => {
    const id = generateId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })
  it('génère des IDs uniques', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

// ── detectCategory ────────────────────────────────────────────────────────────
describe('detectCategory', () => {
  it('détecte video (YouTube)', () => {
    expect(detectCategory('https://youtube.com/watch?v=abc', 'Une vidéo')).toBe('video')
  })
  it('détecte video (Twitch)', () => {
    expect(detectCategory('https://twitch.tv/streamer', 'Live')).toBe('video')
  })
  it('ne classe PAS "video" si le mot est juste dans le titre', () => {
    // Faux positif corrigé : "How to avoid video game addiction" ne doit pas être 'video'
    expect(detectCategory('https://example.com/article', 'How to avoid video game addiction')).toBe('other')
  })
  it('détecte documentation (GitHub)', () => {
    expect(detectCategory('https://github.com/user/repo', 'Repo')).toBe('documentation')
  })
  it('détecte documentation (docs.)', () => {
    expect(detectCategory('https://docs.react.dev/learn', 'React Docs')).toBe('documentation')
  })
  it('détecte product (Amazon)', () => {
    expect(detectCategory('https://amazon.fr/dp/B0001', 'Produit')).toBe('product')
  })
  it('détecte product (Etsy)', () => {
    expect(detectCategory('https://etsy.com/listing/123', 'Handmade item')).toBe('product')
  })
  it('détecte social (Twitter)', () => {
    expect(detectCategory('https://twitter.com/user', 'Tweet')).toBe('social')
  })
  it('détecte social (Reddit)', () => {
    expect(detectCategory('https://reddit.com/r/programming', 'Thread')).toBe('social')
  })
  it('détecte tool (Notion)', () => {
    expect(detectCategory('https://notion.so/page', 'Ma page')).toBe('tool')
  })
  it('détecte tool (Linear)', () => {
    expect(detectCategory('https://linear.app/team/issue', 'Bug')).toBe('tool')
  })
  it('détecte article (Medium)', () => {
    expect(detectCategory('https://medium.com/post', 'How to code - Guide')).toBe('article')
  })
  it('détecte article (Substack)', () => {
    expect(detectCategory('https://newsletter.substack.com/p/edition', 'Newsletter')).toBe('article')
  })
  it('retourne "other" par défaut', () => {
    expect(detectCategory('https://example.com', 'Page')).toBe('other')
  })
})
