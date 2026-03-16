import { openDB, type IDBPDatabase } from 'idb'
import type { SavedPage, Collection } from '@/types/page.types'

const DB_NAME = 'memorylens'
const DB_VERSION = 3  // bumped pour index by_url

export type MemoryLensDB = IDBPDatabase<{
  pages: {
    key: string
    value: SavedPage
    indexes: { by_domain: string; by_visited: number; by_category: string; by_url: string }
  }
  collections: {
    key: string
    value: Collection
    indexes: { by_created: number }
  }
}>

let dbInstance: MemoryLensDB | null = null

export async function getDB(): Promise<MemoryLensDB> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<{
    pages: {
      key: string
      value: SavedPage
      indexes: { by_domain: string; by_visited: number; by_category: string; by_url: string }
    }
    collections: {
      key: string
      value: Collection
      indexes: { by_created: number }
    }
  }>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('pages', { keyPath: 'id' })
        store.createIndex('by_domain', 'domain')
        store.createIndex('by_visited', 'visitedAt')
        store.createIndex('by_category', 'category')
        store.createIndex('by_url', 'url', { unique: true })
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('collections')) {
          const col = db.createObjectStore('collections', { keyPath: 'id' })
          col.createIndex('by_created', 'createdAt')
        }
      }
      if (oldVersion >= 2 && oldVersion < 3) {
        // Migration : ajout index by_url sur store existant via la transaction d'upgrade
        const store = transaction.objectStore('pages')
        if (!store.indexNames.contains('by_url')) {
          store.createIndex('by_url', 'url', { unique: true })
        }
      }
    },
  })

  return dbInstance
}
