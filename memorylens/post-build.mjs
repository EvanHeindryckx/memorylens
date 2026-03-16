import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Charger les variables d'environnement depuis .env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim()
      if (value) process.env[key.trim()] = value
    }
  }
}

const dist = './dist'

// 1. Déplacer dist/src/* → dist/*
const srcDir = path.join(dist, 'src')
if (fs.existsSync(srcDir)) {
  for (const folder of fs.readdirSync(srcDir)) {
    const from = path.join(srcDir, folder)
    const to   = path.join(dist, folder)
    // Copie récursive
    cpSync(from, to)
  }
  fs.rmSync(srcDir, { recursive: true, force: true })
  console.log('✅ HTML déplacés : dist/src/* → dist/*')
}

// 2. Copier le manifest
fs.copyFileSync('public/manifest.json', path.join(dist, 'manifest.json'))
console.log('✅ manifest.json copié')

// 3. Copier les icônes
const iconsDir = path.join(dist, 'icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })
const publicIcons = 'public/icons'
if (fs.existsSync(publicIcons)) {
  for (const file of fs.readdirSync(publicIcons)) {
    fs.copyFileSync(path.join(publicIcons, file), path.join(iconsDir, file))
  }
  console.log('✅ Icônes copiées')
} else {
  console.log('⚠️  Dossier public/icons absent — les icônes devront être ajoutées manuellement')
}

// 4. Injecter la config dans le service worker
const swFile = path.join(dist, 'background', 'service-worker.js')
if (fs.existsSync(swFile)) {
  let swContent = fs.readFileSync(swFile, 'utf8')
  
  // Créer l'objet config à injecter
  const config = {
    BACKEND_URL: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
    FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || '',
    FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'memorylens-d33e4',
    FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'memorylens-d33e4.firebaseapp.com',
    FIREBASE_DATABASE_URL: process.env.VITE_FIREBASE_DATABASE_URL || 'https://memorylens-d33e4.firebaseio.com',
    FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'memorylens-d33e4.appspot.com',
    FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || '',
  }
  
  // Crée un fichier config.js séparé au lieu d'injecter dans le service worker
  const configFile = path.join(dist, 'background', 'config.js')
  const configContent = `export const MEMORYLENS_CONFIG = ${JSON.stringify(config)};`
  fs.writeFileSync(configFile, configContent, 'utf8')
  
  // Injecte l'import au début du service worker (après les autres imports)
  // On le met après la première ligne pour ne pas casser les imports ES6
  const lines = swContent.split('\n')
  const importIndex = lines.findIndex(line => line.startsWith('import '))
  if (importIndex >= 0) {
    // Insère après le dernier import
    let lastImportIndex = importIndex
    for (let i = importIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        lastImportIndex = i
      } else if (lines[i].trim() === '' || lines[i].startsWith('//')) {
        continue
      } else {
        break
      }
    }
    lines.splice(lastImportIndex + 1, 0, 'import { MEMORYLENS_CONFIG } from \'./config.js\';')
    lines.splice(lastImportIndex + 2, 0, '(globalThis).__MEMORYLENS_CONFIG = MEMORYLENS_CONFIG;')
    swContent = lines.join('\n')
  } else {
    // Fallback: injecter au début
    const configScript = `import { MEMORYLENS_CONFIG } from './config.js';\n(globalThis).__MEMORYLENS_CONFIG = MEMORYLENS_CONFIG;\n`
    swContent = configScript + swContent
  }
  
  fs.writeFileSync(swFile, swContent, 'utf8')
  console.log('✅ Configuration injectée dans service-worker.js et config.js créé')
} else {
  console.warn('⚠️  service-worker.js absent à:', swFile)
}

// 5. Copier et injecter les variables d'environnement dans stripe-checkout.html
const stripeCheckoutSrc = 'public/stripe-checkout.html'
const stripeCheckoutDest = path.join(dist, 'stripe-checkout.html')
if (fs.existsSync(stripeCheckoutSrc)) {
  let content = fs.readFileSync(stripeCheckoutSrc, 'utf8')
  
  // Injecter la clé publique Stripe depuis process.env.VITE_STRIPE_PUBLISHABLE_KEY
  const stripeKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
  if (!stripeKey) {
    console.warn('⚠️  VITE_STRIPE_PUBLISHABLE_KEY manquant — Stripe ne fonctionnera pas')
  } else {
    console.log('✅ Clé Stripe trouvée:', stripeKey.substring(0, 20) + '...')
  }
  content = content.replace('{STRIPE_PUBLIC_KEY}', stripeKey)
  
  fs.writeFileSync(stripeCheckoutDest, content, 'utf8')
  console.log('✅ stripe-checkout.html injecté avec la clé Stripe')
} else {
  console.log('⚠️  public/stripe-checkout.html absent')
}

// 6. Copier les autres fichiers HTML du dossier public
const htmlFiles = ['login.html', 'stripe-success.html', 'privacy_policy.html']
for (const file of htmlFiles) {
  const src = path.join('public', file)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dist, file))
  }
}
console.log('✅ Fichiers HTML copiés')

// ── helper: copie récursive ──────────────────────────────────────────────────
function cpSync(src, dest) {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    for (const child of fs.readdirSync(src)) {
      cpSync(path.join(src, child), path.join(dest, child))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}
