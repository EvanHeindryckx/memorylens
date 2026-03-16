import { create } from 'zustand'
import { FIREBASE_CONFIG, FIREBASE_CONFIGURED } from './sync-store'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface AuthStore {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null

  /** Charge la session persistée depuis chrome.storage.session */
  loadSession: () => Promise<void>
  /** Connexion Google via chrome.identity.launchWebAuthFlow */
  signInWithGoogle: () => Promise<void>
  /** Déconnexion + nettoyage */
  signOut: () => Promise<void>
  /** Rafraîchit le token Firebase si expiré (durée 1h) */
  refreshToken: () => Promise<string | null>
}

// ── Helpers REST Firebase Auth ────────────────────────────────────────────────

/** Rafraîchit un idToken via le refreshToken Firebase */
async function exchangeRefreshToken(refreshToken: string): Promise<{
  id_token: string
  refresh_token: string
  user_id: string
  expires_in: string
}> {
  const apiKey = FIREBASE_CONFIG.apiKey
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Token refresh failed')
  }
  return res.json()
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthStore>((set, get) => {
  return {
    user: null,
    token: null,
    loading: false,
    error: null,

    loadSession: async () => {
      return new Promise<void>((resolve) => {
        console.log('[auth-store] loadSession() appelée')
        chrome.storage.local.get(
          ['firebaseToken', 'firebaseRefreshToken', 'firebaseUser', 'firebaseTokenExpiry'],
          async (data) => {
            console.log('[auth-store] Données du storage:', data)
            
            if (!data.firebaseUser) {
              console.log('[auth-store] Pas de firebaseUser trouvé')
              resolve()
              return
            }

            if (!data.firebaseToken) {
              console.log('[auth-store] ⚠️ firebaseToken manquant, vérification du token expiry')
              // Si le token manque mais qu'on a firebaseTokenExpiry, c'est peut-être juste pas encore synchronisé
              // On skip et on laisse le rafraîchissement se faire
              resolve()
              return
            }

            const user = data.firebaseUser as AuthUser
            const expiry = (data.firebaseTokenExpiry as number) ?? 0

            console.log('[auth-store] Utilisateur trouvé:', user)

            // Token encore valide (marge 5 min)
            if (Date.now() < expiry - 300_000) {
              console.log('[auth-store] Token valide, mise à jour du state')
              set({ user, token: data.firebaseToken as string })
              // Propager userId dans sync-store
              const syncStore = await import('./sync-store')
              syncStore.useSyncStore.getState().setUserId(user.uid)
              resolve()
              return
            }

            // Token expiré → refresh silencieux
            if (data.firebaseRefreshToken) {
              console.log('[auth-store] Token expiré, refresh en cours...')
              await get().refreshToken()
            } else {
              // Pas de refresh token = on peut rien faire, l'utilisateur doit se reconnecter
              console.log('[auth-store] ❌ Token expiré et pas de refresh token')
              set({ user: null, token: null })
            }
            resolve()
          }
        )
      })
    },

    signInWithGoogle: async () => {
      if (!FIREBASE_CONFIGURED) {
        set({ error: 'Firebase non configuré. Veuillez ajouter vos clés dans .env' })
        return
      }
      set({ loading: true, error: null })
      try {
        // Demande au service worker de gérer le flux de connexion
        await new Promise<void>((resolve) => {
          chrome.runtime.sendMessage({ type: 'START_LOGIN_FLOW' }, () => {
            resolve()
          })
        })

        // Le service worker s'occupe de tout maintenant
        // On peut fermer le popup, la connexion continue en arrière-plan
        set({ loading: false })
      } catch (e) {
        set({ loading: false, error: String(e) })
      }
    },

    signOut: async () => {
      set({ loading: true })
      try {
        // Nettoyer la session
        await chrome.storage.local.remove([
          'firebaseToken',
          'firebaseRefreshToken',
          'firebaseUser',
          'firebaseTokenExpiry',
          'userId',
        ])

        set({ user: null, token: null, loading: false, error: null })

        // Désactiver le sync
        const syncStore = await import('./sync-store')
        syncStore.useSyncStore.getState().setUserId(null)
      } catch (e) {
        set({ loading: false, error: String(e) })
      }
    },

    refreshToken: async () => {
      const refreshToken = await new Promise<string | null>(resolve => {
        chrome.storage.local.get('firebaseRefreshToken', d => {
          resolve((d.firebaseRefreshToken as string) ?? null)
        })
      })

      if (!refreshToken) {
        set({ user: null, token: null })
        return null
      }

      try {
        const data = await exchangeRefreshToken(refreshToken)
        const expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000

        await chrome.storage.local.set({
          firebaseToken: data.id_token,
          firebaseRefreshToken: data.refresh_token,
          firebaseTokenExpiry: expiresAt,
          userId: data.user_id,
        })

        set({ token: data.id_token })
        return data.id_token
      } catch {
        // Session expirée → déconnexion
        set({ user: null, token: null })
        await chrome.storage.local.remove([
          'firebaseToken', 'firebaseRefreshToken', 'firebaseUser',
          'firebaseTokenExpiry', 'userId',
        ])
        return null
      }
    },
  }
})

// ── Écoute les changements de storage.local pour rafraîchir la session ─────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes['firebaseToken'] || changes['firebaseUser'])) {
    console.log('[auth-store] Storage changé, rechargement de la session...')
    useAuthStore.getState().loadSession()
  }
})
