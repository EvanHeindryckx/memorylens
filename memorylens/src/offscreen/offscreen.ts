// Offscreen document : génère des embeddings légers en local
// Implémentation TF-IDF vectorielle pour le MVP (pas besoin de modèle ONNX)

// Augmenter VOCAB_SIZE réduit les collisions de hash et améliore la qualité des embeddings
const VOCAB_SIZE = 2048

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\sàâäéèêëîïôöùûü]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

function generateEmbedding(text: string): number[] {
  const tokens = tokenize(text)
  const vec = new Array(VOCAB_SIZE).fill(0) as number[]

  // TF avec bigrams pour capturer le contexte
  const features: string[] = [...tokens]
  for (let i = 0; i < tokens.length - 1; i++) {
    features.push(`${tokens[i]}_${tokens[i + 1]}`)
  }

  const tf: Record<number, number> = {}
  for (const token of features) {
    const idx = hashString(token) % VOCAB_SIZE
    tf[idx] = (tf[idx] || 0) + 1
  }

  // Normalisation L2
  let norm = 0
  for (const [idx, count] of Object.entries(tf)) {
    const val = count / Math.max(features.length, 1)
    vec[Number(idx)] = val
    norm += val * val
  }
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < VOCAB_SIZE; i++) {
      vec[i] = vec[i] / norm
    }
  }

  return vec
}

// Stopwords FR + EN
const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'not','and','or','but','in','on','at','to','for','of','with','by','from',
  'up','about','into','through','during','this','that','these','those','it',
  'its','we','you','he','she','they','them','their','our','your','my','his','her',
  'le','la','les','un','une','des','du','de','en','et','ou','est','sont','avec',
  'pour','par','sur','dans','qui','que','ce','se','sa','ses','mon','ton','son',
  'nous','vous','ils','elles','leur','leurs','mais','donc','car','ni','or',
  'plus','très','bien','aussi','alors','quand','comme','si','tout','tous',
])

// ─── Gemini Nano (window.ai) ──────────────────────────────────────────────────
async function summarizeWithGemini(content: string): Promise<string> {
  try {
    const ai = (window as unknown as { ai?: { summarizer?: { capabilities: () => Promise<{ available: string }>; create: (o?: object) => Promise<{ summarize: (t: string) => Promise<string>; destroy: () => void }> } } }).ai
    const cap = await ai?.summarizer?.capabilities()
    if (cap?.available !== 'readily') return ''
    const session = await ai!.summarizer!.create({ type: 'tl;dr', format: 'plain-text', length: 'short' })
    const result = await session.summarize(content.slice(0, 4000))
    session.destroy()
    return result
  } catch { return '' }
}

async function generateTagsWithAI(title: string, content: string): Promise<string[]> {
  try {
    const ai = (window as unknown as { ai?: { languageModel?: { capabilities: () => Promise<{ available: string }>; create: (o?: object) => Promise<{ prompt: (t: string) => Promise<string>; destroy: () => void }> } } }).ai
    const cap = await ai?.languageModel?.capabilities()
    if (cap?.available !== 'readily') return []
    const session = await ai!.languageModel!.create({
      systemPrompt: 'Génère 3-5 tags courts en français séparés par des virgules. UNIQUEMENT les tags, sans autre texte.',
    })
    const result = await session.prompt(`Titre: ${title}\nContenu: ${content.slice(0, 400)}`)
    session.destroy()
    return result.split(',').map((t: string) => t.trim().toLowerCase()).filter((t: string) => t.length > 1).slice(0, 5)
  } catch { return [] }
}

// Écoute les messages du service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_EMBEDDING') {
    const { text } = message.payload as { text: string }
    const embedding = generateEmbedding(text)
    sendResponse({ success: true, embedding })
    return true
  }
  if (message.type === 'GENERATE_SUMMARY') {
    const { content } = message.payload as { content: string }
    summarizeWithGemini(content).then(summary => sendResponse({ summary }))
    return true
  }
  if (message.type === 'GENERATE_TAGS') {
    const { title, content } = message.payload as { title: string; content: string }
    generateTagsWithAI(title, content).then(tags => sendResponse({ tags }))
    return true
  }
})
