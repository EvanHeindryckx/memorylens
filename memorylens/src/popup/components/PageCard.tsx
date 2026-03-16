import { useState, useCallback } from 'react'
import { ExternalLink, Trash2, Clock, Globe, Pin, PinOff, Tag, StickyNote, FolderPlus, X, Check } from 'lucide-react'
import { timeAgo, formatDuration } from '@/core/utils'
import { togglePinPage, updatePageTags, updatePageNotes } from '@/core/db/pages-store'
import { useCollections } from '@/hooks/useCollections'
import type { SavedPage } from '@/types/page.types'

const CATEGORY_COLORS: Record<string, string> = {
  article:       'bg-blue-500/20 text-blue-300',
  video:         'bg-red-500/20 text-red-300',
  product:       'bg-yellow-500/20 text-yellow-300',
  documentation: 'bg-green-500/20 text-green-300',
  social:        'bg-pink-500/20 text-pink-300',
  tool:          'bg-purple-500/20 text-purple-300',
  other:         'bg-zinc-500/20 text-zinc-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  article: 'Article', video: 'Vidéo', product: 'Produit',
  documentation: 'Doc', social: 'Social', tool: 'Outil', other: 'Autre',
}

const MAX_TAGS = 10

interface Props {
  page: SavedPage
  snippet?: string
  score?: number
  onDelete: (id: string) => void
  onUpdate?: (id: string, patch: Partial<SavedPage>) => void
}

export default function PageCard({ page, snippet, score, onDelete, onUpdate }: Props) {
  const [showConfirm, setShowConfirm]         = useState(false)
  const [pinned, setPinned]                   = useState(!!page.pinned)
  const [tags, setTags]                       = useState<string[]>(page.tags ?? [])
  const [notes, setNotes]                     = useState(page.notes ?? '')
  const [showTagInput, setShowTagInput]       = useState(false)
  const [showNotes, setShowNotes]             = useState(false)
  const [showCollPicker, setShowCollPicker]   = useState(false)
  const [tagInput, setTagInput]               = useState('')
  const [savingNotes, setSavingNotes]         = useState(false)
  const { collections, addPage } = useCollections()

  const open = () => chrome.tabs.create({ url: page.url })

  const handleDelete = () => {
    if (showConfirm) { onDelete(page.id); return }
    setShowConfirm(true)
    setTimeout(() => setShowConfirm(false), 2000)
  }

  const handlePin = async () => {
    const next = await togglePinPage(page.id)
    setPinned(next)
    onUpdate?.(page.id, { pinned: next })
  }

  const handleAddTag = async () => {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t) || tags.length >= MAX_TAGS) { setTagInput(''); return }
    const next = [...tags, t]
    setTags(next)
    setTagInput('')
    await updatePageTags(page.id, next)
    onUpdate?.(page.id, { tags: next })
  }

  const handleRemoveTag = async (tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    await updatePageTags(page.id, next)
    onUpdate?.(page.id, { tags: next })
  }

  const handleSaveNotes = useCallback(async () => {
    setSavingNotes(true)
    await updatePageNotes(page.id, notes)
    onUpdate?.(page.id, { notes })
    setTimeout(() => setSavingNotes(false), 800)
  }, [page.id, notes, onUpdate])

  const handleAddToCollection = async (colId: string) => {
    await addPage(colId, page.id)
    setShowCollPicker(false)
  }

  return (
    <div className={`card p-3 mb-2 group transition-all ${pinned ? 'border-brand-600/60 bg-brand-950/20' : ''}`}>

      {/* ── Top row ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={page.favicon} alt="" className="w-4 h-4 rounded flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <span className="text-xs text-zinc-500 truncate">{page.domain}</span>
          <span className={`badge hidden group-hover:inline-flex ${CATEGORY_COLORS[page.category]}`}>
            {CATEGORY_LABELS[page.category]}
          </span>
          {pinned && <Pin className="w-3 h-3 text-brand-400 flex-shrink-0" />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBtn onClick={handlePin} title={pinned ? 'Désépingler' : 'Épingler'}>
            {pinned ? <PinOff className="w-3.5 h-3.5 text-brand-400" /> : <Pin className="w-3.5 h-3.5" />}
          </ActionBtn>
          <ActionBtn onClick={() => { setShowTagInput(v => !v); setShowNotes(false); setShowCollPicker(false) }} title="Tags">
            <Tag className="w-3.5 h-3.5" />
          </ActionBtn>
          <ActionBtn onClick={() => { setShowNotes(v => !v); setShowTagInput(false); setShowCollPicker(false) }} title="Notes">
            <StickyNote className={`w-3.5 h-3.5 ${notes ? 'text-yellow-400' : ''}`} />
          </ActionBtn>
          <ActionBtn onClick={() => { setShowCollPicker(v => !v); setShowTagInput(false); setShowNotes(false) }} title="Ajouter à une collection">
            <FolderPlus className="w-3.5 h-3.5" />
          </ActionBtn>
          <ActionBtn onClick={open} title="Ouvrir">
            <ExternalLink className="w-3.5 h-3.5" />
          </ActionBtn>
          <ActionBtn
            onClick={handleDelete}
            title={showConfirm ? 'Cliquer pour confirmer' : 'Supprimer'}
            className={showConfirm ? 'text-red-400' : ''}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </ActionBtn>
        </div>
      </div>

      {/* ── Title ── */}
      <button onClick={open}
        className="text-sm font-medium text-white hover:text-brand-400 transition-colors text-left leading-snug mt-1.5 line-clamp-2 w-full">
        {page.title}
      </button>

      {/* ── Snippet ── */}
      {snippet && (
        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{snippet}</p>
      )}

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map(tag => (
            <span key={tag}
              className="flex items-center gap-1 text-[11px] bg-brand-600/20 text-brand-300 px-2 py-0.5 rounded-full">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Tag input (expandable) ── */}
      {showTagInput && (
        <div className="mt-2">
          {tags.length >= MAX_TAGS ? (
            <p className="text-xs text-zinc-500 text-center py-1">
              Limite de {MAX_TAGS} tags atteinte
            </p>
          ) : (
            <div className="flex gap-1.5">
              <input autoFocus value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setShowTagInput(false) }}
                placeholder="Nouveau tag…" className="input text-xs py-1 flex-1" />
              <button onClick={handleAddTag} className="btn-primary py-1 px-2 text-xs">
                <Check className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Notes inline (expandable) ── */}
      {showNotes && (
        <div className="mt-2">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            rows={3} placeholder="Ajouter une note…"
            className="input text-xs py-1.5 resize-none w-full" />
          <div className="flex justify-end mt-1">
            <button onClick={handleSaveNotes}
              className={`text-xs px-2 py-1 rounded transition-colors ${savingNotes ? 'text-green-400' : 'text-zinc-500 hover:text-white'}`}>
              {savingNotes ? '✓ Sauvegardé' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* ── Collection picker (expandable) ── */}
      {showCollPicker && (
        <div className="mt-2 border border-surface-600 rounded-lg overflow-hidden">
          {collections.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-2">Aucune collection. Créez-en une dans l'onglet Collections.</p>
          ) : (
            collections.map(col => (
              <button key={col.id} onClick={() => handleAddToCollection(col.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-700 transition-colors text-left">
                <span>{col.icon}</span>
                <span className="font-medium" style={{ color: col.color }}>{col.name}</span>
                <span className="text-zinc-600 ml-auto">{col.pageIds.length} pages</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Meta ── */}
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="w-3 h-3" />{timeAgo(page.visitedAt)}
        </span>
        {page.duration > 0 && (
          <span className="flex items-center gap-1 text-xs text-zinc-600">
            <Globe className="w-3 h-3" />{formatDuration(page.duration)}
          </span>
        )}
        {score !== undefined && (
          <span className="ml-auto text-xs text-brand-500 font-medium">
            {Math.round(score * 100)}% match
          </span>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ onClick, title, children, className = '' }: {
  onClick: () => void; title: string; children: React.ReactNode; className?: string
}) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1 text-zinc-500 hover:text-white transition-colors ${className}`}>
      {children}
    </button>
  )
}
