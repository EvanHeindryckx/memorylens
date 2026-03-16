import { useState, useEffect } from 'react'
import { Plus, Trash2, FolderOpen, X, Check, Lock } from 'lucide-react'
import { useCollections } from '@/hooks/useCollections'
import { useBillingStore } from '@/store/billing-store'
import { PLAN_LIMITS } from '@/types/page.types'
import type { SavedPage, Collection } from '@/types/page.types'
import PageCard from './PageCard'

const COLORS = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#db2777','#0891b2']
const ICONS  = ['📁','⭐','💡','🔬','🛍️','📚','🎯','💼','🎨','🔖']

export default function CollectionsView({ onDelete }: { onDelete: (id: string) => void }) {
  const { collections, create, remove, removePage, getPagesForCollection } = useCollections()
  const { billing, isPro } = useBillingStore()
  const [activeCol, setActiveCol]     = useState<string | null>(null)
  const [colPages, setColPages]       = useState<SavedPage[]>([])
  const [showCreate, setShowCreate]   = useState(false)
  const [newName, setNewName]         = useState('')
  const [newColor, setNewColor]       = useState(COLORS[0])
  const [newIcon, setNewIcon]         = useState(ICONS[0])

  useEffect(() => {
    if (!activeCol) { setColPages([]); return }
    getPagesForCollection(activeCol).then(setColPages)
  }, [activeCol, getPagesForCollection])

  const canCreateCollection = isPro() || collections.length < PLAN_LIMITS.free.maxCollections

  const handleCreate = async () => {
    if (!newName.trim()) return
    if (!canCreateCollection) {
      alert(`Limite atteinte : ${PLAN_LIMITS.free.maxCollections} collections max en Free plan`)
      return
    }
    await create(newName.trim(), newColor, newIcon)
    setNewName(''); setShowCreate(false)
  }

  const handleRemovePage = async (pageId: string) => {
    if (!activeCol) return
    await removePage(activeCol, pageId)
    setColPages(prev => prev.filter(p => p.id !== pageId))
    onDelete(pageId)
  }

  const activeCollection = collections.find(c => c.id === activeCol)

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        {activeCol ? (
          <button onClick={() => setActiveCol(null)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" /> Retour
          </button>
        ) : (
          <span className="text-xs text-zinc-500">
            {collections.length}/{isPro() ? '∞' : PLAN_LIMITS.free.maxCollections} collection{collections.length > 1 ? 's' : ''}
          </span>
        )}
        {!activeCol && (
          <button 
            onClick={() => setShowCreate(v => !v)} 
            disabled={!canCreateCollection}
            className="flex items-center gap-1 text-xs btn-primary py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Nouvelle
          </button>
        )}
      </div>

      {/* ── Limite atteinte ── */}
      {!canCreateCollection && !showCreate && (
        <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 rounded-lg px-3 py-2">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Limite Free atteinte ({PLAN_LIMITS.free.maxCollections} max). <a href="#" className="underline">Passer à Pro</a> pour créer plus.</span>
        </div>
      )}

      {/* ── Create form ── */}
      {showCreate && (
        <div className="card p-3 space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nom de la collection…"
            className="input text-sm"
          />
          {/* Icon picker */}
          <div className="flex gap-1.5 flex-wrap">
            {ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => setNewIcon(icon)}
                className={`w-7 h-7 rounded text-sm flex items-center justify-center transition-colors
                  ${newIcon === icon ? 'bg-brand-600' : 'bg-surface-700 hover:bg-surface-600'}`}
              >{icon}</button>
            ))}
          </div>
          {/* Color picker */}
          <div className="flex gap-1.5">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                style={{ backgroundColor: color }}
                className={`w-6 h-6 rounded-full transition-all ${newColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-800 scale-110' : ''}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!canCreateCollection} className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-1.5 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Créer
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-ghost">Annuler</button>
          </div>
        </div>
      )}

      {/* ── Collection list ── */}
      {!activeCol && (
        <div className="space-y-2">
          {collections.length === 0 && !showCreate && (
            <div className="text-center py-8 text-zinc-500">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune collection</p>
              <p className="text-xs text-zinc-600 mt-1">Créez des dossiers pour organiser vos pages</p>
            </div>
          )}
          {collections.map(col => (
            <CollectionRow
              key={col.id}
              col={col}
              onClick={() => setActiveCol(col.id)}
              onDelete={() => remove(col.id)}
            />
          ))}
        </div>
      )}

      {/* ── Collection detail ── */}
      {activeCol && activeCollection && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{activeCollection.icon}</span>
            <span className="font-semibold text-sm" style={{ color: activeCollection.color }}>
              {activeCollection.name}
            </span>
            <span className="text-xs text-zinc-500">({colPages.length} pages)</span>
          </div>
          {colPages.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">
              Aucune page. Ajoutez-en via le clic droit sur une page.
            </p>
          ) : (
            colPages.map(p => (
              <PageCard key={p.id} page={p} onDelete={handleRemovePage} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function CollectionRow({ col, onClick, onDelete }: {
  col: Collection; onClick: () => void; onDelete: () => void
}) {
  return (
    <div
      className="card p-3 flex items-center justify-between gap-2 group cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg">{col.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{col.name}</p>
          <p className="text-xs text-zinc-500">{col.pageIds.length} page{col.pageIds.length > 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
