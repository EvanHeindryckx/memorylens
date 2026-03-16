import { Zap, Check, Loader2, AlertCircle, Crown, LogIn } from 'lucide-react'
import { useStripeStore } from '@/store/stripe-store'
import { useBillingStore } from '@/store/billing-store'
import { useAuthStore } from '@/store/auth-store'
import type { UserPlan } from '@/types/page.types'
import { useEffect, useState } from 'react'

const FEATURES_FREE = [
  '500 pages mémorisées',
  '5 collections',
  'Recherche sémantique',
  'Calendrier & Souvenirs',
]

const FEATURES_PRO = [
  'Pages illimitées',
  'Collections illimitées',
  'Sync cloud (Firebase)',
  'Analytics avancées',
  'Export JSON/CSV',
  'Support prioritaire',
]

export default function UpgradeView() {
  const { status, error, startCheckout, reset } = useStripeStore()
  const { billing, load, isPro } = useBillingStore()
  const { user, loading: authLoading, signInWithGoogle } = useAuthStore()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // ─ Charge le billing au montage
  useEffect(() => {
    load()
  }, [load])

  // ─ Écoute les changements de storage (quand le paiement est confirmé)
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' && changes['billing']) {
        console.log('[UpgradeView] Billing changé:', changes['billing'].newValue)
        setIsRefreshing(true)
        load().then(() => setIsRefreshing(false))
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [load])

  const handleUpgrade = async (_plan: 'pro_monthly' | 'pro_yearly') => {
    // Récupère l'utilisateur connecté
    const session = await new Promise<Record<string, unknown>>(r =>
      chrome.storage.session.get(['userId', 'firebaseUser'], r as (items: Record<string, unknown>) => void)
    )

    const userId = session.userId as string | undefined
    const firebaseUser = session.firebaseUser as { email?: string } | undefined

    if (!userId || !firebaseUser) {
      console.error('[UpgradeView] Utilisateur non connecté')
      return
    }

    const email = firebaseUser.email ?? ''
    const mappedPlan: UserPlan = 'pro'
    await startCheckout(mappedPlan, userId, email)
  }

  // Si connecté et Pro
  if (user && isPro()) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-600/20 flex items-center justify-center">
          <Crown className="w-7 h-7 text-brand-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-base">Vous êtes Pro 🎉</p>
          <p className="text-xs text-zinc-400 mt-1">
            {billing.currentPeriodEnd
              ? `Renouvellement le ${new Date(billing.currentPeriodEnd).toLocaleDateString('fr-FR')}`
              : 'Abonnement actif'}
          </p>
        </div>
        <button
          onClick={async () => {
            const data = await new Promise<Record<string, unknown>>(r =>
              chrome.storage.session.get('userId', r as (items: Record<string, unknown>) => void)
            )
            const { openCustomerPortal } = useStripeStore.getState()
            await openCustomerPortal((data.userId as string) ?? '')
          }}
          className="text-xs text-zinc-400 hover:text-white underline transition-colors"
        >
          Gérer mon abonnement
        </button>
      </div>
    )
  }

  // Si pas connecté → afficher formulaire de connexion
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-600/20 flex items-center justify-center">
          <LogIn className="w-8 h-8 text-brand-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-base">Connexion requise</p>
          <p className="text-xs text-zinc-400 mt-2">
            Connectez-vous avec votre compte Google pour passer à Pro
          </p>
        </div>
        <button
          onClick={() => signInWithGoogle()}
          disabled={authLoading}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
        >
          {authLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {authLoading ? 'Connexion en cours...' : 'Se connecter avec Google'}
        </button>
        <p className="text-[10px] text-zinc-500 max-w-xs">
          Votre abonnement sera lié à votre compte Google et synchronisé sur tous vos appareils.
        </p>
      </div>
    )
  }

  // Si connecté mais pas Pro → afficher plans
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 bg-brand-600/20 text-brand-400 text-xs font-medium px-3 py-1 rounded-full mb-3">
          <Zap className="w-3 h-3" /> Passez à Pro
        </div>
        <p className="text-zinc-400 text-xs">Débloquez toutes les fonctionnalités</p>
      </div>

      {/* Comparaison plans */}
      <div className="grid grid-cols-2 gap-3">
        {/* Free */}
        <div className="card p-3 border border-surface-600">
          <p className="text-xs font-semibold text-zinc-300 mb-1">Gratuit</p>
          <p className="text-lg font-bold text-white mb-3">0€</p>
          <ul className="space-y-1.5">
            {FEATURES_FREE.map(f => (
              <li key={f} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                <Check className="w-3 h-3 text-zinc-500 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="card p-3 border border-brand-500/60 bg-brand-600/10">
          <p className="text-xs font-semibold text-brand-400 mb-1">Pro</p>
          <p className="text-lg font-bold text-white mb-3">
            4,99€<span className="text-xs text-zinc-400 font-normal">/mois</span>
          </p>
          <ul className="space-y-1.5">
            {FEATURES_PRO.map(f => (
              <li key={f} className="flex items-start gap-1.5 text-[11px] text-zinc-300">
                <Check className="w-3 h-3 text-brand-400 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={reset} className="ml-auto text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-2">
        <button
          onClick={() => handleUpgrade('pro_monthly')}
          disabled={status === 'loading' || isRefreshing}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {status === 'loading' || isRefreshing
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Zap className="w-4 h-4" />}
          {isRefreshing ? 'Mise à jour...' : 'Passer à Pro — 4,99€/mois'}
        </button>
        <button
          onClick={() => handleUpgrade('pro_yearly')}
          disabled={status === 'loading' || isRefreshing}
          className="w-full flex items-center justify-center gap-2 bg-surface-700 hover:bg-surface-600 disabled:opacity-50 text-zinc-300 text-xs font-medium py-2 rounded-xl transition-colors border border-surface-600"
        >
          Annuel — 39,99€/an
          <span className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-semibold">-33%</span>
        </button>
      </div>

      <p className="text-center text-[10px] text-zinc-500">
        Paiement sécurisé via Stripe · Annulable à tout moment
      </p>
    </div>
  )
}
