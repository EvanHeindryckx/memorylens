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

// 4. Copier et injecter les variables d'environnement dans stripe-checkout.html
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

// 5. Copier les autres fichiers HTML du dossier public
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
