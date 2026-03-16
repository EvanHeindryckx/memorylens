import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

import { stripeRouter } from './routes/stripe'
import { authRouter } from './routes/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// ── CORS — Restreindre aux domaines autorisés ──────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'chrome-extension://mdeccbgfjhhblhehgphkdeajpeocimmf', // ID extension dev
  process.env.VITE_BACKEND_URL,
  process.env.EXTENSION_SUCCESS_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // En dev, accepter les requêtes sans origin (curl, Postman)
    if (!origin || process.env.NODE_ENV === 'development') {
      callback(null, true)
      return
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS non autorisé pour cette origine'))
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ── Body parser ───────────────────────────────────────────────────────────────
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/stripe', stripeRouter)
app.use('/auth', authRouter)

// ── Servir les fichiers statiques de login ─────────────────────────────────────
app.get('/login', (req, res) => {
  // Servir une page HTML en ligne (pas de lecture de fichier)
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://identitytoolkit.googleapis.com;" />
  <title>MemoryLens — Connexion</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f11;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      text-align: center;
      padding: 48px 40px;
      background: #1a1a1f;
      border-radius: 20px;
      border: 1px solid #2a2a35;
      max-width: 420px;
      width: 100%;
    }
    .logo { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; color: #9ca3af; margin-bottom: 24px; }
    button {
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-google {
      background: white;
      color: #1f2937;
      margin-bottom: 12px;
    }
    .btn-google:hover { background: #f3f4f6; }
    .btn-google:disabled { opacity: 0.5; cursor: not-allowed; }
    .error {
      background: #fee2e2;
      color: #991b1b;
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      font-size: 13px;
      display: none;
    }
    .error.show { display: block; }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .text-sm { font-size: 12px; color: #6b7280; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🧠</div>
    <h1>MemoryLens</h1>
    <p>Connectez-vous pour synchroniser votre compte</p>

    <div id="error" class="error"></div>

    <button id="btnGoogle" class="btn-google">
      <span style="font-size: 18px;">🔵</span>
      Continuer avec Google
    </button>

    <p class="text-sm">Vos données restent locales · Aucune publicité</p>
  </div>

  <script>
    const BACKEND_URL = window.location.origin
    const btnGoogle = document.getElementById('btnGoogle')
    const errorDiv = document.getElementById('error')

    btnGoogle.onclick = async () => {
      btnGoogle.disabled = true
      btnGoogle.innerHTML = '<span class="spinner"></span> Connexion…'
      errorDiv.classList.remove('show')

      try {
        const res = await fetch(\`\${BACKEND_URL}/auth/google-login\`, {
          method: 'POST',
        })

        if (!res.ok) {
          throw new Error('Erreur de connexion')
        }

        const data = await res.json()
        window.location.href = data.authUrl
      } catch (error) {
        btnGoogle.disabled = false
        btnGoogle.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">🔵</span> Continuer avec Google'
        errorDiv.textContent = error instanceof Error ? error.message : 'Erreur de connexion'
        errorDiv.classList.add('show')
      }
    }
  </script>
</body>
</html>`)
})

app.get('/login.js', (req, res) => {
  // Retourner le script JavaScript directement
  res.type('application/javascript').send(`
const BACKEND_URL = window.location.origin

const btnGoogle = document.getElementById('btnGoogle')
const errorDiv = document.getElementById('error')

btnGoogle.onclick = async () => {
  btnGoogle.disabled = true
  btnGoogle.innerHTML = '<span class="spinner"></span> Connexion…'
  errorDiv.classList.remove('show')

  try {
    const res = await fetch(\`\${BACKEND_URL}/auth/google-login\`, {
      method: 'POST',
    })

    if (!res.ok) {
      throw new Error('Erreur de connexion')
    }

    const data = await res.json()
    window.location.href = data.authUrl
  } catch (error) {
    btnGoogle.disabled = false
    btnGoogle.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">🔵</span> Continuer avec Google'
    errorDiv.textContent = error instanceof Error ? error.message : 'Erreur de connexion'
    errorDiv.classList.add('show')
  }
}
`)
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
})

// ── Route succès Stripe ───────────────────────────────────────────────────────
app.get('/stripe/success', (req, res) => {
  const sessionId = (req.query.session_id as string) ?? ''

  if (!sessionId) {
    return res.status(400).send('Erreur : session_id manquant')
  }

  // Récupère l'ID de l'extension depuis le query param ou une variable d'env
  // Pour dev, on peut hardcoder ou utiliser une valeur par défaut
  const extensionId = (req.query.ext as string) ?? process.env.EXTENSION_ID ?? 'mdeccbgfjhhblhehgphkdeajpeocimmf'

  // Redirige vers la page de succès de l'extension avec le session_id
  // La page stripe-success.html de l'extension aura accès à chrome.runtime
  const extensionUrl = `chrome-extension://${extensionId}/stripe-success.html?session_id=${encodeURIComponent(sessionId)}`
  
  console.log(`[Stripe] Redirection succès vers extension: ${extensionUrl}`)
  
  res.redirect(extensionUrl)
})

app.get('/stripe/cancel', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Paiement annulé</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,sans-serif;background:#0f0f11;color:white;
    display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{text-align:center;padding:40px;background:#1a1a1f;border-radius:20px;
    border:1px solid #2a2a35;max-width:400px;width:90%}
  .icon{font-size:52px;margin-bottom:16px}
  h1{font-size:20px;font-weight:700;margin-bottom:8px}
  p{font-size:13px;color:#9ca3af}
</style>
</head>
<body>
<div class="card">
  <div class="icon">❌</div>
  <h1>Paiement annulé</h1>
  <p>Vous pouvez réessayer quand vous le souhaitez.</p>
  <p style="margin-top:16px"><a href="javascript:history.back()" style="color:#7c3aed;text-decoration:none">← Retour</a></p>
</div>
</body>
</html>`)
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ MemoryLens backend running on port ${PORT}`)
  console.log(`   Stripe configuré : ${Boolean(process.env.STRIPE_SECRET_KEY)}`)
  console.log(`   Firebase configuré : ${Boolean(process.env.FIREBASE_PROJECT_ID)}`)
})
