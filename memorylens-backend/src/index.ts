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
  res.sendFile(path.join(__dirname, '../public/login.html'))
})

app.get('/login.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.js'))
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
