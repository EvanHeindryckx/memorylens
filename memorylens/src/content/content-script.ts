import { Readability } from '@mozilla/readability'

interface ExtractedContent {
  title: string
  content: string
  summary: string
}

function extractContent(): ExtractedContent {
  // Clone le document pour ne pas modifier la page
  const docClone = document.cloneNode(true) as Document
  const reader = new Readability(docClone)
  const article = reader.parse()

  const rawText = article?.textContent || document.body.innerText || ''
  const cleaned = rawText.replace(/\s+/g, ' ').trim().slice(0, 5000)
  const summary = cleaned.slice(0, 300)

  return {
    title: article?.title || document.title || '',
    content: cleaned,
    summary,
  }
}

// Écoute les messages du service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    try {
      const data = extractContent()
      sendResponse({ success: true, data })
    } catch (err) {
      sendResponse({ success: false, data: { title: document.title, content: '', summary: '' } })
    }
    return true // async
  }
})
