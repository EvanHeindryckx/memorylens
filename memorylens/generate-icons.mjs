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
  ihdr[9] = 2   // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Pixels RGB
  const pixels = new Uint8Array(size * size * 3)
  drawFn(pixels, size)

  // Raw image data avec filtre 0 par ligne
  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0 // filter none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3
      const dst = y * (1 + size * 3) + 1 + x * 3
      raw[dst]     = pixels[src]
      raw[dst + 1] = pixels[src + 1]
      raw[dst + 2] = pixels[src + 2]
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

// ── Dessin de l'icône MemoryLens ─────────────────────────────────────────────

function drawIcon(pixels, size) {
  const cx = size / 2
  const cy = size / 2
  const r  = size * 0.42

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 3
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= r) {
        // Cercle violet #7c3aed
        pixels[idx]     = 0x7c
        pixels[idx + 1] = 0x3a
        pixels[idx + 2] = 0xed
      } else {
        // Fond sombre #0f0f11
        pixels[idx]     = 0x0f
        pixels[idx + 1] = 0x0f
        pixels[idx + 2] = 0x11
      }
    }
  }

  // Dessine un "M" simplifié au centre (barres verticales + diagonales)
  const s = size
  const col = { r: 255, g: 255, b: 255 }
  const lw = Math.max(1, Math.round(s * 0.08))  // épaisseur du trait

  function setPixel(px, py) {
    px = Math.round(px); py = Math.round(py)
    for (let dy = -lw; dy <= lw; dy++) {
      for (let dx = -lw; dx <= lw; dx++) {
        const nx = px + dx, ny = py + dy
        if (nx >= 0 && nx < s && ny >= 0 && ny < s) {
          const idx = (ny * s + nx) * 3
          pixels[idx]     = col.r
          pixels[idx + 1] = col.g
          pixels[idx + 2] = col.b
        }
      }
    }
  }

  // Coordonnées du M (proportionnelles à la taille)
  const x1 = s * 0.28, x2 = s * 0.39, x3 = s * 0.50, x4 = s * 0.61, x5 = s * 0.72
  const yTop = s * 0.28, yBot = s * 0.72, yMid = s * 0.50

  const steps = Math.ceil(s * 0.5)
  // Barre gauche verticale
  for (let i = 0; i <= steps; i++) setPixel(x1, yTop + (yBot - yTop) * i / steps)
  // Diagonale gauche vers milieu
  for (let i = 0; i <= steps; i++) setPixel(x1 + (x3 - x1) * i / steps, yTop + (yMid - yTop) * i / steps)
  // Diagonale droite vers milieu
  for (let i = 0; i <= steps; i++) setPixel(x3 + (x5 - x3) * i / steps, yMid + (yTop - yMid) * i / steps)
  // Barre droite verticale
  for (let i = 0; i <= steps; i++) setPixel(x5, yTop + (yBot - yTop) * i / steps)
}

// ── Génération des 4 tailles ──────────────────────────────────────────────────

const outDir = path.resolve('public/icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [16, 32, 48, 128]) {
  const png = makePNG(size, drawIcon)
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png)
  console.log(`✅ icon${size}.png généré`)
}
