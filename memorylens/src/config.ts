/**
 * Configuration centralisée pour MemoryLens
 * Utilise les variables d'env du .env.local ou de Vite
 * Pour le Service Worker, la config est injectée au build (window.__MEMORYLENS_CONFIG)
 */

export const CONFIG = {
  // ── Backend API ────────────────────────────────────────────────────────────
  get BACKEND_URL() {
    // Service Worker : utilise window.__MEMORYLENS_CONFIG
    if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.BACKEND_URL) {
      return (window as any).__MEMORYLENS_CONFIG.BACKEND_URL
    }
    // Contexte normal Vite
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
      return import.meta.env.VITE_BACKEND_URL
    }
    return 'http://localhost:3001'
  },

  // ── Firebase Client Config ─────────────────────────────────────────────────
  FIREBASE: {
    get apiKey() {
      if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.FIREBASE_API_KEY) {
        return (window as any).__MEMORYLENS_CONFIG.FIREBASE_API_KEY
      }
      return import.meta.env?.VITE_FIREBASE_API_KEY || ''
    },
    get authDomain() {
      if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.FIREBASE_AUTH_DOMAIN) {
        return (window as any).__MEMORYLENS_CONFIG.FIREBASE_AUTH_DOMAIN
      }
      return import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || 'memorylens-d33e4.firebaseapp.com'
    },
    get projectId() {
      if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.FIREBASE_PROJECT_ID) {
        return (window as any).__MEMORYLENS_CONFIG.FIREBASE_PROJECT_ID
      }
      return import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'memorylens-d33e4'
    },
    get storageBucket() {
      if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.FIREBASE_STORAGE_BUCKET) {
        return (window as any).__MEMORYLENS_CONFIG.FIREBASE_STORAGE_BUCKET
      }
      return import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || 'memorylens-d33e4.appspot.com'
    },
    get messagingSenderId() {
      if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.FIREBASE_MESSAGING_SENDER_ID) {
        return (window as any).__MEMORYLENS_CONFIG.FIREBASE_MESSAGING_SENDER_ID
      }
      return import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || ''
    },
    get appId() {
      if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.FIREBASE_APP_ID) {
        return (window as any).__MEMORYLENS_CONFIG.FIREBASE_APP_ID
      }
      return import.meta.env?.VITE_FIREBASE_APP_ID || ''
    },
    get databaseURL() {
      if (typeof window !== 'undefined' && (window as any).__MEMORYLENS_CONFIG?.FIREBASE_DATABASE_URL) {
        return (window as any).__MEMORYLENS_CONFIG.FIREBASE_DATABASE_URL
      }
      return import.meta.env?.VITE_FIREBASE_DATABASE_URL || 'https://memorylens-d33e4.firebaseio.com'
    },
  },

  // ── Environnement ──────────────────────────────────────────────────────────
  ENV: typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.MODE : 'development',
  IS_DEV: typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : true,
  IS_PROD: typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.PROD : false,

  // ── Limites Free vs Pro ────────────────────────────────────────────────────
  LIMITS: {
    FREE: {
      MAX_PAGES: 500,
      MAX_COLLECTIONS: 5,
      CLOUD_SYNC: false,
    },
    PRO: {
      MAX_PAGES: Infinity,
      MAX_COLLECTIONS: Infinity,
      CLOUD_SYNC: true,
    },
  },

  // ── Sync Configuration ────────────────────────────────────────────────────
  SYNC: {
    AUTO_INTERVAL_MS: 30 * 60 * 1000, // 30 minutes
    BATCH_SIZE: 100,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
  },

  // ── Feature Flags ──────────────────────────────────────────────────────────
  FEATURES: {
    CLOUD_SYNC: true,
    OFFLINE_MODE: true,
    ANALYTICS: true,
    RESURFACING: true,
    GEMINI_NANO: true,
  },
} as const

export type Config = typeof CONFIG
