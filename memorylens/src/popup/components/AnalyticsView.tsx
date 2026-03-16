import { useAnalytics } from '@/hooks/useAnalytics'
import { useBillingStore } from '@/store/billing-store'
import { TrendingUp, TrendingDown, Minus, Lock } from 'lucide-react'
import { formatDuration } from '@/core/utils'

const CATEGORY_LABELS: Record<string, string> = {
  article: 'Articles', video: 'Vidéos', product: 'Produits',
  documentation: 'Docs', social: 'Réseaux', tool: 'Outils', other: 'Autres',
}
const CATEGORY_COLORS: Record<string, string> = {
  article: '#3b82f6', video: '#ef4444', product: '#f59e0b',
  documentation: '#10b981', social: '#ec4899', tool: '#8b5cf6', other: '#6b7280',
}

export default function AnalyticsView() {
  const { domainStats, dayStats, categories, pace, loading } = useAnalytics(30)
  const { isPro } = useBillingStore()

  // ── Verrouiller les analytics avancées pour Free ──────────────────────────
  if (!isPro()) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-orange-600/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-orange-400" />
        </div>
        <div>
          <p className="font-semibold text-white text-base">Analytics avancées</p>
          <p className="text-xs text-zinc-400 mt-2 max-w-xs">
            Les statistiques détaillées et l'analyse de vos habitudes de navigation sont réservées au plan Pro.
          </p>
        </div>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-xs text-brand-400 hover:text-brand-300 underline transition-colors mt-2"
        >
          Passer à Pro
        </button>
      </div>
    )
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="card p-3 animate-pulse h-16" />)}
    </div>
  )

  const maxDay = Math.max(...dayStats.map(d => d.count), 1)
  const totalPages = dayStats.reduce((s, d) => s + d.count, 0)
  const trend = pace.lastWeek === 0 ? 0 : Math.round(((pace.thisWeek - pace.lastWeek) / pace.lastWeek) * 100)

  return (
    <div className="space-y-4">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="30 derniers jours" value={totalPages.toString()} sub="pages visitées" />
        <KpiCard
          label="Cette semaine"
          value={pace.thisWeek.toString()}
          sub={trend > 0 ? `+${trend}% vs semaine passée` : trend < 0 ? `${trend}% vs semaine passée` : 'stable'}
          trend={trend}
        />
      </div>

      {/* ── Activity Bar Chart (30 jours) ── */}
      <div className="card p-3">
        <p className="text-xs font-semibold text-zinc-400 mb-3">Activité quotidienne</p>
        <div className="flex items-end gap-0.5 h-16">
          {dayStats.slice(-30).map((d) => {
            const h = Math.round((d.count / maxDay) * 100)
            const isToday = d.date === new Date().toISOString().slice(0, 10)
            return (
              <div
                key={d.date}
                title={`${d.date} · ${d.count} pages`}
                style={{ height: `${Math.max(h, d.count > 0 ? 8 : 2)}%` }}
                className={`flex-1 rounded-sm transition-all cursor-default
                  ${isToday ? 'bg-brand-400' : d.count > 0 ? 'bg-brand-600 hover:bg-brand-500' : 'bg-surface-700'}`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
          <span>-30j</span><span>Aujourd'hui</span>
        </div>
      </div>

      {/* ── Top Domaines ── */}
      {domainStats.length > 0 && (
        <div className="card p-3">
          <p className="text-xs font-semibold text-zinc-400 mb-3">Sites les plus visités</p>
          <div className="space-y-2">
            {domainStats.slice(0, 5).map((d, i) => {
              const pct = Math.round((d.count / (domainStats[0]?.count || 1)) * 100)
              return (
                <div key={d.domain}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-zinc-600 w-4 text-right">{i + 1}</span>
                      <img src={d.favicon} alt="" className="w-3.5 h-3.5 rounded"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span className="text-xs text-zinc-300 truncate">{d.domain}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.totalDuration > 0 && (
                        <span className="text-xs text-zinc-600">{formatDuration(d.totalDuration)}</span>
                      )}
                      <span className="text-xs font-medium text-white">{d.count}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Catégories ── */}
      {categories.length > 0 && (
        <div className="card p-3">
          <p className="text-xs font-semibold text-zinc-400 mb-3">Répartition par type</p>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
            {categories.map(c => {
              const pct = Math.round((c.count / totalPages) * 100)
              return (
                <div
                  key={c.category}
                  style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[c.category] ?? '#6b7280' }}
                  title={`${CATEGORY_LABELS[c.category] ?? c.category}: ${pct}%`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <div key={c.category} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.category] ?? '#6b7280' }} />
                <span className="text-xs text-zinc-400">
                  {CATEGORY_LABELS[c.category] ?? c.category} ({c.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, trend }: {
  label: string; value: string; sub: string; trend?: number
}) {
  return (
    <div className="card p-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-brand-400">{value}</p>
      <div className="flex items-center gap-1 mt-0.5">
        {trend !== undefined && trend !== 0 && (
          trend > 0
            ? <TrendingUp className="w-3 h-3 text-green-400" />
            : <TrendingDown className="w-3 h-3 text-red-400" />
        )}
        {trend === 0 && <Minus className="w-3 h-3 text-zinc-500" />}
        <p className={`text-xs ${trend && trend > 0 ? 'text-green-400' : trend && trend < 0 ? 'text-red-400' : 'text-zinc-500'}`}>{sub}</p>
      </div>
    </div>
  )
}
