export type PageCategory =
  | 'article'
  | 'video'
  | 'product'
  | 'documentation'
  | 'social'
  | 'tool'
  | 'other'

export interface SavedPage {
  id: string
  url: string
  title: string
  domain: string
  visitedAt: number
  duration: number // secondes
  summary: string
  content: string // texte extrait, max 5000 chars
  embedding: number[] // vecteur 384D
  category: PageCategory
  tags: string[]
  notes: string
  favicon: string
  pinned?: boolean
  syncedAt?: number // timestamp dernière sync cloud
}

export interface SearchResult {
  page: SavedPage
  score: number
  snippet: string // extrait contextuel
}

export type CaptureLevel = 'minimal' | 'standard' | 'full'

export interface Collection {
  id: string
  name: string
  color: string
  icon: string
  pageIds: string[]
  createdAt: number
}

export interface ResurfaceItem {
  page: SavedPage
  daysAgo: number
  message: string
}

export interface DomainStat {
  domain: string
  count: number
  totalDuration: number
  favicon: string
}

export interface DayStat {
  date: string // 'YYYY-MM-DD'
  count: number
  totalDuration: number
}

export interface Preferences {
  captureLevel: CaptureLevel
  excludedDomains: string[]
  retentionDays: number
  theme: 'light' | 'dark' | 'system'
  aiEnabled: boolean
  captureEnabled: boolean
  resurfaceEnabled: boolean
  geminiEnabled: boolean
  notificationsEnabled: boolean // re-surface notifications
  cloudSyncEnabled: boolean // sync Firebase
}

export const DEFAULT_PREFERENCES: Preferences = {
  captureLevel: 'standard',
  excludedDomains: [
    'accounts.google.com',
    'login.',
    'signin.',
    'localhost',
    '127.0.0.1',
  ],
  retentionDays: 90,
  theme: 'dark',
  aiEnabled: true,
  captureEnabled: true,
  resurfaceEnabled: true,
  geminiEnabled: false,
  notificationsEnabled: true,
  cloudSyncEnabled: false,
}

// ── Billing / Freemium ────────────────────────────────────────────────────────

export type UserPlan = 'free' | 'pro'

export interface BillingInfo {
  plan: UserPlan
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: number // timestamp Unix ms
  cancelAtPeriodEnd?: boolean
}

export const DEFAULT_BILLING: BillingInfo = { plan: 'free' }

// Limites par plan
export const PLAN_LIMITS = {
  free: {
    maxPages: 500,
    maxCollections: 5,
    maxTags: 10,
    cloudSync: false,
    analytics: false, // stats avancées verrouillées
    export: false,
  },
  pro: {
    maxPages: Infinity,
    maxCollections: Infinity,
    maxTags: Infinity,
    cloudSync: true,
    analytics: true,
    export: true,
  },
} as const

// ── Cloud Sync ─────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'disabled'

export interface SyncState {
  status: SyncStatus
  lastSyncAt?: number
  error?: string
  pendingCount: number
}
