import { Shield, Cloud, Loader2 } from 'lucide-react'
import { useSyncStore } from '@/store/sync-store'
import { useBillingStore } from '@/store/billing-store'
import { useAuthStore } from '@/store/auth-store'

interface Props {
  total: number
}

export default function StatusBar({ total }: Props) {
  const { status } = useSyncStore()
  const { isPro } = useBillingStore()
  const { user } = useAuthStore()

  const handleSync = async () => {
    if (!user) return
    const { sync } = useSyncStore.getState()
    await sync()
  }

  const isSyncing = status === 'syncing'
  const isProAndConnected = isPro() && user

  return (
    <div className="flex items-center gap-2 mr-1">
      <span className="text-xs text-zinc-500">{total} pages</span>
      
      {/* Cloud Sync button (Pro only) */}
      {isProAndConnected && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Synchroniser avec le cloud"
        >
          {isSyncing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Cloud className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">{isSyncing ? 'Sync...' : 'Sync'}</span>
        </button>
      )}

      <div className="flex items-center gap-1 text-xs text-green-400" title="100% local — vos données ne quittent jamais votre appareil">
        <Shield className="w-3 h-3" />
        <span className="hidden sm:inline">Local</span>
      </div>
    </div>
  )
}
