// ── Mock global chrome API ────────────────────────────────────────────────────
const chromeMock = {
  storage: {
    sync: {
      get: vi.fn((_keys: string | string[], cb: (r: Record<string, unknown>) => void) => cb({})),
      set: vi.fn((_data: object, cb?: () => void) => cb?.()),
    },
    session: {
      get: vi.fn((_keys: string | string[], cb: (r: Record<string, unknown>) => void) => cb({})),
      set: vi.fn((_data: object, cb?: () => void) => cb?.()),
      remove: vi.fn((_keys: string | string[], cb?: () => void) => cb?.()),
    },
    local: {
      get: vi.fn((_keys: string | string[], cb: (r: Record<string, unknown>) => void) => cb({})),
      set: vi.fn((_data: object, cb?: () => void) => cb?.()),
    },
  },
  runtime: {
    lastError: undefined as chrome.runtime.LastError | undefined,
    getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    id: 'fake-extension-id',
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
    onButtonClicked: { addListener: vi.fn() },
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },
  scripting: {
    executeScript: vi.fn(),
  },
  commands: {
    onCommand: { addListener: vi.fn() },
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
  },
  offscreen: {
    hasDocument: vi.fn(async () => false),
    createDocument: vi.fn(async () => {}),
    Reason: { DOM_SCRAPING: 'DOM_SCRAPING' },
  },
}

// @ts-expect-error mock global
globalThis.chrome = chromeMock

// Réinitialise tous les mocks avant chaque test
beforeEach(() => {
  vi.clearAllMocks()
})
