const params = new URLSearchParams(window.location.search)
const sessionId = params.get('session_id')

console.log('[stripe-success] URL:', window.location.href)
console.log('[stripe-success] sessionId:', sessionId)
console.log('[stripe-success] chrome available:', typeof chrome !== 'undefined')

async function activate() {
  const statusEl = document.getElementById('status')
  
  if (!sessionId) {
    statusEl.textContent = 'Erreur : session introuvable. URL: ' + window.location.href
    console.error('[stripe-success] sessionId manquant')
    return
  }

  // Vérifier que chrome.runtime est disponible
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    statusEl.textContent = '⚠️ Page ouverte en dehors de l\'extension. Veuillez réessayer depuis l\'extension.'
    console.error('[stripe-success] chrome.runtime non disponible')
    return
  }

  try {
    // Envoie le sessionId au service worker pour vérification
    // Utilise une Promise pour gérer les réponses async correctement
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout vérification (10s)'))
      }, 10000) // 10s timeout

      console.log('[stripe-success] Envoi STRIPE_VERIFY_SESSION au service worker...')

      chrome.runtime.sendMessage(
        { type: 'STRIPE_VERIFY_SESSION', payload: { sessionId } },
        (response) => {
          clearTimeout(timeout)
          console.log('[stripe-success] Réponse reçue:', response)
          
          if (chrome.runtime.lastError) {
            console.error('[stripe-success] Chrome error:', chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError.message))
          } else if (!response) {
            reject(new Error('Pas de réponse du service worker'))
          } else {
            resolve(response)
          }
        }
      )
    })

    if (response?.ok) {
      console.log('[stripe-success] ✅ Plan activé:', response.plan)
      statusEl.textContent = '✅ Pro activé ! Fermeture…'
      // Attendre 2 secondes puis fermer
      setTimeout(() => {
        window.close()
      }, 2000)
    } else {
      const errorMsg = response?.error ?? 'Erreur activation. Réessayez.'
      console.error('[stripe-success] Erreur:', errorMsg)
      statusEl.textContent = '⚠️ ' + errorMsg
    }
  } catch (e) {
    console.error('[stripe-success] Exception:', e)
    statusEl.textContent = '⚠️ Erreur: ' + (e instanceof Error ? e.message : String(e))
  }
}

activate()
