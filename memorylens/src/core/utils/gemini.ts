// Déclarations de types pour Chrome Built-in AI (window.ai)
// Disponible depuis Chrome 127+
// L'implémentation réelle est dans src/offscreen/offscreen.ts (via messages)

declare global {
  interface Window {
    ai?: {
      summarizer?: {
        create: (options?: { type?: string; format?: string; length?: string }) => Promise<{
          summarize: (text: string) => Promise<string>
          destroy: () => void
        }>
        capabilities: () => Promise<{ available: 'readily' | 'after-download' | 'no' }>
      }
      languageModel?: {
        create: (options?: { systemPrompt?: string }) => Promise<{
          prompt: (text: string) => Promise<string>
          destroy: () => void
        }>
        capabilities: () => Promise<{ available: 'readily' | 'after-download' | 'no' }>
      }
    }
  }
}

export type {}
