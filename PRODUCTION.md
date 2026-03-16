# 🚀 MemoryLens — Guide Production

## ✅ Checklist Production Complétée

### 🔴 CRITIQUES (FAIT)
- ✅ STRIPE_WEBHOOK_SECRET configuré
- ✅ Variables d'environnement centralisées (config.ts)
- ✅ Backend URL configurable (VITE_BACKEND_URL)
- ✅ Firestore Security Rules mises en place
- ✅ CORS restreint aux domaines autorisés

### 🟡 IMPORTANT (FAIT)
- ✅ Rate limiting ajouté (/sync/push, /stripe/webhook)
- ✅ Logs & monitoring en place
- ✅ Erreurs correctement gérées

### 🟢 OPTIONNEL
- ⏳ Tests automatisés (E2E)
- ⏳ Export JSON/CSV
- ⏳ Sentry/monitoring avancé
- ⏳ CDN pour assets statiques

---

## 📝 Variables d'Environnement

### Backend (.env)

```bash
# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_d8ab0087c80c099062e571911962806bb255095fd0338e29e7b54545e441df64
STRIPE_PRICE_PRO_MONTHLY=price_1T85rWDFQRT5l6f7LVFeib0Y
STRIPE_PRICE_PRO_YEARLY=price_1T8BKtDFQRT5l6f7XPwTxFn4

# ── Firebase Admin ────────────────────────────────────────────────────────────
FIREBASE_PROJECT_ID=memorylens-d33e4
FIREBASE_SERVICE_ACCOUNT_JSON={...}

# ── Google OAuth ──────────────────────────────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
BACKEND_URL=https://api.memorylens.com
VITE_BACKEND_URL=https://api.memorylens.com

# ── Firebase Client ────────────────────────────────────────────────────────────
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=memorylens-d33e4
VITE_FIREBASE_AUTH_DOMAIN=memorylens-d33e4.firebaseapp.com

# ── URLs ──────────────────────────────────────────────────────────────────────
EXTENSION_SUCCESS_URL=https://api.memorylens.com/stripe/success
EXTENSION_CANCEL_URL=https://api.memorylens.com/stripe/cancel
EXTENSION_ID=VOTRE_EXTENSION_ID_PROD

# ── Serveur ───────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production
```

### Extension (.env.local)

```bash
VITE_BACKEND_URL=https://api.memorylens.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=memorylens-d33e4
VITE_FIREBASE_AUTH_DOMAIN=memorylens-d33e4.firebaseapp.com
```

---

## 🔐 Firestore Security Rules

À mettre à jour dans Firebase Console :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      
      match /pages/{pageId} {
        allow read, write: if request.auth.uid == userId;
      }
      
      match /collections/{collectionId} {
        allow read, write: if request.auth.uid == userId;
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🚀 Déploiement

### Backend (Vercel, Railway, Heroku, etc.)

```bash
# 1. Pousser le code sur Git
git push origin main

# 2. Connecter le repo à Vercel/Railway/Heroku
# 3. Ajouter les variables d'env dans le dashboard
# 4. Déployer automatiquement

# Vérifier que c'est actif
curl https://api.memorylens.com/health
# → {"status":"ok","version":"1.0.0","timestamp":"..."}
```

### Extension Chrome

```bash
# 1. Compiler avec l'URL de prod
VITE_BACKEND_URL=https://api.memorylens.com npm run build

# 2. Zipper le dossier dist/
zip -r memorylens.zip dist/

# 3. Aller sur Chrome Web Store Developer Dashboard
# 4. Uploader le ZIP

# 5. Mettre à jour l'ID extension en production
# EXTENSION_ID=abcdefghijklmnopqrstuvwxyz123456
```

---

## 📊 Architecture Production

```
Client (Chrome Extension)
    ↓ (HTTPS)
CDN (CloudFlare)
    ↓
Backend API (Vercel/Railway)
    ↓ (Firebase Admin SDK)
Firestore (Google Cloud)
    ↓
Users Data (Encrypted)
```

---

## 🔒 Sécurité

✅ **Data Protection**
- Firestore Rules : Chaque utilisateur voit uniquement ses données
- HTTPS en transit
- Données chiffrées au repos dans Firestore

✅ **API Security**
- Rate limiting : 30 requêtes/minute par IP
- CORS whitelist : Seulement les domaines autorisés
- Webhook signature : Stripe signe chaque webhook

✅ **Secrets Management**
- Variables d'env dans le dashboard (pas en Git)
- Clés privées Firebase Admin jamais exposées
- Tokens JWT expirés après 1h

---

## 📈 Monitoring

### Logs
```bash
# Backend logs
vercel logs [project-name]

# Erreurs en temps réel
# Ajouter Sentry pour production:
npm install @sentry/node
```

### Métriques à surveiller
- Nombre de requêtes `/sync/push`
- Erreurs Firestore (403, 404, 500)
- Temps de réponse des webhooks Stripe
- Taux de conversion Pro

---

## 🚨 Troubleshooting Production

| Problème | Solution |
|----------|----------|
| 403 Firestore | Vérifier Firestore Rules & tokens |
| 401 Webhook | Vérifier STRIPE_WEBHOOK_SECRET |
| CORS error | Ajouter domaine à allowedOrigins |
| Lenteur sync | Augmenter BATCH_SIZE dans config.ts |
| 429 Rate limit | Augmenter maxRequests dans rateLimit() |

---

## ✅ Checklist Final

- [ ] Variables d'env configurées en prod
- [ ] Firestore Rules publiées
- [ ] Backend déployé & testable
- [ ] Extension compilée avec URL de prod
- [ ] Extension publiée sur Chrome Web Store
- [ ] Tests de paiement Stripe en prod
- [ ] Tests de sync Cloud en prod
- [ ] Monitoring mis en place
- [ ] Documentation mise à jour
- [ ] Backups Firestore configurés

---

**Prêt pour le lancement ! 🚀**
