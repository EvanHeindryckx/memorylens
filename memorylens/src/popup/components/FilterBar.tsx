import { useState } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import type { PageCategory } from '@/types/page.types'

export interface Filters {
  category: PageCategory | 'all'
  tag: string
  domain: string
  period: 'all' | 'today' | 'week' | 'month'
}

export const DEFAULT_FILTERS: Filters = {
  category: 'all',
  tag: '',
  domain: '',
  period: 'all',
}

const CATEGORIES: { value: PageCategory | 'all'; label: string }[] = [
  { value: 'all',           label: 'Tout'    },
  { value: 'article',       label: 'Articles' },
  { value: 'video',         label: 'Vidéos'   },
  { value: 'documentation', label: 'Docs'     },
  { value: 'product',       label: 'Produits' },
  { value: 'social',        label: 'Social'   },
  { value: 'tool',          label: 'Outils'   },
]

const PERIODS: { value: Filters['period']; label: string }[] = [
  { value: 'all',   label: 'Tout' },
  { value: 'today', label: "Auj." },
  { value: 'week',  label: '7j'   },
  { value: 'month', label: '30j'  },
]

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  availableTags: string[]
  availableDomains: string[]
}

export default function FilterBar({ filters, onChange, availableTags, availableDomains }: Props) {
  const [open, setOpen] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)

  const isActive = filters.category !== 'all' || filters.tag !== '' || filters.domain !== '' || filters.period !== 'all'

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const reset = () => onChange(DEFAULT_FILTERS)

  return (
    <div className="mb-3">
      {/* ── Toggle button ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors
            ${open || isActive ? 'bg-brand-600 text-white' : 'bg-surface-700 text-zinc-400 hover:text-white'}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtres
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white/70" />}
        </button>

        {/* Active filter chips */}
        {filters.category !== 'all' && (
          <Chip label={CATEGORIES.find(c => c.value === filters.category)?.label ?? filters.category}
            onRemove={() => set({ category: 'all' })} />
        )}
        {filters.period !== 'all' && (
          <Chip label={PERIODS.find(p => p.value === filters.period)?.label ?? filters.period}
            onRemove={() => set({ period: 'all' })} />
        )}
        {filters.tag && <Chip label={`#${filters.tag}`} onRemove={() => set({ tag: '' })} />}
        {filters.domain && <Chip label={filters.domain} onRemove={() => set({ domain: '' })} />}

        {isActive && (
          <button onClick={reset} className="text-xs text-zinc-500 hover:text-white ml-auto transition-colors">
            Tout effacer
          </button>
        )}
      </div>

      {/* ── Filter panel ── */}
      {open && (
        <div className="mt-2 p-3 bg-surface-800 border border-surface-700 rounded-xl space-y-3">

          {/* Catégorie */}
          <div>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mb-1.5">Catégorie</p>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => set({ category: c.value })}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors
                    ${filters.category === c.value ? 'bg-brand-600 text-white' : 'bg-surface-700 text-zinc-400 hover:text-white'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mb-1.5">Période</p>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => set({ period: p.value })}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors
                    ${filters.period === p.value ? 'bg-brand-600 text-white' : 'bg-surface-700 text-zinc-400 hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag */}
          {availableTags.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mb-1.5">Tag</p>
              <div className="flex flex-wrap gap-1">
                {(showAllTags ? availableTags : availableTags.slice(0, 15)).map(tag => (
                  <button key={tag} onClick={() => set({ tag: filters.tag === tag ? '' : tag })}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors
                      ${filters.tag === tag ? 'bg-brand-600 text-white' : 'bg-surface-700 text-zinc-400 hover:text-white'}`}>
                    #{tag}
                  </button>
                ))}
                {availableTags.length > 15 && (
                  <button
                    onClick={() => setShowAllTags(v => !v)}
                    className="flex items-center gap-0.5 text-xs px-2.5 py-1 rounded-full bg-surface-700 text-zinc-500 hover:text-white transition-colors"
                  >
                    {showAllTags
                      ? 'Moins'
                      : `+${availableTags.length - 15} autres`}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showAllTags ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Domaine */}
          {availableDomains.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mb-1.5">Site</p>
              <select value={filters.domain} onChange={e => set({ domain: e.target.value })}
                className="input text-xs py-1.5">
                <option value="">Tous les sites</option>
                {availableDomains.slice(0, 20).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-[11px] bg-brand-600/25 text-brand-300 px-2 py-0.5 rounded-full">
      {label}
      <button onClick={onRemove}><X className="w-2.5 h-2.5" /></button>
    </span>
  )
}
