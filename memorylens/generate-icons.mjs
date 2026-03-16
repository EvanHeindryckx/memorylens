import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

// ── PNG encoder pur Node.js (sans dépendance) ────────────────────────────────

function crc32(buf) {
  const table = makeCrcTable()
  let crc = 0xFFFFFFFF
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF]
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeCrcTable() {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.concat([typeBytes, data])
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, typeBytes, data, crcVal])
}

function makePNG(size, drawFn) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Pixels RGBA
  const pixels = new Uint8Array(size * size * 4)
  pixels.fill(0)
  drawFn(pixels, size)

  // Raw image data avec filtre 0 par ligne
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0 // filter none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (1 + size * 4) + 1 + x * 4
      raw[dst]     = pixels[src]
      raw[dst + 1] = pixels[src + 1]
      raw[dst + 2] = pixels[src + 2]
      raw[dst + 3] = pixels[src + 3]
    }
  }

  const compressed = zlib.deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Dessin de l'icône MemoryLens (Cerveau + Loupe) ─────────────────────────

function drawIcon(pixels, size) {
  const cx = size / 2
  const cy = size / 2

  // Couleurs (RGBA)
  const colors = {
    bg: [15, 15, 17, 255],        // #0f0f11 - fond noir
    purple: [188, 68, 237, 255],  // #bc44ed - violet principal
    purple_light: [220, 124, 255, 255], // #dc7cff - violet clair
    white: [255, 255, 255, 255],  // blanc
    gray: [100, 100, 120, 255],   // gris
  }

  // Fond
  for (let i = 0; i < size * size * 4; i += 4) {
    pixels[i] = colors.bg[0]
    pixels[i + 1] = colors.bg[1]
    pixels[i + 2] = colors.bg[2]
    pixels[i + 3] = colors.bg[3]
  }

  function setPixel(x, y, color) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const idx = (y * size + x) * 4
      pixels[idx] = color[0]
      pixels[idx + 1] = color[1]
      pixels[idx + 2] = color[2]
      pixels[idx + 3] = color[3]
    }
  }

  function drawCircle(cx, cy, r, color, filled = true) {
    const steps = Math.max(8, Math.round(2 * Math.PI * r))
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      setPixel(x, y, color)
    }
    
    if (filled) {
      for (let y = Math.ceil(cy - r); y <= Math.floor(cy + r); y++) {
        for (let x = Math.ceil(cx - r); x <= Math.floor(cx + r); x++) {
          const dx = x - cx
          const dy = y - cy
          if (dx * dx + dy * dy <= r * r) {
            setPixel(x, y, color)
          }
        }
      }
    }
  }

  // ── Cerveau (violet) ──────────────────────────────────────────────────────
  const brain_r = size * 0.32
  const brain_x = cx - size * 0.12
  const brain_y = cy - size * 0.15

  // Hémisphère gauche et droit
  drawCircle(brain_x - size * 0.08, brain_y - size * 0.05, brain_r * 0.95, colors.purple, true)
  drawCircle(brain_x + size * 0.08, brain_y - size * 0.05, brain_r * 0.95, colors.purple, true)

  // Lobes frontaux
  drawCircle(brain_x - size * 0.08, brain_y - size * 0.25, brain_r * 0.5, colors.purple_light, true)
  drawCircle(brain_x + size * 0.08, brain_y - size * 0.25, brain_r * 0.5, colors.purple_light, true)

  // ── Loupe (contour blanc) ───────────────────────────────────────────────
  const magnifier_r = size * 0.22
  const magnifier_x = cx + size * 0.18
  const magnifier_y = cy + size * 0.15

  // Cercle de la loupe (contour blanc)
  for (let y = Math.ceil(magnifier_y - magnifier_r); y <= Math.floor(magnifier_y + magnifier_r); y++) {
    for (let x = Math.ceil(magnifier_x - magnifier_r); x <= Math.floor(magnifier_x + magnifier_r); x++) {
      const dx = x - magnifier_x
      const dy = y - magnifier_y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      // Contour blanc (épaisseur ~3px)
      if (dist > magnifier_r - 3 && dist < magnifier_r) {
        setPixel(x, y, colors.white)
      }
    }
  }

  // Manche de la loupe (blanc)
  const handle_angle = Math.PI * 0.75
  const handle_start_x = magnifier_x + magnifier_r * Math.cos(handle_angle)
  const handle_start_y = magnifier_y + magnifier_r * Math.sin(handle_angle)
  const handle_end_x = magnifier_x + magnifier_r * 1.4 * Math.cos(handle_angle)
  const handle_end_y = magnifier_y + magnifier_r * 1.4 * Math.sin(handle_angle)

  const handle_steps = Math.ceil(magnifier_r)
  for (let i = 0; i <= handle_steps; i++) {
    const t = i / handle_steps
    const x = handle_start_x + (handle_end_x - handle_start_x) * t
    const y = handle_start_y + (handle_end_y - handle_start_y) * t
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setPixel(x + dx, y + dy, colors.white)
      }
    }
  }
}

// ── Génération des 4 tailles ──────────────────────────────────────────────────

const outDir = path.resolve('public/icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [16, 32, 48, 128]) {
  const png = makePNG(size, drawIcon)
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png)
  console.log(`✅ icon${size}.png généré`)
}

console.log('✨ Tous les icônes MemoryLens ont été générés avec succès!')
