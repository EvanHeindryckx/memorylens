import admin from 'firebase-admin'

export let db: admin.firestore.Firestore | null = null
export let firebaseReady = false

try {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    const projectId = process.env.FIREBASE_PROJECT_ID

    if (raw && raw !== 'REMPLACE_MOI' && projectId && projectId !== 'REMPLACE_MOI') {
      const serviceAccount = JSON.parse(raw)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      })
      db = admin.firestore()
      firebaseReady = true
      console.log('✅ Firebase Admin initialisé')
    } else {
      console.warn('⚠️  Firebase non configuré — Firestore désactivé (mode sans DB)')
    }
  }
} catch (e) {
  console.error('❌ Firebase init error:', e)
}

export default admin
