import { build } from 'esbuild'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const shared = {
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  minify: false,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@': resolve(__dirname, 'src') },
}

await build({
  ...shared,
  entryPoints: ['src/background/service-worker.ts'],
  outfile: 'dist/background/service-worker.js',
})

await build({
  ...shared,
  entryPoints: ['src/content/content-script.ts'],
  outfile: 'dist/content/content-script.js',
})

console.log('✅ Service Worker + Content Script compilés')
