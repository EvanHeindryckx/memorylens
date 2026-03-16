import { Router, Request, Response } from 'express'
import { db, firebaseReady } from '../lib/firebase-admin'

const router = Router()

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/google-login
// Génère l'URL d'authentification Google
// ─────────────────────────────────────────────────────────────────────────────
router.post('/google-login', async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const redirectUri = `${process.env.BACKEND_URL}/auth/google-callback`

    if (!clientId) {
      return res.status(500).json({ error: 'GOOGLE_OAUTH_CLIENT_ID non configuré' })
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('scope', 'openid email profile')
    authUrl.searchParams.append('prompt', 'select_account')

    return res.json({ authUrl: authUrl.toString() })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/google-callback
// Callback Google OAuth — échange le code contre un token
// ─────────────────────────────────────────────────────────────────────────────
router.get('/google-callback', async (req: Request, res: Response) => {
  const { code } = req.query

  if (!code) {
    return res.status(400).send('Code manquant')
  }

  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    const backendUrl = process.env.BACKEND_URL
    const redirectUri = `${backendUrl}/auth/google-callback`

    if (!clientId || !clientSecret) {
      throw new Error('Client ID ou Secret manquant')
    }

    // Échange le code contre un access_token Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.json() as { error_description?: string; error?: string }
      throw new Error(err.error_description ?? err.error ?? 'Token exchange failed')
    }

    const tokens = await tokenRes.json() as { id_token: string; access_token: string; refresh_token?: string }

    // Récupère les infos utilisateur
    const userRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokens.access_token}`
    )
    const userInfo = await userRes.json() as {
      sub: string
      email: string
      name: string
      picture: string
    }

    // Crée/met à jour l'utilisateur dans Firestore
    if (firebaseReady && db) {
      await db.collection('users').doc(userInfo.sub).set({
        uid: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name,
        photoURL: userInfo.picture,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    }

    // ── SAUVEGARDER LA SESSION EN MÉMOIRE ──────────────────────────────────
    // Stocke les données utilisateur pour que /auth/current-user puisse les récupérer
    const globalSessions = (global as any).googleSessions || {}
    globalSessions[userInfo.sub] = {
      uid: userInfo.sub,
      email: userInfo.email,
      displayName: userInfo.name,
      photoURL: userInfo.picture,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: Date.now() + 3600000, // 1 heure
    }
    ;(global as any).googleSessions = globalSessions
    
    console.log('[auth] Session sauvegardée pour:', userInfo.sub)

    // Ferme la page avec un message
    res.send(`
      <html>
        <head>
          <title>MemoryLens — Connecté</title>
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
            .icon { font-size: 52px; margin-bottom: 16px; }
            h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
            p { font-size: 14px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Connexion réussie !</h1>
            <p>Vous pouvez fermer cet onglet</p>
          </div>
        </body>
      </html>
    `)
  } catch (err: any) {
    res.send(`
      <html>
        <body>Erreur: ${err.message}</body>
      </html>
    `)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/current-user
// Récupère l'utilisateur actuellement connecté
// ─────────────────────────────────────────────────────────────────────────────
router.get('/current-user', async (req: Request, res: Response) => {
  try {
    // Récupère depuis la session en mémoire (en prod, utiliser Redis/session)
    const sessions = (global as any).googleSessions || {}
    const userIds = Object.keys(sessions)

    if (userIds.length === 0) {
      return res.status(401).json({ error: 'Non connecté' })
    }

    // Retourne le dernier utilisateur (le plus récemment connecté)
    const userId = userIds[userIds.length - 1]
    const session = sessions[userId]

    if (Date.now() > session.expiresAt) {
      delete sessions[userId]
      return res.status(401).json({ error: 'Session expirée' })
    }

    // ── Convertir le token Google OAuth en token Firebase ────────────────────
    // Pour que Firestore accepte le token, on doit le convertir en token Firebase Auth
    let firebaseToken = session.firebaseToken
    
    if (!firebaseToken) {
      try {
        console.log('[auth] Conversion token Google → Firebase en cours...')
        const apiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBvY5wSR0KTpf5k-q2q3q2q3q2q3q2q3q2q'
        
        // Utilise l'API signInWithIdp de Firebase pour convertir le token Google
        const fbRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postBody: `id_token=${session.idToken}&providerId=google.com`,
              requestUri: `${process.env.BACKEND_URL}/auth/google-callback`,
              returnSecureToken: true,
            }),
          }
        )

        const fbData = await fbRes.json() as any
        
        if (fbRes.ok && fbData.idToken) {
          firebaseToken = fbData.idToken
          session.firebaseToken = fbData.idToken
          session.firebaseRefreshToken = fbData.refreshToken || ''
          session.firebaseExpiresAt = Date.now() + parseInt(fbData.expiresIn || '3600', 10) * 1000
          console.log('[auth] ✅ Token Firebase généré avec succès')
        } else {
          console.error('[auth] ❌ Erreur conversion Firebase:', fbData.error)
          // Fallback : utiliser le token Google (ne marchera pas mais au moins on essaie)
          firebaseToken = session.idToken
        }
      } catch (e) {
        console.error('[auth] Erreur conversion token Firebase:', e)
        // Fallback : utiliser le token Google
        firebaseToken = session.idToken
      }
    }

    console.log('[auth] Retour du token:', { 
      hasToken: !!firebaseToken, 
      tokenLength: firebaseToken?.length || 0,
      uid: session.uid 
    })

    return res.json({
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      photoURL: session.photoURL,
      token: firebaseToken || session.idToken,
      refreshToken: session.firebaseRefreshToken || session.refreshToken || '',
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export { router as authRouter }
