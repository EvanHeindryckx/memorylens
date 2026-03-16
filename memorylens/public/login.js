// Backend URL — déterminer dynamiquement
const BACKEND_URL = window.location.origin

const btnGoogle = document.getElementById('btnGoogle')
const errorDiv = document.getElementById('error')

btnGoogle.onclick = async () => {
  btnGoogle.disabled = true
  btnGoogle.innerHTML = '<span class="spinner"></span> Connexion…'
  errorDiv.classList.remove('show')

  try {
    // Récupère l'URL d'authentification Google depuis le backend
    const res = await fetch(`${BACKEND_URL}/auth/google-login`, {
      method: 'POST',
    })

    if (!res.ok) {
      throw new Error('Erreur de connexion')
    }

    const data = await res.json()

    // Redirige vers Google (remplace la page actuelle)
    window.location.href = data.authUrl
  } catch (error) {
    btnGoogle.disabled = false
    btnGoogle.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">🔵</span> Continuer avec Google'
    errorDiv.textContent = error instanceof Error ? error.message : 'Erreur de connexion'
    errorDiv.classList.add('show')
  }
}
