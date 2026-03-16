import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getAllPages } from '@/core/db/pages-store'
import type { SavedPage } from '@/types/page.types'
import PageCard from './PageCard'

export default function CalendarView({ onDelete }: { onDelete: (id: string) => void }) {
  const [current, setCurrent] = useState(new Date())
  const [pagesByDay, setPagesByDay] = useState<Record<string, SavedPage[]>>({})
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const load = useCallback(async () => {
    const pages = await getAllPages()
    const map: Record<string, SavedPage[]> = {}
    for (const p of pages) {
      // ⚠️ Utiliser la date locale (fr-CA → YYYY-MM-DD) pour éviter le bug UTC à minuit
      const d = new Date(p.visitedAt).toLocaleDateString('fr-CA')
      if (!map[d]) map[d] = []
      map[d].push(p)
    }
    setPagesByDay(map)
  }, [])

  useEffect(() => { load() }, [load])

  const year  = current.getFullYear()
  const month = current.getMonth()

  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Adjust for Monday start
  const startOffset = (firstDay + 6) % 7

  const prev = () => setCurrent(new Date(year, month - 1, 1))
  const next = () => setCurrent(new Date(year, month + 1, 1))

  const todayStr = new Date().toLocaleDateString('fr-CA')
  const monthName = current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const selectedPages = selectedDay ? (pagesByDay[selectedDay] ?? []) : []

  return (
    <div className="space-y-3">
      {/* ── Month nav ── */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="btn-ghost p-1"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-semibold capitalize">{monthName}</span>
        <button onClick={next} className="btn-ghost p-1"><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* ── Day headers ── */}
      <div className="grid grid-cols-7 text-center">
        {['L','M','M','J','V','S','D'].map((d, i) => (
          <span key={i} className="text-xs text-zinc-600 font-medium py-1">{d}</span>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells before first day */}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const count = pagesByDay[dateStr]?.length ?? 0
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDay

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDay(isSelected ? null : dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs font-medium transition-all
                ${isSelected ? 'bg-brand-600 text-white' : isToday ? 'bg-brand-900 text-brand-300 ring-1 ring-brand-500' : 'hover:bg-surface-700 text-zinc-300'}
              `}
            >
              <span>{day}</span>
              {count > 0 && (
                <span className={`text-[9px] mt-0.5 font-bold ${isSelected ? 'text-brand-200' : 'text-brand-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Selected day pages ── */}
      {selectedDay && (
        <div className="mt-2 border-t border-surface-700 pt-3">
          <p className="text-xs text-zinc-500 mb-2 font-medium">
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{selectedPages.length} page{selectedPages.length > 1 ? 's' : ''}
          </p>
          {selectedPages.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-3">Aucune page ce jour</p>
          ) : (
            selectedPages.slice().reverse().map(p => (
              <PageCard key={p.id} page={p} onDelete={onDelete} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
