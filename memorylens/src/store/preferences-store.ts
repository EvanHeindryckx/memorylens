import { create } from 'zustand'
import { DEFAULT_PREFERENCES, type Preferences } from '@/types/page.types'

interface PreferencesStore {
  preferences: Preferences
  loaded: boolean
  load: () => Promise<void>
  save: (partial: Partial<Preferences>) => Promise<void>
}

function applyTheme(theme: Preferences['theme']) {
  // window n'existe pas dans le service-worker
  if (typeof window === 'undefined') return
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.body.classList.toggle('theme-light', !isDark)
}

export const usePreferencesStore = create<PreferencesStore>(set => ({
  preferences: DEFAULT_PREFERENCES,
  loaded: false,

  load: async () => {
    chrome.storage.sync.get('preferences', result => {
      const prefs = { ...DEFAULT_PREFERENCES, ...(result.preferences ?? {}) }
      applyTheme(prefs.theme)
      set({ preferences: prefs, loaded: true })
    })
  },

  save: async (partial) => {
    set(state => {
      const updated = { ...state.preferences, ...partial }
      chrome.storage.sync.set({ preferences: updated })
      if (partial.theme) applyTheme(updated.theme)
      return { preferences: updated }
    })
  },
}))
