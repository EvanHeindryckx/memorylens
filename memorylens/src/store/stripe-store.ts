import { create } from 'zustand'
import type { UserPlan } from '@/types/page.types'
import { useBillingStore } from './billing-store'

// ── Config ─────────────────────────────────────────────────────────────────────
// VITE_STRIPE_PUBLISHABLE_KEY  → clé publique Stripe (pk_live_... ou pk_test_...)
// VITE_STRIPE_BACKEND_URL      → URL de ton backend de validation (ex: https://api.memorylens.app)
export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
  backendUrl:     import.meta.env.VITE_STRIPE_BACKEND_URL     ?? 'http://localhost:3001',
}
export const STRIPE_CONFIGURED = Boolean(
  STRIPE_CONFIG.publishableKey && STRIPE_CONFIG.backendUrl
)

// ── Types ──────────────────────────────────────────────────────────────────────
export type CheckoutStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancelled'

interface StripeStore {
  status: CheckoutStatus
  error: string | null

  /** Crée une session Checkout sur le backend et ouvre l'URL dans un nouvel onglet */
  startCheckout: (plan: UserPlan, userId: string, email: string) => Promise<void>
  /**
   * Valide une session Stripe depuis le backend (appelé après retour de la page Stripe).
   * Le backend vérifie la signature webhook côté serveur et retourne le plan activé.
   */
  verifySession: (sessionId: string, userId: string) => Promise<void>
  /** Ouvre le portail client Stripe (gestion abonnement / annulation) */
  openCustomerPortal: (userId: string) => Promise<void>
  /** Synchronise le plan depuis le backend (au démarrage) */
  syncSubscription: (userId: string) => Promise<void>
  reset: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Appel authentifié au backend MemoryLens.
 * Le backend est responsable de :
 *   - Créer la session Stripe Checkout (POST /stripe/create-checkout)
 *   - Vérifier la signature webhook (POST /stripe/verify-session)
 *   - Générer le lien portail (POST /stripe/customer-portal)
 *
 * La clé secrète Stripe (sk_live_...) ne doit JAMAIS être dans l'extension.
 */
async function backendFetch(
  path: string,
  body: Record<string, unknown>,
  token?: string | null
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${STRIPE_CONFIG.backendUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err?.error ?? err?.message ?? `Backend error ${res.status}`)
  }
  return res
}

async function getFirebaseToken(): Promise<string | null> {
  return new Promise(resolve =>
    chrome.storage.session.get('firebaseToken', d =>
      resolve((d.firebaseToken as string) ?? null)
    )
  )
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useStripeStore = create<StripeStore>((set) => ({
  status: 'idle',
  error: null,

  // ── Ouvre la page Stripe Checkout dans un onglet ──────────────────────────
  startCheckout: async (plan, userId, email) => {
    if (!STRIPE_CONFIG.backendUrl) {
      set({ status: 'error', error: 'VITE_STRIPE_BACKEND_URL manquant dans .env' })
      return
    }
    set({ status: 'loading', error: null })
    try {
      const token = await getFirebaseToken()
      console.log('[stripe-store] startCheckout:', { plan, userId, email })
      
      // Le backend génère lui-même le successUrl depuis EXTENSION_SUCCESS_URL
      const res = await backendFetch(
        '/stripe/create-checkout-session',
        { plan, userId, email },
        token
      )
      const data = await res.json() as { url: string; sessionId: string }
      console.log('[stripe-store] Session créée:', data.sessionId)

      await chrome.storage.session.set({ pendingStripeSession: data.sessionId })
      await chrome.tabs.create({ url: data.url })
      set({ status: 'idle' })
    } catch (e) {
      console.error('[stripe-store] startCheckout error:', e)
      set({ status: 'error', error: String(e) })
    }
  },

  // ── Vérifie la session après retour de Stripe ────────────────────────────
  verifySession: async (sessionId, userId) => {
    set({ status: 'loading', error: null })
    try {
      const token = await getFirebaseToken()
      const res = await backendFetch(
        '/stripe/verify-session',
        { sessionId, userId },
        token
      )
      const { plan, customerId, subscriptionId, currentPeriodEnd } =
        await res.json() as {
          plan: UserPlan
          customerId: string
          subscriptionId: string
          currentPeriodEnd: number
        }

      // Mettre à jour le billing local
      const billing = useBillingStore.getState()
      await billing.setStripeInfo({ plan, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, currentPeriodEnd })
      await billing.setPlan(plan)

      // Nettoyer la session en attente
      await chrome.storage.session.remove('pendingStripeSession')

      set({ status: 'success' })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },

  // ── Portail de gestion abonnement ────────────────────────────────────────
  openCustomerPortal: async (userId) => {
    if (!STRIPE_CONFIG.backendUrl) {
      set({ status: 'error', error: 'VITE_STRIPE_BACKEND_URL manquant dans .env' })
      return
    }
    set({ status: 'loading', error: null })
    try {
      const token = await getFirebaseToken()
      const res = await backendFetch(
        '/stripe/customer-portal',
        { userId },
        token
      )
      const { url } = await res.json() as { url: string }
      await chrome.tabs.create({ url })
      set({ status: 'idle' })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },

  // ── Synchronise le plan depuis le backend (au démarrage) ─────────────────
  syncSubscription: async (userId) => {
    try {
      const res = await fetch(
        `${STRIPE_CONFIG.backendUrl}/stripe/subscription/${userId}`
      )
      if (!res.ok) return

      const data = await res.json() as {
        plan: UserPlan
        status: string
        stripeCustomerId: string | null
        subscriptionId: string | null
        currentPeriodEnd: number | null  // ms
        cancelAtPeriodEnd: boolean
      }

      const billing = useBillingStore.getState()
      await billing.setStripeInfo({
        plan:                 data.plan,
        stripeCustomerId:     data.stripeCustomerId   ?? undefined,
        stripeSubscriptionId: data.subscriptionId     ?? undefined,
        currentPeriodEnd:     data.currentPeriodEnd   ?? undefined,
        cancelAtPeriodEnd:    data.cancelAtPeriodEnd,
      })
      await billing.setPlan(data.plan)
    } catch {
      // Silencieux — on garde le billing local si le backend est inaccessible
    }
  },

  reset: () => set({ status: 'idle', error: null }),
}))
