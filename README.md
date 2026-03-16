# 🧠 MemoryLens — Setup Local

## 📋 Prérequis

- Node.js 18+
- npm ou yarn
- Un compte Stripe (test)
- Un projet Firebase
- Une extension Chrome en dev mode

## 🚀 Installation

### 1. Cloner le repo

```bash
git clone https://github.com/evanheindryckx/memorylens.git
cd memorylens
```

### 2. Backend Setup

```bash
cd memorylens-backend

# Copier le .env.example
cp .env.example .env

# Ajouter tes clés Stripe, Firebase, Google OAuth dans .env
# (Voir .env.example pour les variables requises)

# Installer les dépendances
npm install

# Démarrer le backend (mode dev)
npm start
```

Le backend tourne maintenant sur `http://localhost:3001`

### 3. Extension Setup

```bash
cd ../memorylens

# Installer les dépendances
npm install

# Compiler l'extension (mode dev)
npm run build

# Le dossier dist/ contient l'extension compilée
```

### 4. Charger l'extension dans Chrome

1. Va sur `chrome://extensions/`
2. Active **"Mode développeur"** (en haut à droite)
3. Clique **"Charger l'extension non empaquetée"**
4. Sélectionne le dossier `memorylens/dist/`

✅ L'extension est maintenant active !

## 🔧 Commandes utiles

```bash
# Backend
cd memorylens-backend
npm run build   # Compiler TypeScript
npm start       # Démarrer le serveur (avec Stripe CLI)
npm run dev     # Mode watch (recompile automatiquement)

# Extension
cd memorylens
npm run build   # Compiler pour production
npm run dev     # Mode watch (recompile automatiquement)

# Linting
npm run lint    # Vérifier les erreurs ESLint

# Tests
npm test        # Lancer les tests
```

## 🔐 Variables d'environnement requises

### Backend (`.env`)

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={...}
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

### Extension (`.env.local` - optionnel en dev)

```bash
VITE_BACKEND_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
```

## 📦 Structure du projet

```
memorylens/
├── src/
│   ├── background/service-worker.ts      # Service Worker (background)
│   ├── popup/                            # Popup UI
│   ├── options/                          # Page options
│   ├── offscreen/                        # Offscreen document (Gemini)
│   ├── core/                             # Logique métier
│   ├── store/                            # Zustand stores
│   └── config.ts                         # Configuration centralisée
├── public/                               # Assets publics
└── dist/                                 # Build output (compiled)

memorylens-backend/
├── src/
│   ├── routes/
│   │   ├── stripe.ts                     # Stripe payments + Sync
│   │   └── auth.ts                       # Google OAuth + Tokens
│   ├── lib/firebase-admin.ts             # Firebase Admin SDK
│   └── index.ts                          # Express server
└── public/                               # Static files (login.html, etc.)
```

## 🐛 Troubleshooting

### "Cannot find module 'x'"
```bash
npm install  # Réinstaller les dépendances
```

### Extension ne charge pas
```bash
# Vérifier que dist/ existe
ls memorylens/dist/

# Recompiler
npm run build

# Rafraîchir chrome://extensions/
```

### Backend error "listen EADDRINUSE"
```bash
# Port 3001 déjà utilisé
# Tuer le processus
lsof -i :3001
kill -9 <PID>

# Ou changer le port
PORT=3002 npm start
```

### Stripe webhook ne fonctionne pas
```bash
# Lancer Stripe CLI
stripe listen --forward-to localhost:3001/stripe/webhook

# Copier le secret whsec_... dans .env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 📚 Documentation

- **[PRODUCTION.md](./PRODUCTION.md)** - Guide déploiement production
- **[Firestore Rules](./memorylens/firestore.rules)** - Security rules
- **[Config](./memorylens/src/config.ts)** - Configuration centralisée

## 🚀 Prêt à développer !

L'extension devrait maintenant :
- ✅ Capturer les pages web
- ✅ Synchroniser vers Firestore (Pro)
- ✅ Accepter les paiements Stripe
- ✅ Chercher avec vecteurs

Happy coding! 🎉
