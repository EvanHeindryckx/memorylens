import { getAllPages } from '@/core/db/pages-store'
import type { ResurfaceItem } from '@/types/page.types'

const RESUFACE_INTERVALS = [7, 14, 30, 60, 90]

/** Retourne la date locale en YYYY-MM-DD (évite les bugs UTC à minuit) */
function localDateStr(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-CA') // fr-CA → YYYY-MM-DD
}

export async function getResurfaceItems(limit = 3): Promise<ResurfaceItem[]> {
  const now = Date.now()
  const pages = await getAllPages()
  const results: ResurfaceItem[] = []

  for (const days of RESUFACE_INTERVALS) {
    const cutoffTs = now - (days + 1) * 86_400_000
    const upperTs  = now - days       * 86_400_000

    const matches = pages.filter(p => {
      if (p.visitedAt < cutoffTs || p.visitedAt >= upperTs) return false
      if (p.duration <= 30 && !p.notes) return false // ignorer les passages rapides sans notes
      return true
    })

    for (const page of matches.slice(0, 2)) {
      results.push({
        page,
        daysAgo: days,
        message:
          days === 7  ? `Il y a une semaine tu lisais…`   :
          days === 14 ? `Il y a 2 semaines tu explorais…` :
                        `Il y a ${days} jours tu consultais…`,
      })
    }
    if (results.length >= limit) break
  }

  // Dédupliquer par page (une même page peut matcher plusieurs intervalles)
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.page.id)) return false
    seen.add(r.page.id)
    return true
  }).slice(0, limit)
}

// Exporté pour les tests et le service-worker
export { localDateStr }
