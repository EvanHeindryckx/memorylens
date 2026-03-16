import { getDB } from './database'
import type { Collection } from '@/types/page.types'

export async function getAllCollections(): Promise<Collection[]> {
  const db = await getDB()
  return db.getAllFromIndex('collections', 'by_created')
}

export async function saveCollection(col: Collection): Promise<void> {
  const db = await getDB()
  await db.put('collections', col)
}

export async function deleteCollection(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('collections', id)
}

export async function addPageToCollection(colId: string, pageId: string): Promise<void> {
  const db = await getDB()
  const col = await db.get('collections', colId)
  if (!col) return
  if (!col.pageIds.includes(pageId)) {
    col.pageIds.push(pageId)
    await db.put('collections', col)
  }
}

export async function removePageFromCollection(colId: string, pageId: string): Promise<void> {
  const db = await getDB()
  const col = await db.get('collections', colId)
  if (!col) return
  col.pageIds = col.pageIds.filter(id => id !== pageId)
  await db.put('collections', col)
}
