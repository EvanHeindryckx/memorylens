import { useState, useEffect, useRef } from 'react'
import { Search, Clock, Settings, Brain, X, Calendar, FolderOpen, Clock4, BarChart2, Zap, Crown, User } from 'lucide-react'
import { useSearch } from '@/hooks/useSearch'
import { useHistory } from '@/hooks/useHistory'
import { usePreferencesStore } from '@/store/preferences-store'
import { useBillingStore } from '@/store/billing-store'
import { useAuthStore } from '@/store/auth-store'
import SearchBar from './components/SearchBar'
import PageCard from './components/PageCard'
import RecentPages from './components/RecentPages'
import StatusBar from './components/StatusBar'
import CalendarView from './components/CalendarView'
import CollectionsView from './components/CollectionsView'
import ResurfaceView from './components/ResurfaceView'
import AnalyticsView from './components/AnalyticsView'
import UpgradeView from './components/UpgradeView'
import AccountView from './components/AccountView'

type View = 'home' | 'search' | 'calendar' | 'collections' | 'resuface' | 'analytics' | 'upgrade' | 'account'

const TABS: { id: View; icon: React.ReactNode; label: string }[] = [
  { id: 'home',        icon: <Clock className="w-3.5 h-3.5" />,       label: 'Récent'      },
  { id: 'calendar',   icon: <Calendar className="w-3.5 h-3.5" />,    label: 'Calendrier'  },
  { id: 'collections',icon: <FolderOpen className="w-3.5 h-3.5" />,  label: 'Collections' },
  { id: 'resuface',   icon: <Clock4 className="w-3.5 h-3.5" />,      label: 'Souvenirs'   },
  { id: 'analytics',  icon: <BarChart2 className="w-3.5 h-3.5" />,   label: 'Stats'       },
]

export default function App() {
  const [view, setView] = useState<View>('home')
  const { results, loading, query, search, clear } = useSearch()
  const { pages, total, load, remove, update } = useHistory(50)
  const { load: loadPrefs } = usePreferencesStore()
  const { load: loadBilling, isPro } = useBillingStore()
  const { user, loadSession } = useAuthStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPrefs()
    load()
    loadBilling()
    loadSession()

    // ── Listener pour détecter les changements de session ──────────────────────
    // Recharge la session si les données changent dans chrome.storage.local
    // (ex: après connexion Google depuis un autre onglet)
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && (changes.firebaseToken || changes.firebaseUser)) {
        console.log('[popup] Changement détecté dans chrome.storage.local, rechargement...')
        loadSession()
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    // Cleanup
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [loadPrefs, load, loadBilling, loadSession])

  useEffect(() => {
    if (view === 'home' || view === 'search') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [view])

  const handleSearch = (q: string) => {
    search(q)
    if (q.trim()) setView('search')
    else setView('home')
  }

  const handleClear = () => {
    clear()
    setView('home')
    inputRef.current?.focus()
  }

  const isSearchView = view === 'search'
  const pro = isPro()

  return (
    <div className="flex flex-col bg-surface-900 text-white" style={{ width: 420, height: 600 }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-brand-500" />
          <span className="font-semibold text-sm tracking-wide">MemoryLens</span>
          <span className="text-[10px] bg-brand-600/30 text-brand-400 px-1.5 py-0.5 rounded font-medium">v1.7</span>
        </div>
        <div className="flex items-center gap-1">
          <StatusBar total={total} />

          {/* Badge plan */}
          {pro ? (
            <button
              onClick={() => setView('account')}
              className="flex items-center gap-1 text-[10px] bg-brand-600/30 text-brand-400 px-1.5 py-0.5 rounded font-medium hover:bg-brand-600/50 transition-colors"
              title="Abonnement Pro actif"
            >
              <Crown className="w-3 h-3" /> Pro
            </button>
          ) : (
            <button
              onClick={() => setView('upgrade')}
              className="flex items-center gap-1 text-[10px] bg-zinc-700 hover:bg-brand-600/40 text-zinc-300 hover:text-brand-400 px-1.5 py-0.5 rounded font-medium transition-colors"
              title="Passer à Pro"
            >
              <Zap className="w-3 h-3" /> Pro
            </button>
          )}

          {/* Avatar / Compte */}
          <button
            onClick={() => setView('account')}
            className="ml-0.5 rounded-full overflow-hidden hover:ring-2 hover:ring-brand-500 transition-all"
            title={user ? user.displayName ?? 'Mon compte' : 'Se connecter'}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} className="w-6 h-6 rounded-full" alt="" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-surface-600 hover:bg-surface-500 flex items-center justify-center transition-colors">
                <User className="w-3.5 h-3.5 text-zinc-400" />
              </div>
            )}
          </button>

          <button onClick={() => chrome.runtime.openOptionsPage()} className="btn-ghost p-1.5" title="Paramètres">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="px-4 py-3 flex-shrink-0">
        <SearchBar
          ref={inputRef}
          onSearch={handleSearch}
          onClear={handleClear}
          loading={loading}
          hasQuery={!!query}
        />
      </div>

      {/* ── Nav Tabs ── */}
      {!isSearchView && view !== 'upgrade' && view !== 'account' && (
        <div className="flex px-2 gap-0.5 mb-2 flex-shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0
                ${view === tab.id ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-surface-700'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">

        {isSearchView && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-zinc-400">
                {loading ? 'Recherche…' : `${results.length} résultat${results.length !== 1 ? 's' : ''} pour "${query}"`}
              </span>
              <button onClick={handleClear} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors">
                <X className="w-3 h-3" /> Effacer
              </button>
            </div>
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card p-3 animate-pulse">
                    <div className="h-3 bg-surface-600 rounded w-3/4 mb-2" />
                    <div className="h-2 bg-surface-700 rounded w-full mb-1" />
                    <div className="h-2 bg-surface-700 rounded w-2/3" />
                  </div>
                ))}
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aucune page trouvée</p>
                <p className="text-xs mt-1">Essayez d'autres mots-clés</p>
              </div>
            )}
            {!loading && results.map(r => (
              <PageCard key={r.page.id} page={r.page} snippet={r.snippet} score={r.score} onDelete={remove} onUpdate={update} />
            ))}
          </div>
        )}

        {view === 'home'         && <RecentPages pages={pages} onDelete={remove} onUpdate={update} />}
        {view === 'calendar'     && <CalendarView onDelete={remove} />}
        {view === 'collections'  && <CollectionsView onDelete={remove} />}
        {view === 'resuface'     && <ResurfaceView />}
        {view === 'analytics'    && <AnalyticsView />}
        {view === 'upgrade'      && <UpgradeView />}
        {view === 'account'      && <AccountView />}
      </div>
    </div>
  )
}
