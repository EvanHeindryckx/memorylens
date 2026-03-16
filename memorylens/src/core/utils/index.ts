// --- URL / Domain ---
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

export function isExcluded(url: string, excludedDomains: string[]): boolean {
  if (!url.startsWith('http')) return true
  const domain = extractDomain(url)
  return excludedDomains.some(ex => domain.includes(ex) || url.includes(ex))
}

export function getFavicon(url: string): string {
  try {
    const origin = new URL(url).origin
    return `${origin}/favicon.ico`
  } catch {
    return ''
  }
}

// --- Text ---
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

export function cleanText(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')   // 1. réduire les sauts de ligne excessifs
    .replace(/[^\S\n]+/g, ' ')    // 2. normaliser les espaces SANS toucher aux \n
    .trim()
}

export function extractSnippet(content: string, query: string, length = 200): string {
  const lower = content.toLowerCase()
  const words = query.toLowerCase().split(' ').filter(w => w.length > 2)
  for (const word of words) {
    const idx = lower.indexOf(word)
    if (idx !== -1) {
      const start = Math.max(0, idx - 60)
      const end = Math.min(content.length, idx + length)
      return (start > 0 ? '…' : '') + content.slice(start, end).trim() + '…'
    }
  }
  return truncate(content, length)
}

// --- Time ---
export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7) return `Il y a ${days}j`
  return new Date(timestamp).toLocaleDateString('fr-FR')
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h${mins % 60}m`
}

// --- ID ---
export function generateId(): string {
  return crypto.randomUUID()
}

// --- Category detection ---
export function detectCategory(url: string, title: string): import('@/types/page.types').PageCategory {
  const u = url.toLowerCase()
  const t = title.toLowerCase()
  if (u.includes('youtube.com') || u.includes('vimeo.com') || u.includes('twitch.tv') || u.includes('dailymotion.com')) return 'video'
  if (u.includes('github.com') || u.includes('stackoverflow.com') || u.includes('docs.') || u.includes('/docs/') || u.includes('mdn') || u.includes('devdocs')) return 'documentation'
  // ⚠️ article AVANT product : substack/medium/blog/dev.to avant les patterns génériques /p/ /product
  if (u.includes('medium.com') || u.includes('substack.com') || u.includes('dev.to') || u.includes('/blog/') || u.includes('/article/') || u.includes('/post/') || t.includes('–') || t.includes(' - ')) return 'article'
  if (u.includes('amazon.') || u.includes('cdiscount') || u.includes('fnac') || u.includes('/product') || u.includes('/products/') || u.includes('leboncoin') || u.includes('etsy.com')) return 'product'
  if (u.includes('twitter.com') || u.includes('x.com') || u.includes('linkedin.com') || u.includes('facebook.com') || u.includes('instagram.com') || u.includes('reddit.com') || u.includes('tiktok.com')) return 'social'
  if (u.includes('figma.com') || u.includes('notion.so') || u.includes('airtable.com') || u.includes('trello.com') || u.includes('linear.app') || u.includes('miro.com') || u.includes('canva.com')) return 'tool'
  return 'other'
}
