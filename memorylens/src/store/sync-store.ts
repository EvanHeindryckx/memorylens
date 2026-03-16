import { create } from 'zustand'
import type { SyncState, SyncStatus, BillingInfo } from '@/types/page.types'
import { getAllPages, savePage } from '@/core/db/pages-store'
import { getAllCollections, saveCollection } from '@/core/db/collections-store'
import { DEFAULT_BILLING } from '@/types/page.types'

// ── Config Firebase (à remplir avec vos clés) ─────────────────────────────────
// Les clés sont publiques côté client, la sécurité est gérée par Firestore Rules
export const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? '',
}

export const FIREBASE_CONFIGURED = Boolean(FIREBASE_CONFIG.projectId)

interface SyncStore extends SyncState {
  userId: string | null
  setUserId: (uid: string | null) => void
  setStatus: (status: SyncStatus, error?: string) => void
  push: () => Promise<void>   // local → cloud
  pull: () => Promise<void>   // cloud → local
  sync: () => Promise<void>   // push + pull
}

// Helper : appel au service-worker (background) pour les opérations réseau
// (les extensions ne peuvent pas utiliser directement firebase dans popup)
async function sendToSW(action: string, payload?: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage({ type: `SYNC_${action}`, payload })
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  status: 'disabled',
  lastSyncAt: undefined,
  error: undefined,
  pendingCount: 0,
  userId: null,

  setUserId: (uid) => set({ userId: uid, status: uid ? 'idle' : 'disabled' }),

  setStatus: (status, error) => set({ status, error }),

  push: async () => {
    const { userId } = get()
    if (!userId) return
    
    // ── Vérifier que l'utilisateur est Pro pour le Cloud Sync ──────────────
    const billing = await new Promise<BillingInfo>(resolve => {
      chrome.storage.sync.get('billing', result => {
        resolve({ ...DEFAULT_BILLING, ...(result.billing ?? {}) })
      })
    })
    
    if (billing.plan !== 'pro') {
      set({ status: 'error', error: 'Cloud Sync réservé au plan Pro' })
      return
    }

    set({ status: 'syncing', error: undefined })
    try {
      const [pages, collections] = await Promise.all([getAllPages(), getAllCollections()])
      const unsynced = pages.filter(p => !p.syncedAt || p.syncedAt < p.visitedAt)
      await sendToSW('PUSH', { userId, pages: unsynced, collections })
      // Marquer comme synchronisés
      const now = Date.now()
      for (const p of unsynced) await savePage({ ...p, syncedAt: now })
      set({ status: 'success', lastSyncAt: now, pendingCount: 0 })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },

  pull: async () => {
    const { userId } = get()
    if (!userId) return
    
    // ── Vérifier que l'utilisateur est Pro pour le Cloud Sync ──────────────
    const billing = await new Promise<BillingInfo>(resolve => {
      chrome.storage.sync.get('billing', result => {
        resolve({ ...DEFAULT_BILLING, ...(result.billing ?? {}) })
      })
    })
    
    if (billing.plan !== 'pro') {
      set({ status: 'error', error: 'Cloud Sync réservé au plan Pro' })
      return
    }

    set({ status: 'syncing', error: undefined })
    try {
      const result = await sendToSW('PULL', { userId }) as {
        pages?: Parameters<typeof savePage>[0][]
        collections?: Parameters<typeof saveCollection>[0][]
      } | null

      // Valider que le SW a bien répondu avec un objet
      if (!result || typeof result !== 'object') {
        set({ status: 'error', error: 'Réponse invalide du service worker' })
        return
      }

      const pages = Array.isArray(result.pages) ? result.pages : []
      const collections = Array.isArray(result.collections) ? result.collections : []

      for (const p of pages)       await savePage(p)
      for (const c of collections) await saveCollection(c)

      set({ status: 'success', lastSyncAt: Date.now(), pendingCount: 0 })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },

  sync: async () => {
    await get().push()
    if (get().status !== 'error') await get().pull()
  },
}))
