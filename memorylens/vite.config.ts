import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import type { Plugin } from 'vite'

// Plugin qui renomme les HTML de "src/popup/index.html" → "popup/index.html"
function chromeExtensionHtmlPlugin(): Plugin {
  return {
    name: 'chrome-extension-html',
    generateBundle(_, bundle) {
      for (const key of Object.keys(bundle)) {
        if (key.startsWith('src/')) {
          const newKey = key.replace(/^src\//, '')
          bundle[newKey] = bundle[key]
          bundle[newKey].fileName = newKey
          delete bundle[key]
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), chromeExtensionHtmlPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        offscreen: resolve(__dirname, 'src/offscreen/index.html'),
      },
      output: {
        entryFileNames: (chunk) => {
          const map: Record<string, string> = {
            popup: 'popup/index.js',
            options: 'options/index.js',
            offscreen: 'offscreen/index.js',
          }
          return map[chunk.name] ?? '[name]/index.js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/core/**', 'src/store/**'],
    },
  },
})
