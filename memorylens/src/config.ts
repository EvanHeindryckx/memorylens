/**
 * Configuration centralisée pour MemoryLens
 * Utilise les variables d'env du .env.local ou de Vite
 */

export const CONFIG = {
  // ── Backend API ────────────────────────────────────────────────────────────
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',

  // ── Firebase Client Config ─────────────────────────────────────────────────
  FIREBASE: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'memorylens-d33e4.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'memorylens-d33e4',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'memorylens-d33e4.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://memorylens-d33e4.firebaseio.com',
  },

  // ── Environnement ──────────────────────────────────────────────────────────
  ENV: import.meta.env.MODE || 'development',
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,

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
