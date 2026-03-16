import { getDB } from './database'
import type { SavedPage } from '@/types/page.types'

export async function savePage(page: SavedPage): Promise<void> {
  const db = await getDB()
  await db.put('pages', page)
}

export async function getPage(id: string): Promise<SavedPage | undefined> {
  const db = await getDB()
  return db.get('pages', id)
}

export async function getPageByUrl(url: string): Promise<SavedPage | undefined> {
  const db = await getDB()
  return db.getFromIndex('pages', 'by_url', url)
}

export async function getAllPages(): Promise<SavedPage[]> {
  const db = await getDB()
  return db.getAll('pages')
}

export async function getRecentPages(limit = 50): Promise<SavedPage[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('pages', 'by_visited')
  return all.reverse().slice(0, limit)
}

export async function getTotalCount(): Promise<number> {
  const db = await getDB()
  return db.count('pages')
}

export async function deleteOldPages(retentionDays: number): Promise<number> {
  const db = await getDB()
  const cutoff = Date.now() - retentionDays * 86_400_000
  const all = await db.getAllFromIndex('pages', 'by_visited')
  const old = all.filter(p => p.visitedAt < cutoff)
  for (const p of old) await db.delete('pages', p.id)
  return old.length
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pages', id)
}

export async function deleteAllPages(): Promise<void> {
  const db = await getDB()
  await db.clear('pages')
}

export async function searchPagesByDomain(domain: string): Promise<SavedPage[]> {
  const db = await getDB()
  return db.getAllFromIndex('pages', 'by_domain', domain)
}

export async function togglePinPage(id: string): Promise<boolean> {
  const db = await getDB()
  const page = await db.get('pages', id)
  if (!page) return false
  const next = !page.pinned
  await db.put('pages', { ...page, pinned: next })
  return next
}

export async function updatePageTags(id: string, tags: string[]): Promise<void> {
  const db = await getDB()
  const page = await db.get('pages', id)
  if (!page) return
  await db.put('pages', { ...page, tags })
}

export async function updatePageNotes(id: string, notes: string): Promise<void> {
  const db = await getDB()
  const page = await db.get('pages', id)
  if (!page) return
  await db.put('pages', { ...page, notes })
}
