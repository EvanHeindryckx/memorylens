import { useState, useMemo } from 'react'
import { History, Inbox, Pin } from 'lucide-react'
import PageCard from './PageCard'
import FilterBar, { DEFAULT_FILTERS, type Filters } from './FilterBar'
import type { SavedPage } from '@/types/page.types'

interface Props {
  pages: SavedPage[]
  onDelete: (id: string) => void
  onUpdate?: (id: string, patch: Partial<SavedPage>) => void
}

function applyFilters(pages: SavedPage[], f: Filters): SavedPage[] {
  const now = Date.now()
  const DAY = 86400_000
  return pages.filter(p => {
    if (f.category !== 'all' && p.category !== f.category) return false
    if (f.tag && !(p.tags ?? []).includes(f.tag)) return false
    if (f.domain && p.domain !== f.domain) return false
    if (f.period === 'today' && now - p.visitedAt > DAY) return false
    if (f.period === 'week'  && now - p.visitedAt > 7 * DAY) return false
    if (f.period === 'month' && now - p.visitedAt > 30 * DAY) return false
    return true
  })
}

function groupByDate(pages: SavedPage[]): Record<string, SavedPage[]> {
  const groups: Record<string, SavedPage[]> = {}
  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400_000).toDateString()
  for (const page of pages) {
    const d = new Date(page.visitedAt)
    let label: string
    if (d.toDateString() === today)          label = "Aujourd'hui"
    else if (d.toDateString() === yesterday) label = 'Hier'
    else label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(page)
  }
  return groups
}

export default function RecentPages({ pages, onDelete, onUpdate }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const pinnedPages = useMemo(() => pages.filter(p => p.pinned), [pages])
  const unpinned    = useMemo(() => pages.filter(p => !p.pinned), [pages])
  const allTags     = useMemo(() => [...new Set(pages.flatMap(p => p.tags ?? []))], [pages])
  const allDomains  = useMemo(() => [...new Set(pages.map(p => p.domain))].sort(), [pages])
  const filtered    = useMemo(() => applyFilters(unpinned, filters), [unpinned, filters])
  const groups      = useMemo(() => groupByDate(filtered), [filtered])

  if (pages.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500">
        <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Aucune page mémorisée</p>
        <p className="text-xs mt-1 text-zinc-600">Naviguez sur le web, MemoryLens capture automatiquement.</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Filtres ── */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        availableTags={allTags}
        availableDomains={allDomains}
      />

      {/* ── Épinglées ── */}
      {pinnedPages.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Pin className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Épinglées</span>
            <span className="text-xs text-zinc-600">({pinnedPages.length})</span>
          </div>
          {pinnedPages.map(page => (
            <PageCard key={page.id} page={page} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      )}

      {/* ── Groupes par date ── */}
      {Object.entries(groups).map(([label, groupPages]) => (
        <div key={label} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
            <span className="text-xs text-zinc-600">({groupPages.length})</span>
          </div>
          {groupPages.map(page => (
            <PageCard key={page.id} page={page} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      ))}

      {/* ── Aucun résultat filtré ── */}
      {filtered.length === 0 && pinnedPages.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          <p className="text-sm">Aucune page pour ces filtres</p>
          <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-xs text-brand-400 mt-2 hover:underline">
            Effacer les filtres
          </button>
        </div>
      )}
    </div>
  )
}
