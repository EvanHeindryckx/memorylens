import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { db, firebaseReady } from '../lib/firebase-admin'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

const PLANS: Record<string, string> = {
  pro:         process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_yearly:  process.env.STRIPE_PRICE_PRO_YEARLY!,
}

// ── Rate Limiting simple (pour dev/prod sans dépendance externe) ──────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function rateLimit(windowMs: number = 60000, maxRequests: number = 30) {
  return (req: Request, res: Response, next: () => void) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const record = rateLimitStore.get(key)

    if (record && now < record.resetTime) {
      if (record.count >= maxRequests) {
        return res.status(429).json({ error: 'Trop de requêtes, réessaye plus tard' })
      }
      record.count++
    } else {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    }

    next()
  }
}

// Nettoyer les old entries tous les 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 600000)

// Helper — lecture Firestore safe
async function getUser(userId: string) {
  if (!firebaseReady || !db) return null
  const doc = await db.collection('users').doc(userId).get()
  return doc.exists ? doc.data() : null
}

// Helper — écriture Firestore safe
async function setUser(userId: string, data: Record<string, unknown>) {
  if (!firebaseReady || !db) return
  await db.collection('users').doc(userId).set(data, { merge: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /stripe/create-checkout-session
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  const { userId, email, plan, successUrl } = req.body

  if (!userId || !plan) {
    return res.status(400).json({ error: 'userId et plan sont requis' })
  }

  const priceId = PLANS[plan]
  if (!priceId) {
    return res.status(400).json({ error: `Plan inconnu : ${plan}. Plans dispo: ${Object.keys(PLANS).join(', ')}` })
  }

  try {
    // Récupère ou crée le customer Stripe
    let customerId: string | undefined
    const userData = await getUser(userId)
    customerId = userData?.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        ...(email ? { email } : {}),
        metadata: { firebaseUserId: userId },
      })
      customerId = customer.id
      await setUser(userId, { stripeCustomerId: customerId })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: (() => {
        // Construire l'URL de succès correctement
        const baseUrl = successUrl ?? process.env.EXTENSION_SUCCESS_URL!
        const separator = baseUrl.includes('?') ? '&' : '?'
        return `${baseUrl}${separator}session_id={CHECKOUT_SESSION_ID}`
      })(),
      cancel_url:  `${process.env.EXTENSION_CANCEL_URL}`,
      metadata: { firebaseUserId: userId },
      subscription_data: { metadata: { firebaseUserId: userId } },
    })

    return res.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error('create-checkout-session error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /stripe/verify-session
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-session', async (req: Request, res: Response) => {
  const { sessionId, userId } = req.body
  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'sessionId et userId sont requis' })
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Paiement non complété' })
    }
    const subscription = session.subscription as Stripe.Subscription
    if (!subscription) {
      return res.status(400).json({ error: 'Aucune subscription liée à cette session' })
    }
    const customerId     = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscriptionId = subscription.id
    const currentPeriodEnd = subscription.current_period_end * 1000

    await setUser(userId, {
      plan: 'pro',
      subscriptionStatus:  subscription.status,
      subscriptionId,
      stripeCustomerId:    customerId,
      currentPeriodEnd:    subscription.current_period_end,
      cancelAtPeriodEnd:   subscription.cancel_at_period_end,
      updatedAt:           new Date().toISOString(),
    })

    return res.json({ plan: 'pro', customerId, subscriptionId, currentPeriodEnd })
  } catch (err: any) {
    console.error('verify-session error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /stripe/customer-portal
// ─────────────────────────────────────────────────────────────────────────────
router.post('/customer-portal', async (req: Request, res: Response) => {
  const { userId, customerId: bodyCustomerId } = req.body
  try {
    let customerId: string | undefined = bodyCustomerId
    if (!customerId && userId) {
      const userData = await getUser(userId)
      customerId = userData?.stripeCustomerId
    }
    if (!customerId) {
      return res.status(404).json({ error: 'Aucun customer Stripe trouvé' })
    }
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: process.env.EXTENSION_SUCCESS_URL!,
    })
    return res.json({ url: portalSession.url })
  } catch (err: any) {
    console.error('customer-portal error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /stripe/subscription/:userId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscription/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params
  try {
    const data = await getUser(userId)
    if (!data) return res.json({ plan: 'free', status: 'inactive' })
    return res.json({
      plan:              data.plan               ?? 'free',
      status:            data.subscriptionStatus ?? 'inactive',
      stripeCustomerId:  data.stripeCustomerId   ?? null,
      subscriptionId:    data.subscriptionId     ?? null,
      currentPeriodEnd:  data.currentPeriodEnd   ? data.currentPeriodEnd * 1000 : null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd  ?? false,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /stripe/webhook
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', rateLimit(), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET)
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log(`📨 Webhook reçu : ${event.type}`)

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const uid = sub.metadata?.firebaseUserId
        if (uid) {
          await setUser(uid, {
            plan: 'pro',
            subscriptionStatus:  sub.status,
            subscriptionId:      sub.id,
            currentPeriodEnd:    sub.current_period_end,
            cancelAtPeriodEnd:   sub.cancel_at_period_end,
            updatedAt:           new Date().toISOString(),
          })
          console.log(`✅ ${uid} → pro (${sub.status})`)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const uid = sub.metadata?.firebaseUserId
        if (uid) {
          await setUser(uid, {
            plan: 'free', subscriptionStatus: 'canceled',
            subscriptionId: null, currentPeriodEnd: null,
            cancelAtPeriodEnd: false, updatedAt: new Date().toISOString(),
          })
          console.log(`🔴 ${uid} → free`)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          const uid = sub.metadata?.firebaseUserId
          if (uid) await setUser(uid, { subscriptionStatus: 'past_due' })
        }
        break
      }
    }
  } catch (err: any) {
    console.error(`Erreur webhook ${event.type}:`, err.message)
    return res.status(500).json({ error: err.message })
  }

  return res.json({ received: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /sync/push
// L'extension envoie les pages et collections au backend
// Le backend les sauvegarde dans Firestore via Firebase Admin SDK
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sync/push', rateLimit(), async (req: Request, res: Response) => {
  try {
    const { userId, pages, collections } = req.body

    if (!userId || !Array.isArray(pages)) {
      return res.status(400).json({ error: 'userId et pages requis' })
    }

    if (!firebaseReady || !db) {
      console.log('[sync] Firebase non configuré, données non sauvegardées')
      return res.status(503).json({ error: 'Firebase non disponible' })
    }

    console.log(`[sync] Réception de ${pages.length} pages à synchroniser...`)

    // Sauvegarde les pages
    for (const page of pages) {
      try {
        await db.collection('users').doc(userId).collection('pages').doc(page.id).set(page, { merge: true })
      } catch (e) {
        console.error(`[sync] Erreur sauvegarde page ${page.id}:`, e)
      }
    }

    // Sauvegarde les collections
    if (Array.isArray(collections)) {
      for (const col of collections) {
        try {
          await db.collection('users').doc(userId).collection('collections').doc(col.id).set(col, { merge: true })
        } catch (e) {
          console.error(`[sync] Erreur sauvegarde collection ${col.id}:`, e)
        }
      }
    }

    console.log(`[sync] ✅ ${pages.length} pages synchronisées`)
    return res.json({ success: true, synced: pages.length })
  } catch (err: any) {
    console.error('[sync] Erreur:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /sync/pull
// L'extension demande les données depuis le cloud
// Le backend récupère depuis Firestore via Firebase Admin SDK
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sync/pull', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' })
    }

    if (!firebaseReady || !db) {
      console.log('[sync] Firebase non configuré')
      return res.status(503).json({ error: 'Firebase non disponible' })
    }

    console.log('[sync] Récupération des données cloud pour:', userId)

    // Récupère les pages
    const pagesSnap = await db.collection('users').doc(userId).collection('pages').get()
    const pages = pagesSnap.docs.map(doc => doc.data())

    // Récupère les collections
    const collectionsSnap = await db.collection('users').doc(userId).collection('collections').get()
    const collections = collectionsSnap.docs.map(doc => doc.data())

    console.log(`[sync] ✅ ${pages.length} pages et ${collections.length} collections récupérées`)
    return res.json({ pages, collections })
  } catch (err: any) {
    console.error('[sync] Erreur pull:', err)
    return res.status(500).json({ error: err.message })
  }
})

export { router as stripeRouter }
