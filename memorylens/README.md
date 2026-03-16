# 🧠 MemoryLens — AI Browser Memory

> Retrouve n'importe quelle page que tu as visitée, en langage naturel.

![version](https://img.shields.io/badge/version-1.7.0-brand) ![manifest](https://img.shields.io/badge/manifest-v3-green) ![tests](https://img.shields.io/badge/tests-65%2F65-brightgreen)

---

## ✨ Fonctionnalités

| Feature | Description |
|---------|-------------|
| 🔍 **Recherche sémantique** | TF-IDF + bigrams vectoriels (2048D) avec fallback keyword |
| 🧠 **Gemini Nano** | Résumés et tags auto via Chrome Built-in AI (Chrome 127+) |
| 📅 **Calendrier** | Navigation par date dans l'historique |
| 📁 **Collections** | Organisation manuelle des pages |
| 🔁 **Souvenirs** | Re-surface intelligente (7j, 14j, 30j, 60j, 90j) |
| 📊 **Analytics** | Stats de navigation, streak, heure de pointe |
| ☁️ **Cloud Sync** | Sync Firebase Firestore (plan Pro) |
| 💳 **Freemium** | Plan Free (500 pages) / Pro (illimité) via Stripe |
| 🔒 **100% local** | Toutes les données restent sur l'appareil |

---

## 🏗️ Stack technique

- **React 18 + TypeScript + Vite**
- **Tailwind CSS**
- **IndexedDB** via `idb`
- **Firebase Firestore** (REST API, sans SDK)
- **Gemini Nano** (`window.ai` via offscreen document)
- **Stripe** (checkout via backend)
- **Vitest** (65 tests)

---

## 🚀 Développement

```bash
# Installer les dépendances
npm install

# Build en mode watch (recharge l'extension automatiquement)
npm run dev

# Build de production
npm run build

# Lancer les tests
npm test

# Tests en mode watch
npm run test:watch
```

### Charger l'extension dans Chrome

1. `npm run build`
2. Ouvrir `chrome://extensions`
3. Activer le **mode développeur**
4. Cliquer **Charger l'extension non empaquetée**
5. Sélectionner le dossier `dist/`

---

## ⚙️ Configuration

Créer un fichier `.env` à la racine :

```env
# Firebase (obligatoire pour le cloud sync)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# OAuth Google (obligatoire pour la connexion)
# → Google Cloud Console > APIs > Credentials > OAuth 2.0 Client ID (type: Chrome Extension)
VITE_GOOGLE_OAUTH_CLIENT_ID=

# Stripe (obligatoire pour le plan Pro)
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_BACKEND_URL=
```

> ⚠️ `VITE_GOOGLE_OAUTH_CLIENT_ID` ≠ `VITE_FIREBASE_APP_ID`  
> Créer un client OAuth séparé dans Google Cloud Console, de type **Chrome Extension**.

---

## 🔑 Activer Gemini Nano (Chrome 127+)

1. Ouvrir `chrome://flags`
2. Chercher **"Prompt API for Gemini Nano"**
3. Activer le flag et redémarrer Chrome
4. Dans les paramètres MemoryLens → onglet **IA** → activer Gemini Nano

---

## 📐 Architecture

```
src/
├── background/      # Service Worker (capture, sync, alarms)
├── content/         # Content Script (extraction Readability)
├── offscreen/       # Embeddings TF-IDF + Gemini Nano
├── popup/           # UI principale (React, 5 onglets)
├── options/         # Page de paramètres (React)
├── core/
│   ├── db/          # IndexedDB (pages, collections)
│   ├── search/      # Recherche vectorielle + keyword
│   ├── analytics/   # Stats de navigation
│   └── resuface/    # Logique de re-surface
├── store/           # Zustand (auth, billing, sync, preferences)
├── hooks/           # React hooks
├── types/           # Types TypeScript partagés
└── tests/           # Vitest (65 tests)
```

---

## 🧪 Tests

```
✓ utils.test.ts        (39 tests) — extractDomain, cleanText, detectCategory…
✓ vector-search.test.ts (9 tests) — searchPages, keywordSearch
✓ stats.test.ts        (17 tests) — getDomainStats, getStreak, getPeakHour…
```

---

## 📋 Plans

| | Free | Pro |
|--|------|-----|
| Pages | 500 | Illimité |
| Collections | 5 | Illimité |
| Cloud Sync | ❌ | ✅ |
| Export | ❌ | ✅ |
| Analytics avancées | ❌ | ✅ |

---

## 🔒 Vie privée

- Toutes les données sont stockées **localement** dans IndexedDB
- L'IA (TF-IDF + Gemini Nano) fonctionne **entièrement en local**
- Le cloud sync (Pro) utilise Firebase Firestore avec authentification Google
- Aucune donnée n'est partagée avec des tiers

---

## 📄 Licence

MIT © 2026 MemoryLens
