import { savePage, getPageByUrl, deleteOldPages, getTotalCount } from '@/core/db/pages-store'
import { getAllCollections, saveCollection } from '@/core/db/collections-store'
import {
  extractDomain,
  isExcluded,
  getFavicon,
  detectCategory,
  generateId,
  cleanText,
} from '@/core/utils'
import type { SavedPage, Preferences, BillingInfo } from '@/types/page.types'
import { DEFAULT_PREFERENCES, DEFAULT_BILLING } from '@/types/page.types'

// ─── Tab visit tracking ───────────────────────────────────────────────────────
const tabStartTimes: Record<number, number> = {}

async function getPreferences(): Promise<Preferences> {
  return new Promise(resolve => {
    chrome.storage.sync.get('preferences', result => {
      resolve({ ...DEFAULT_PREFERENCES, ...(result.preferences ?? {}) })
    })
  })
}

async function getBilling(): Promise<BillingInfo> {
  return new Promise(resolve => {
    chrome.storage.sync.get('billing', result => {
      resolve({ ...DEFAULT_BILLING, ...(result.billing ?? {}) })
    })
  })
}

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument?.()
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen/index.html'),
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: 'Generate text embeddings for semantic search',
    })
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  await ensureOffscreen()
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_EMBEDDING', payload: { text } },
      (response: { success: boolean; embedding: number[] }) => {
        if (chrome.runtime.lastError) {
          resolve([])
          return
        }
        resolve(response?.embedding ?? [])
      }
    )
  })
}

async function extractContent(tabId: number): Promise<{
  title: string
  content: string
  summary: string
} | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          title: document.title,
          content: document.body?.innerText?.slice(0, 5000) ?? '',
          summary: document.body?.innerText?.slice(0, 300) ?? '',
        }
      },
    })
    return results?.[0]?.result ?? null
  } catch {
    return null
  }
}

// Gemini Nano via offscreen (window.ai disponible dans offscreen)
async function generateSummary(content: string): Promise<string> {
  await ensureOffscreen()
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_SUMMARY', payload: { content } },
      (response: { summary?: string }) => {
        if (chrome.runtime.lastError) {
          resolve('')
          return
        }
        resolve(response?.summary ?? '')
      }
    )
  })
}

async function generateTags(title: string, content: string): Promise<string[]> {
  await ensureOffscreen()
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_TAGS', payload: { title, content } },
      (response: { tags?: string[] }) => {
        if (chrome.runtime.lastError) {
          resolve([])
          return
        }
        resolve(response?.tags ?? [])
      }
    )
  })
}

async function capturePage(tab: chrome.tabs.Tab) {
  if (!tab.id || !tab.url || !tab.url.startsWith('http')) return

  const prefs = await getPreferences()
  if (!prefs.captureEnabled) return
  if (isExcluded(tab.url, prefs.excludedDomains)) return

  // ── Vérification limite Free plan ─────────────────────────────────────────
  const billing = await getBilling()
  if (billing.plan === 'free') {
    const count = await getTotalCount()
    // Limite stricte : 500 pages pour Free, sinon on capture pas
    if (count >= 500) {
      console.log('[MemoryLens] ⚠️ Limite Free atteinte (500 pages max). Capture bloquée.')
      return
    }
  }

  // ── Déduplication URL — update durée si même URL < 1h ─────────────────────
  const existing = await getPageByUrl(tab.url)
  if (existing && Date.now() - existing.visitedAt < 3600_000) {
    const duration = tabStartTimes[tab.id]
      ? Math.floor((Date.now() - tabStartTimes[tab.id]) / 1000)
      : 0
    if (duration > 0) {
      await savePage({ ...existing, duration: existing.duration + duration })
    }
    return
  }

  const domain = extractDomain(tab.url)
  const favicon = getFavicon(tab.url)

  // Extraction du contenu
  let content = ''
  let summary = ''
  let title = tab.title ?? ''

  if (prefs.captureLevel !== 'minimal') {
    const extracted = await extractContent(tab.id)
    if (extracted) {
      content = cleanText(extracted.content)
      title = extracted.title || title
      // Gemini Nano pour résumé si activé
      if (prefs.geminiEnabled && content.length > 200) {
        summary = await generateSummary(content)
      }
      summary = summary || extracted.summary
    }
  }

  // Tags auto via Gemini Nano
  const tags = prefs.geminiEnabled ? await generateTags(title, content) : []

  // Embedding vectoriel
  const textForEmbedding = `${title} ${summary} ${content.slice(0, 1000)}`
  const embedding = await generateEmbedding(textForEmbedding)

  const page: SavedPage = {
    id: generateId(),
    url: tab.url,
    title: title || tab.url,
    domain,
    visitedAt: Date.now(),
    duration: tabStartTimes[tab.id]
      ? Math.floor((Date.now() - tabStartTimes[tab.id]) / 1000)
      : 0,
    summary,
    content,
    embedding,
    category: detectCategory(tab.url, title),
    tags,
    notes: '',
    favicon,
  }

  await savePage(page)
  delete tabStartTimes[tab.id]

  // ── Sync auto si activé (Pro) ─────────────────────────────────────────────
  if (prefs.cloudSyncEnabled && billing.plan === 'pro') {
    chrome.storage.session?.get?.('userId', ({ userId }) => {
      if (userId) triggerSync(userId)
    })
  }
}

// ─── Notifications re-surface ─────────────────────────────────────────────────
async function checkResurface() {
  const prefs = await getPreferences()
  if (!prefs.resurfaceEnabled || !prefs.notificationsEnabled) return

  const { getResurfaceItems } = await import('@/core/resuface/resuface')
  const items = await getResurfaceItems()
  if (!items.length) return

  const item = items[0]
  chrome.notifications.create(`resuface-${item.page.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: '🧠 MemoryLens — Souvenir',
    message: `${item.message}\n"${item.page.title.slice(0, 60)}"`,
    buttons: [{ title: 'Ouvrir' }],
  })
}

chrome.notifications.onButtonClicked.addListener((notifId, btnIndex) => {
  if (notifId.startsWith('resuface-') && btnIndex === 0) {
    const pageId = notifId.replace('resuface-', '')
    // On cherche l'URL dans le storage pour l'ouvrir
    import('@/core/db/pages-store').then(({ getPage }) => {
      getPage(pageId).then(page => {
        if (page) chrome.tabs.create({ url: page.url })
      })
    })
  }
})

// ─── Firebase Sync helpers (Firestore REST API — pas de SDK dans SW) ──────────
async function getFirestoreToken(): Promise<string | null> {
  return new Promise(resolve => {
    // Cherche d'abord dans chrome.storage.local (persistant après connexion)
    chrome.storage.local.get(['firebaseToken', 'firebaseTokenExpiry', 'firebaseRefreshToken'], async (data) => {
      if (chrome.runtime.lastError) {
        console.error('[MemoryLens] Erreur accès token:', chrome.runtime.lastError)
        resolve(null)
        return
      }

      const token = data.firebaseToken as string | undefined
      const expiry = data.firebaseTokenExpiry as number | undefined
      const refreshToken = data.firebaseRefreshToken as string | undefined

      // Vérifier si le token est toujours valide (avec marge de 5 min)
      if (token && expiry && expiry > Date.now() + 300_000) {
        resolve(token)
        return
      }

      // Token expiré → le rafraîchir avec le refreshToken
      if (refreshToken) {
        console.log('[MemoryLens] Token expiré, rafraîchissement en cours...')
        try {
          const newToken = await refreshFirebaseToken(refreshToken)
          if (newToken) {
            resolve(newToken)
            return
          }
        } catch (e) {
          console.error('[MemoryLens] Erreur refresh token:', e)
        }
      }

      resolve(null)
    })
  })
}

async function refreshFirebaseToken(refreshToken: string): Promise<string | null> {
  try {
    const apiKey = 'AIzaSyBvY5wSR0KTpf5k-q2q3q2q3q2q3q2q3q2q' // VITE_FIREBASE_API_KEY
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
      }
    )

    if (!res.ok) {
      console.error('[MemoryLens] Erreur refresh token:', res.status)
      return null
    }

    const data = await res.json() as {
      id_token: string
      refresh_token: string
      expires_in: string
    }

    const expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000

    // Sauvegarde le nouveau token
    await new Promise<void>(resolve => {
      chrome.storage.local.set({
        firebaseToken: data.id_token,
        firebaseRefreshToken: data.refresh_token,
        firebaseTokenExpiry: expiresAt,
      }, resolve)
    })

    console.log('[MemoryLens] ✅ Token rafraîchi avec succès')
    return data.id_token
  } catch (e) {
    console.error('[MemoryLens] Erreur rafraîchissement token:', e)
    return null
  }
}

async function getProjectId(): Promise<string | null> {
  return new Promise(resolve => {
    // Récupère le projectId depuis les variables d'env stockées
    const projectId = 'memorylens-d33e4' // Hardcodé pour le moment, peut être généralisé
    resolve(projectId)
  })
}

async function triggerSync(userId: string) {
  const backendUrl = (globalThis as any).__MEMORYLENS_CONFIG?.BACKEND_URL || 'http://localhost:3001'

  console.log('[MemoryLens] 🔄 Synchronisation cloud en cours...')

  try {
    const { getAllPages } = await import('@/core/db/pages-store')
    const [pages, collections] = await Promise.all([
      getAllPages(),
      getAllCollections(),
    ])
    const unsynced = pages.filter(p => !p.syncedAt || p.syncedAt < p.visitedAt)

    console.log(`[MemoryLens] Envoi de ${unsynced.length} pages non synchronisées...`)

    // ── PUSH : Envoie les pages vers le backend (qui les sauvegarde dans Firestore) ──
    try {
      const res = await fetch(`${backendUrl}/stripe/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pages: unsynced, collections }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        console.error('[MemoryLens] Erreur sync:', err.error)
        return
      }

      const result = await res.json() as { synced?: number }
      console.log(`[MemoryLens] ✅ ${result.synced ?? unsynced.length} pages synchronisées`)

      // Marquer comme synchronisées
      const { savePage: sp } = await import('@/core/db/pages-store')
      const now = Date.now()
      for (const p of unsynced) {
        await sp({ ...p, syncedAt: now })
      }
    } catch (e) {
      console.error('[MemoryLens] Erreur push vers backend:', e)
    }
  } catch (e) {
    console.error('[MemoryLens] ❌ Erreur synchronisation:', e)
  }
}

async function pullFromFirestore(userId: string): Promise<{ pages: SavedPage[]; collections: import('@/types/page.types').Collection[] }> {
  const token = await getFirestoreToken()
  if (!token) {
    console.log('[MemoryLens] ⚠️ Pas de token Firebase, pull bloqué')
    return { pages: [], collections: [] }
  }
  
  const projectId = await getProjectId()
  if (!projectId) {
    console.log('[MemoryLens] ⚠️ Pas de projectId, pull bloqué')
    return { pages: [], collections: [] }
  }

  console.log('[MemoryLens] 📥 Récupération des données cloud...')

  try {
    // Récupère les pages
    const pagesRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/pages`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    )
    
    const pagesData = await pagesRes.json() as { documents?: Array<{ fields: Record<string, unknown> }> }
    const pages = (pagesData.documents ?? []).map((doc: any) => fsValueToPage(doc.fields))

    // Récupère les collections
    const collectionsRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/collections`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    )
    
    const collectionsData = await collectionsRes.json() as { documents?: Array<{ fields: Record<string, unknown> }> }
    const collections = (collectionsData.documents ?? []).map((doc: any) => fsValueToCollection(doc.fields))

    console.log(`[MemoryLens] ✅ ${pages.length} pages et ${collections.length} collections récupérées`)
    return { pages, collections }
  } catch (e) {
    console.error('[MemoryLens] ❌ Erreur récupération cloud:', e)
    return { pages: [], collections: [] }
  }
}

function toFsValue(v: unknown): unknown {
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { doubleValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } }
  if (v === null || v === undefined) return { nullValue: null }
  return { stringValue: JSON.stringify(v) }
}

function fromFsValue(v: any): unknown {
  if (v.stringValue !== undefined) return v.stringValue
  if (v.doubleValue !== undefined) return v.doubleValue
  if (v.integerValue !== undefined) return parseInt(v.integerValue)
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.arrayValue) return v.arrayValue.values?.map(fromFsValue) ?? []
  if (v.mapValue) {
    const obj: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) {
      obj[k] = fromFsValue(val)
    }
    return obj
  }
  if (v.nullValue) return null
  return v
}

function pageToFirestore(page: SavedPage) {
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(page)) fields[k] = toFsValue(v)
  return { fields }
}

function collectionToFirestore(col: import('@/types/page.types').Collection) {
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(col)) fields[k] = toFsValue(v)
  return { fields }
}

function fsValueToPage(fields: Record<string, unknown>): SavedPage {
  return {
    id: fromFsValue(fields.id) as string,
    url: fromFsValue(fields.url) as string,
    title: fromFsValue(fields.title) as string,
    domain: fromFsValue(fields.domain) as string,
    visitedAt: fromFsValue(fields.visitedAt) as number,
    duration: fromFsValue(fields.duration) as number,
    summary: fromFsValue(fields.summary) as string,
    content: fromFsValue(fields.content) as string,
    embedding: fromFsValue(fields.embedding) as number[],
    category: fromFsValue(fields.category) as any,
    tags: fromFsValue(fields.tags) as string[],
    notes: fromFsValue(fields.notes) as string,
    favicon: fromFsValue(fields.favicon) as string,
    pinned: fromFsValue(fields.pinned) as boolean | undefined,
    syncedAt: fromFsValue(fields.syncedAt) as number | undefined,
  }
}

function fsValueToCollection(fields: Record<string, unknown>): import('@/types/page.types').Collection {
  return {
    id: fromFsValue(fields.id) as string,
    name: fromFsValue(fields.name) as string,
    color: fromFsValue(fields.color) as string,
    icon: fromFsValue(fields.icon) as string,
    pageIds: fromFsValue(fields.pageIds) as string[],
    createdAt: fromFsValue(fields.createdAt) as number,
  }
}

// ─── Google Login Flow (background) ───────────────────────────────────────────
async function startLoginFlow() {
  console.log('[service-worker] Démarrage du flux de connexion Google')
  
  try {
    // Vérifier si un onglet de login est déjà ouvert
    const { loginTabId } = await chrome.storage.local.get('loginTabId')
    if (loginTabId) {
      console.log('[service-worker] Onglet login déjà ouvert:', loginTabId)
      return
    }

    // En Service Worker, la config est injectée dans globalThis.__MEMORYLENS_CONFIG
    const backendUrl = (globalThis as any).__MEMORYLENS_CONFIG?.BACKEND_URL || 'http://localhost:3001'
    
    console.log('[service-worker] Backend URL:', backendUrl)
    
    // Ouvre la page login.html depuis le backend
    const tab = await chrome.tabs.create({ url: `${backendUrl}/login` })
    console.log('[service-worker] Onglet login créé:', tab.id)

    // Stocke l'état de la connexion en cours
    await chrome.storage.local.set({
      loginInProgress: true,
      loginStartTime: Date.now(),
      loginTabId: tab.id,
    })

    // Crée une alarme pour vérifier toutes les 0.5 secondes
    chrome.alarms.create('check-login', { periodInMinutes: 0.5 / 60 })
    console.log('[service-worker] Alarme check-login créée')

  } catch (e) {
    console.error('[service-worker] Erreur flux connexion:', e)
  }
}

// Fonction pour vérifier la connexion (appelée par l'alarme)
async function checkLoginStatus() {
  try {
    // En Service Worker, la config est injectée dans globalThis.__MEMORYLENS_CONFIG
    const backendUrl = (globalThis as any).__MEMORYLENS_CONFIG?.BACKEND_URL || 'http://localhost:3001'
    
    const data = await chrome.storage.local.get(['loginInProgress', 'loginStartTime'])
    
    if (!data.loginInProgress) {
      // La connexion n'est plus en cours
      chrome.alarms.clear('check-login')
      return
    }

    const elapsed = Date.now() - (data.loginStartTime as number)
    const maxDuration = 5 * 60 * 1000 // 5 minutes

    if (elapsed > maxDuration) {
      console.log('[service-worker] Timeout connexion Google')
      await chrome.storage.local.set({ loginInProgress: false })
      chrome.alarms.clear('check-login')
      return
    }

    // Récupère les données utilisateur depuis le backend
    console.log('[service-worker] Vérification de la connexion... (', Math.round(elapsed / 1000), 's)')
    const res = await fetch(`${backendUrl}/auth/current-user`)
    
    console.log('[service-worker] Réponse /auth/current-user:', res.status)
    
    if (res.ok) {
      const userData = await res.json()
      console.log('[service-worker] Utilisateur connecté:', userData)
      console.log('[service-worker] RefreshToken reçu du backend:', userData.refreshToken ? '✅ OUI' : '❌ NON (vide ou undefined)')
      
      // Stocke les données dans chrome.storage.local (partagé entre tous les contextes)
      await chrome.storage.local.set({
        firebaseToken: userData.token,
        firebaseRefreshToken: userData.refreshToken || '',
        firebaseUser: {
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
        },
        firebaseTokenExpiry: Date.now() + 3600000,
        userId: userData.uid,
        loginInProgress: false,
      })
      
      console.log('[service-worker] ✅ Données sauvegardées dans chrome.storage.local')

      // Fermer l'onglet de login
      const { loginTabId } = await chrome.storage.local.get('loginTabId')
      if (loginTabId) {
        chrome.tabs.remove(loginTabId as number).catch(() => {})
      }

      // Arrêter la vérification
      chrome.alarms.clear('check-login')
    } else {
      console.log('[service-worker] Pas encore connecté (status:', res.status, ')')
    }
  } catch (e) {
    console.log('[service-worker] Vérification échouée:', e)
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Capture normale de page (ignore la page de succès Stripe)
    if (!tab.url.includes('stripe-success.html')) {
      tabStartTimes[tabId] = Date.now()
      setTimeout(() => capturePage(tab), 1500)
    }
  }
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  tabStartTimes[tabId] = Date.now()
})

chrome.tabs.onRemoved.addListener(tabId => {
  delete tabStartTimes[tabId]
})

// ─── Context Menu ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'memorylens-save',
    title: '🧠 Mémoriser avec MemoryLens',
    contexts: ['page', 'link'],
  })

  // Cleanup quotidien
  chrome.alarms.create('daily-cleanup', { periodInMinutes: 1440 })
  chrome.alarms.create('resuface-check', { periodInMinutes: 60 })
  chrome.alarms.create('cloud-sync', { periodInMinutes: 30 })
})

chrome.contextMenus.onClicked.addListener(async (_info, tab) => {
  if (tab) await capturePage(tab)
})

// ─── Alarms ───────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'daily-cleanup') {
    const prefs = await getPreferences()
    const deleted = await deleteOldPages(prefs.retentionDays)
    console.log(`[MemoryLens] Cleanup: ${deleted} pages supprimées`)
  }
  if (alarm.name === 'resuface-check') {
    await checkResurface()
  }
  if (alarm.name === 'cloud-sync') {
    const [prefs, billing] = await Promise.all([getPreferences(), getBilling()])
    if (prefs.cloudSyncEnabled && billing.plan === 'pro') {
      const { userId } = await chrome.storage.session?.get?.('userId') ?? {}
      if (userId) await triggerSync(userId)
    }
  }
  if (alarm.name === 'check-login') {
    await checkLoginStatus()
  }
})

// ─── Messages depuis popup/options ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      sendResponse({ tab: tabs[0] ?? null })
    })
    return true
  }

  // ── LOGIN GOOGLE ──────────────────────────────────────────────────────────
  if (message.type === 'START_LOGIN_FLOW') {
    startLoginFlow().catch(e => console.error('[service-worker] Login error:', e))
    sendResponse({ ok: true })
    return true
  }

  // Sync manuel depuis popup
  if (message.type === 'SYNC_PUSH' || message.type === 'SYNC_PULL') {
    const { userId } = message.payload ?? {}
    if (userId) {
      triggerSync(userId).then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }))
    } else {
      sendResponse({ ok: false, error: 'No userId' })
    }
    return true
  }

  // Stripe — vérification session après paiement (appelé depuis stripe-success.html)
  if (message.type === 'STRIPE_VERIFY_SESSION') {
    const { sessionId } = message.payload ?? {}
    if (!sessionId) {
      sendResponse({ ok: false, error: 'sessionId manquant' })
      return true
    }

    // Lance la vérification en async MAIS retourne true immédiatement pour dire qu'on va répondre
    ;(async () => {
      try {
        // Récupère userId depuis chrome.storage.local (où on le sauvegarde après Google login)
        const localData = await chrome.storage.local.get('userId')
        const syncData = await chrome.storage.sync.get('anonymousId')
        const userId = (localData.userId as string) ?? (syncData.anonymousId as string) ?? 'unknown'

        console.log('[service-worker] STRIPE_VERIFY_SESSION userId:', userId)

        const backendUrl = (globalThis as any).__MEMORYLENS_CONFIG?.BACKEND_URL || 'http://localhost:3001'
        const res = await fetch(`${backendUrl}/stripe/verify-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, userId }),
        })

        console.log('[service-worker] STRIPE_VERIFY_SESSION response:', res.status)

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }))
          console.log('[service-worker] STRIPE_VERIFY_SESSION error:', err)
          sendResponse({ ok: false, error: err.error ?? 'Erreur serveur' })
          return
        }

        const data = await res.json() as {
          plan: string
          customerId: string
          subscriptionId: string
          currentPeriodEnd: number
        }

        console.log('[service-worker] STRIPE_VERIFY_SESSION success:', data)

        // ✅ Mettre à jour le billing — le popup se rafraîchit via storage.onChanged
        await chrome.storage.sync.set({
          billing: {
            plan: data.plan,
            stripeCustomerId: data.customerId,
            stripeSubscriptionId: data.subscriptionId,
            currentPeriodEnd: data.currentPeriodEnd,
          }
        })

        console.log('[service-worker] Billing mis à jour:', data.plan)
        sendResponse({ ok: true, plan: data.plan })
      } catch (e) {
        console.error('[service-worker] STRIPE_VERIFY_SESSION exception:', e)
        sendResponse({ ok: false, error: String(e) })
      }
    })()
    return true // async
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'memorize-current') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab) await capturePage(tab)
  }
})
