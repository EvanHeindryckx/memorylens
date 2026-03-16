import { useEffect } from 'react'
import { LogIn, LogOut, Crown, Zap, Loader2, AlertCircle, User, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useBillingStore } from '@/store/billing-store'
import { useStripeStore } from '@/store/stripe-store'
import { STRIPE_CONFIG } from '@/store/stripe-store'

export default function AccountView() {
  const { user, loading, error, signInWithGoogle, signOut, loadSession } = useAuthStore()
  const { billing, load: loadBilling, isPro } = useBillingStore()
  const { syncSubscription, openCustomerPortal, startCheckout, status: stripeStatus } = useStripeStore()

  useEffect(() => {
    loadSession()
    loadBilling()
  }, [])

  // Quand l'utilisateur se connecte → sync son plan depuis le backend
  useEffect(() => {
    if (user?.uid) {
      syncSubscription(user.uid)
    }
  }, [user?.uid])

  const handleSignIn = async () => {
    await signInWithGoogle()
    // Après connexion, sync le plan
    const { user: u } = useAuthStore.getState()
    if (u?.uid) await syncSubscription(u.uid)
  }

  const handleUpgrade = async (plan: 'pro') => {
    if (!user) return
    await startCheckout(plan, user.uid, user.email ?? '')
  }

  const handlePortal = async () => {
    if (!user) return
    await openCustomerPortal(user.uid)
  }

  const handleSyncPlan = async () => {
    if (!user) return
    await syncSubscription(user.uid)
  }

  const pro = isPro()

  // ── Non connecté ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center">
          <User className="w-8 h-8 text-zinc-400" />
        </div>

        <div className="text-center">
          <p className="font-semibold text-white text-sm">Créez votre compte</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-[260px]">
            Connectez-vous pour synchroniser votre plan Pro sur tous vos appareils
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 w-full">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="flex items-center gap-2.5 bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors w-full justify-center"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
          )}
          Continuer avec Google
        </button>

        <p className="text-[10px] text-zinc-500 text-center">
          Gratuit · Aucune carte requise · Données locales
        </p>
      </div>
    )
  }

  // ── Connecté ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Profil */}
      <div className="flex items-center gap-3 p-3 bg-surface-700 rounded-xl">
        {user.photoURL ? (
          <img src={user.photoURL} className="w-10 h-10 rounded-full" alt="" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-brand-600/40 flex items-center justify-center">
            <User className="w-5 h-5 text-brand-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{user.displayName ?? 'Utilisateur'}</p>
          <p className="text-xs text-zinc-400 truncate">{user.email}</p>
        </div>
        {pro && (
          <span className="flex items-center gap-1 text-[10px] bg-brand-600/30 text-brand-400 px-2 py-1 rounded-lg font-semibold flex-shrink-0">
            <Crown className="w-3 h-3" /> Pro
          </span>
        )}
      </div>

      {/* Plan actuel */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-300">Abonnement</p>
          <button
            onClick={handleSyncPlan}
            disabled={stripeStatus === 'loading'}
            className="text-zinc-500 hover:text-white transition-colors"
            title="Synchroniser le plan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${stripeStatus === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {pro ? (
          <>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-semibold text-white">Pro actif</span>
            </div>
            {billing.currentPeriodEnd && (
              <p className="text-xs text-zinc-400">
                Renouvellement le {new Date(billing.currentPeriodEnd).toLocaleDateString('fr-FR')}
              </p>
            )}
            <button
              onClick={handlePortal}
              disabled={stripeStatus === 'loading'}
              className="w-full text-xs text-zinc-400 hover:text-white border border-surface-600 hover:border-surface-500 py-2 rounded-lg transition-colors"
            >
              Gérer l'abonnement
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Gratuit</span>
            </div>
            <p className="text-xs text-zinc-500">500 pages · 5 collections · Pas de sync cloud</p>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={stripeStatus === 'loading'}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {stripeStatus === 'loading'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Zap className="w-4 h-4" />}
              Passer à Pro — 4,99€/mois
            </button>
          </>
        )}
      </div>

      {/* Avantages compte */}
      <div className="card p-3 space-y-2">
        <p className="text-xs font-semibold text-zinc-400">Avantages du compte</p>
        {[
          '✅ Plan Pro synchronisé sur tous vos appareils',
          '✅ Historique de paiement accessible',
          '✅ Réactivation instantanée après réinstallation',
        ].map(item => (
          <p key={item} className="text-xs text-zinc-500">{item}</p>
        ))}
      </div>

      {/* Déconnexion */}
      <button
        onClick={signOut}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors py-2"
      >
        <LogOut className="w-3.5 h-3.5" />
        Se déconnecter
      </button>
    </div>
  )
}
