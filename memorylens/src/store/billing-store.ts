import { create } from 'zustand'
import { DEFAULT_BILLING, type BillingInfo, type UserPlan } from '@/types/page.types'

const STORAGE_KEY = 'billing'

interface BillingStore {
  billing: BillingInfo
  loaded: boolean
  load: () => Promise<void>
  setPlan: (plan: UserPlan) => Promise<void>
  setStripeInfo: (info: Partial<BillingInfo>) => Promise<void>
  isPro: () => boolean
  canAddPage: (currentCount: number) => boolean
  canAddCollection: (currentCount: number) => boolean
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  billing: DEFAULT_BILLING,
  loaded: false,

  load: async () => {
    chrome.storage.sync.get(STORAGE_KEY, result => {
      const billing = { ...DEFAULT_BILLING, ...(result[STORAGE_KEY] ?? {}) }
      set({ billing, loaded: true })
    })
  },

  setPlan: async (plan) => {
    set(state => {
      const updated = { ...state.billing, plan }
      chrome.storage.sync.set({ [STORAGE_KEY]: updated })
      return { billing: updated }
    })
  },

  setStripeInfo: async (info) => {
    set(state => {
      const updated = { ...state.billing, ...info }
      chrome.storage.sync.set({ [STORAGE_KEY]: updated })
      return { billing: updated }
    })
  },

  isPro: () => {
    const { billing } = get()
    if (billing.plan !== 'pro') return false
    // Vérifier que la période n'est pas expirée
    if (billing.currentPeriodEnd && billing.currentPeriodEnd < Date.now()) return false
    return true
  },

  canAddPage: (currentCount) => {
    const { billing } = get()
    if (billing.plan === 'pro') return true
    return currentCount < 500
  },

  canAddCollection: (currentCount) => {
    const { billing } = get()
    if (billing.plan === 'pro') return true
    return currentCount < 5
  },
}))

// ─── Écoute les changements de storage pour rafraîchir le billing en temps réel
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    const billing = { ...DEFAULT_BILLING, ...(changes[STORAGE_KEY].newValue ?? {}) }
    useBillingStore.setState({ billing })
  }
})
