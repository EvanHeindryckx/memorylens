import { useEffect, useState, useRef } from 'react'
import {
  Brain, Shield, Database, Settings, Trash2,
  Plus, X, Save, RotateCcw, CheckCircle, Download, Upload, Sparkles, Bell
} from 'lucide-react'
import { usePreferencesStore } from '@/store/preferences-store'
import { getTotalCount, deleteOldPages, deleteAllPages } from '@/core/db/pages-store'
import { getAllCollections } from '@/core/db/collections-store'
import { exportToJSON, exportToCSV, importFromJSON } from '@/core/utils/export'
import type { CaptureLevel } from '@/types/page.types'

type Tab = 'general' | 'ai' | 'privacy' | 'data'

export default function OptionsApp() {
  const { preferences, loaded, load, save } = usePreferencesStore()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [saved, setSaved] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCollections, setTotalCollections] = useState(0)
  const [newDomain, setNewDomain] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
    getTotalCount().then(setTotalPages)
    getAllCollections().then(c => setTotalCollections(c.length))
  }, [load])

  const handleSave = async (partial: Parameters<typeof save>[0]) => {
    await save(partial)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase()
    if (!d || preferences.excludedDomains.includes(d)) return
    handleSave({ excludedDomains: [...preferences.excludedDomains, d] })
    setNewDomain('')
  }

  const removeDomain = (domain: string) =>
    handleSave({ excludedDomains: preferences.excludedDomains.filter(d => d !== domain) })

  const handleCleanup = async () => {
    const deleted = await deleteOldPages(preferences.retentionDays)
    setTotalPages(prev => prev - deleted)
    alert(`${deleted} pages supprimées.`)
  }

  const handleDeleteAll = async () => {
    if (!confirm("Supprimer TOUT l'historique MemoryLens ? Cette action est irréversible.")) return
    await deleteAllPages()
    setTotalPages(0)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const result = await importFromJSON(file)
      setTotalPages(prev => prev + result.pages)
      alert(`✅ Importé : ${result.pages} pages, ${result.collections} collections.`)
    } catch {
      alert('❌ Erreur lors de l\'import. Vérifiez le fichier.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!loaded) return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <Brain className="w-8 h-8 text-brand-500 animate-pulse" />
    </div>
  )

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Général',         icon: <Settings className="w-4 h-4" /> },
    { id: 'ai',      label: 'IA',               icon: <Sparkles className="w-4 h-4" /> },
    { id: 'privacy', label: 'Confidentialité',  icon: <Shield className="w-4 h-4" /> },
    { id: 'data',    label: 'Données',           icon: <Database className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      {/* ── Header ── */}
      <div className="border-b border-surface-700 bg-surface-800">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-brand-500" />
            <div>
              <h1 className="font-bold text-lg">MemoryLens</h1>
              <p className="text-xs text-zinc-500">Paramètres · v1.7</p>
            </div>
          </div>
          {saved && (
            <div className="flex items-center gap-2 text-green-400 text-sm animate-pulse">
              <CheckCircle className="w-4 h-4" /> Enregistré
            </div>
          )}
        </div>
        <div className="max-w-2xl mx-auto px-6 flex gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >{tab.icon}{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* ── GÉNÉRAL ── */}
        {activeTab === 'general' && (
          <>
            <Section title="Capture" subtitle="Contrôlez ce que MemoryLens mémorise">
              <Toggle label="Capture automatique" description="Enregistre automatiquement les pages visitées"
                value={preferences.captureEnabled} onChange={v => handleSave({ captureEnabled: v })} />
              <div className="mt-4">
                <label className="text-sm font-medium text-white block mb-1">Niveau de capture</label>
                <p className="text-xs text-zinc-500 mb-3">Plus le niveau est élevé, meilleure est la recherche</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['minimal', 'standard', 'full'] as CaptureLevel[]).map(level => (
                    <button key={level} onClick={() => handleSave({ captureLevel: level })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        preferences.captureLevel === level
                          ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                          : 'border-surface-600 bg-surface-700 text-zinc-400 hover:border-surface-500'
                      }`}
                    >
                      <div className="text-sm font-medium capitalize">{level}</div>
                      <div className="text-xs mt-1 opacity-70">
                        {level === 'minimal' && 'Titre + URL'}
                        {level === 'standard' && '+ Résumé IA'}
                        {level === 'full' && '+ Contenu complet'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Rétention" subtitle="Durée de conservation de l'historique">
              <label className="text-sm font-medium text-white block mb-3">
                Conserver pendant <span className="text-brand-400">{preferences.retentionDays} jours</span>
              </label>
              <input type="range" min={7} max={365} step={7}
                value={preferences.retentionDays}
                onChange={e => handleSave({ retentionDays: Number(e.target.value) })}
                className="w-full accent-brand-500" />
              <div className="flex justify-between text-xs text-zinc-600 mt-1">
                <span>7j</span><span>1 an</span>
              </div>
            </Section>

            <Section title="Re-surface" subtitle="Rappels des pages du passé">
              <Toggle label="Activer les souvenirs"
                description="Affiche dans la popup les pages visitées il y a 7, 14, 30 jours…"
                value={preferences.resurfaceEnabled}
                onChange={v => handleSave({ resurfaceEnabled: v })} />
            </Section>

            <Section title="Apparence" subtitle="Personnalisez l'interface">
              <div>
                <label className="text-sm font-medium text-white block mb-3">Thème</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'dark',   label: 'Sombre', icon: '🌙' },
                    { value: 'light',  label: 'Clair',  icon: '☀️' },
                    { value: 'system', label: 'Système', icon: '💻' },
                  ] as { value: 'dark' | 'light' | 'system'; label: string; icon: string }[]).map(t => (
                    <button key={t.value} onClick={() => handleSave({ theme: t.value })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        preferences.theme === t.value
                          ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                          : 'border-surface-600 bg-surface-700 text-zinc-400 hover:border-surface-500'
                      }`}>
                      <div className="text-lg mb-1">{t.icon}</div>
                      <div className="text-xs font-medium">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── IA ── */}
        {activeTab === 'ai' && (
          <>
            <Section title="Gemini Nano" subtitle="IA locale via Chrome Built-in AI (Chrome 127+)">
              <Toggle label="Activer Gemini Nano"
                description="Génère des résumés et tags automatiques lors de la capture"
                value={preferences.geminiEnabled}
                onChange={v => handleSave({ geminiEnabled: v })} />
              {preferences.geminiEnabled && (
                <div className="mt-4 p-3 bg-brand-600/10 border border-brand-600/30 rounded-lg">
                  <p className="text-xs text-brand-300 font-medium mb-1">✨ Gemini Nano activé</p>
                  <p className="text-xs text-zinc-500">
                    Les prochaines pages capturées recevront un résumé et des tags générés automatiquement.
                    Nécessite Chrome 127+ avec le flag <code className="text-brand-400">#prompt-api-for-gemini-nano</code>.
                  </p>
                </div>
              )}
              {!preferences.geminiEnabled && (
                <div className="mt-4 p-3 bg-surface-700 rounded-lg">
                  <p className="text-xs text-zinc-500">
                    Sans Gemini Nano, l'extension utilise un moteur TF-IDF local léger.
                    La recherche reste fonctionnelle mais sans résumés ni tags auto.
                  </p>
                </div>
              )}
            </Section>

            <Section title="Comment activer Gemini Nano" subtitle="Instructions pour Chrome 127+">
              <ol className="space-y-2">
                {[
                  'Ouvre chrome://flags dans Chrome',
                  'Cherche "Prompt API for Gemini Nano"',
                  'Active le flag et redémarre Chrome',
                  'Retourne ici et active Gemini Nano ci-dessus',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                    <span className="w-5 h-5 rounded-full bg-brand-600/30 text-brand-400 flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </Section>
          </>
        )}

        {/* ── CONFIDENTIALITÉ ── */}
        {activeTab === 'privacy' && (
          <>
            <Section title="Domaines exclus" subtitle="Ces domaines ne seront jamais capturés">
              <div className="flex gap-2 mb-3">
                <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDomain()}
                  placeholder="ex: monsite.com" className="input flex-1" />
                <button onClick={addDomain} className="btn-primary flex items-center gap-1.5 px-3">
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {preferences.excludedDomains.map(domain => (
                  <div key={domain} className="flex items-center justify-between bg-surface-700 rounded-lg px-3 py-2">
                    <span className="text-sm text-zinc-300">{domain}</span>
                    <button onClick={() => removeDomain(domain)} className="text-zinc-500 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Vie privée" subtitle="MemoryLens respecte vos données">
              <div className="space-y-3">
                {[
                  { icon: '🔒', text: 'Toutes vos données restent sur votre appareil' },
                  { icon: '🚫', text: 'Aucune donnée envoyée à des serveurs externes' },
                  { icon: '🧠', text: "L'IA fonctionne entièrement en local" },
                  { icon: '🗑️', text: 'Suppression complète possible à tout moment' },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-3 text-sm text-zinc-400">
                    <span>{item.icon}</span><span>{item.text}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ── DONNÉES ── */}
        {activeTab === 'data' && (
          <>
            <Section title="Statistiques" subtitle="Vos données MemoryLens">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Pages" value={totalPages.toLocaleString()} />
                <StatCard label="Collections" value={totalCollections.toString()} />
                <StatCard label="Rétention" value={`${preferences.retentionDays}j`} />
              </div>
            </Section>

            <Section title="Export" subtitle="Sauvegardez ou transférez vos données">
              <div className="space-y-3">
                <ActionRow icon={<Download className="w-4 h-4" />}
                  label="Exporter en JSON" description="Inclut pages, collections et embeddings"
                  buttonLabel="JSON" onClick={exportToJSON} variant="secondary" />
                <ActionRow icon={<Download className="w-4 h-4" />}
                  label="Exporter en CSV" description="Compatible Excel, Google Sheets"
                  buttonLabel="CSV" onClick={exportToCSV} variant="secondary" />
                <div className="flex items-center justify-between gap-4 bg-surface-700 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-zinc-400 mt-0.5"><Upload className="w-4 h-4" /></span>
                    <div>
                      <p className="text-sm font-medium text-white">Importer un JSON</p>
                      <p className="text-xs text-zinc-500">Restaure un export MemoryLens précédent</p>
                    </div>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-600 text-zinc-300 hover:bg-surface-500 transition-colors disabled:opacity-50">
                    {importing ? 'Import…' : 'Importer'}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
                </div>
              </div>
            </Section>

            <Section title="Maintenance" subtitle="Gérer votre historique">
              <div className="space-y-3">
                <ActionRow icon={<RotateCcw className="w-4 h-4" />}
                  label="Nettoyer les anciennes pages"
                  description={`Supprimer les pages de plus de ${preferences.retentionDays} jours`}
                  buttonLabel="Nettoyer" onClick={handleCleanup} variant="secondary" />
                <ActionRow icon={<Trash2 className="w-4 h-4" />}
                  label="Supprimer tout l'historique"
                  description="Efface définitivement toutes les pages mémorisées"
                  buttonLabel="Tout supprimer" onClick={handleDeleteAll} variant="danger" />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-brand-600' : 'bg-surface-600'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-700 rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-brand-400">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}

function ActionRow({ icon, label, description, buttonLabel, onClick, variant }: {
  icon: React.ReactNode; label: string; description: string; buttonLabel: string; onClick: () => void; variant: 'secondary' | 'danger'
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-surface-700 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <span className={variant === 'danger' ? 'text-red-400 mt-0.5' : 'text-zinc-400 mt-0.5'}>{icon}</span>
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      <button onClick={onClick}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors ${
          variant === 'danger' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-surface-600 text-zinc-300 hover:bg-surface-500'
        }`}>{buttonLabel}</button>
    </div>
  )
}
