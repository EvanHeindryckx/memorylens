import { getAllPages } from '@/core/db/pages-store'
import { getAllCollections } from '@/core/db/collections-store'
import type { SavedPage, Collection } from '@/types/page.types'

const EXPORT_VERSION = '1.7'

export async function exportToJSON(): Promise<void> {
  const [pages, collections] = await Promise.all([getAllPages(), getAllCollections()])
  const data = { exportedAt: new Date().toISOString(), version: EXPORT_VERSION, pages, collections }
  downloadFile(JSON.stringify(data, null, 2), 'memorylens-export.json', 'application/json')
}

export async function exportToCSV(): Promise<void> {
  const pages = await getAllPages()
  const headers = ['title', 'url', 'domain', 'visitedAt', 'duration', 'category', 'tags', 'summary', 'notes']
  const rows = pages.map(p => [
    csvEscape(p.title),
    csvEscape(p.url),
    csvEscape(p.domain),
    new Date(p.visitedAt).toISOString(),
    String(p.duration),
    p.category,
    csvEscape((p.tags ?? []).join('; ')),
    csvEscape(p.summary),
    csvEscape(p.notes),
  ])
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  downloadFile(csv, 'memorylens-export.csv', 'text/csv')
}

export async function importFromJSON(file: File): Promise<{ pages: number; collections: number }> {
  const text = await file.text()

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Fichier JSON invalide')
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('Format de fichier non reconnu')
  }

  const { pages, collections } = data as { pages?: unknown; collections?: unknown }

  if (!Array.isArray(pages)) {
    throw new Error('Le fichier ne contient pas de tableau "pages" valide')
  }

  // Validation minimale de chaque page avant import
  const validPages = (pages as unknown[]).filter((p): p is SavedPage => {
    return (
      typeof p === 'object' && p !== null &&
      typeof (p as SavedPage).id === 'string' &&
      typeof (p as SavedPage).url === 'string' &&
      typeof (p as SavedPage).title === 'string'
    )
  })

  const validCollections = Array.isArray(collections)
    ? (collections as unknown[]).filter((c): c is Collection => {
        return (
          typeof c === 'object' && c !== null &&
          typeof (c as Collection).id === 'string' &&
          typeof (c as Collection).name === 'string'
        )
      })
    : []

  const { savePage } = await import('@/core/db/pages-store')
  const { saveCollection } = await import('@/core/db/collections-store')

  for (const p of validPages) await savePage(p)
  for (const c of validCollections) await saveCollection(c)

  return { pages: validPages.length, collections: validCollections.length }
}

function csvEscape(val: string): string {
  const str = String(val ?? '').replace(/"/g, '""')
  return `"${str}"`
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
