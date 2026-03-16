import { Clock4, ExternalLink, RefreshCw } from 'lucide-react'
import { useResuface } from '@/hooks/useResuface'
import { timeAgo } from '@/core/utils'

export default function ResurfaceView() {
  const { items, loading, load } = useResuface()

  if (loading) return (
    <div className="space-y-2">
      {[1,2,3].map(i => (
        <div key={i} className="card p-3 animate-pulse">
          <div className="h-2 bg-surface-600 rounded w-1/2 mb-2" />
          <div className="h-3 bg-surface-700 rounded w-3/4" />
        </div>
      ))}
    </div>
  )

  if (items.length === 0) return (
    <div className="text-center py-10 text-zinc-500">
      <Clock4 className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">Rien à re-surfacer pour l'instant</p>
      <p className="text-xs text-zinc-600 mt-1">Revenez après quelques jours de navigation</p>
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-zinc-500">Souviens-toi de ces pages…</p>
        <button onClick={load} className="btn-ghost p-1" title="Rafraîchir">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {items.map(({ page, message }) => (
        <div key={page.id} className="card p-3 border-l-2 border-brand-600">
          {/* Message */}
          <p className="text-xs text-brand-400 font-medium mb-1.5">{message}</p>

          {/* Page */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <img
                  src={page.favicon} alt="" className="w-3.5 h-3.5 rounded"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-xs text-zinc-500">{page.domain}</span>
              </div>
              <p className="text-sm font-medium text-white line-clamp-2 leading-snug">
                {page.title}
              </p>
              {page.summary && (
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{page.summary}</p>
              )}
              <p className="text-xs text-zinc-600 mt-1.5">{timeAgo(page.visitedAt)}</p>
            </div>
            <button
              onClick={() => chrome.tabs.create({ url: page.url })}
              className="flex-shrink-0 p-1.5 text-zinc-500 hover:text-brand-400 transition-colors"
              title="Rouvrir"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
