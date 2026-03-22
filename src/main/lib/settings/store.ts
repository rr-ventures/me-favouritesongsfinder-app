// electron-store wrapper — runs in main process ONLY.
// All access from renderer must go through IPC (settings channel).

export interface ApiKeys {
  lastfm_key: string
  lastfm_secret: string
  musicbrainz_email: string
  listenbrainz_token: string
  discogs_token: string
  youtube_key: string
  spotify_client_id: string
  spotify_client_secret: string
  anthropic_key: string
  gemini_key: string
}

export interface Preferences {
  autoPlayNext: boolean
  historyMinSeconds: number
  maxCostPerRunUsd: number
  lastTrackId: number | null
}

export interface StoreSchema {
  apiKeys: Partial<ApiKeys>
  preferences: Partial<Preferences>
}

const DEFAULT_PREFS: Preferences = {
  autoPlayNext: true,
  historyMinSeconds: 0,
  maxCostPerRunUsd: 10,
  lastTrackId: null,
}

// Lazy singleton — electron-store is ESM only, use dynamic import
let storeInstance: Awaited<ReturnType<typeof createStore>> | null = null

async function createStore() {
  const { default: Store } = await import('electron-store')
  return new Store<StoreSchema>({
    name: 'mixingsongfinder-settings',
    defaults: {
      apiKeys: {},
      preferences: DEFAULT_PREFS,
    },
  })
}

async function getStore() {
  if (!storeInstance) {
    storeInstance = await createStore()
  }
  return storeInstance
}

export async function getApiKey(keyName: keyof ApiKeys): Promise<string> {
  const store = await getStore()
  const keys = (store as unknown as { get(k: string, d: unknown): unknown }).get('apiKeys', {}) as Record<string, string>
  return keys[keyName] ?? ''
}

export async function setApiKey(keyName: keyof ApiKeys, value: string): Promise<void> {
  const store = await getStore()
  const keys = (store as unknown as { get(k: string, d: unknown): unknown }).get('apiKeys', {}) as Record<string, string>
  keys[keyName] = value;
  (store as unknown as { set(k: string, v: unknown): void }).set('apiKeys', keys)
}

export async function getAllApiKeys(): Promise<Partial<ApiKeys>> {
  const store = await getStore()
  return (store as unknown as { get(k: string, d: unknown): unknown }).get('apiKeys', {}) as Partial<ApiKeys>
}

export async function getPreference<K extends keyof Preferences>(key: K): Promise<Preferences[K]> {
  const store = await getStore()
  const prefs = (store as unknown as { get(k: string, d: unknown): unknown }).get('preferences', DEFAULT_PREFS) as Preferences
  return (prefs[key] ?? DEFAULT_PREFS[key]) as Preferences[K]
}

export async function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void> {
  const store = await getStore()
  const prefs = (store as unknown as { get(k: string, d: unknown): unknown }).get('preferences', DEFAULT_PREFS) as Preferences
  prefs[key] = value;
  (store as unknown as { set(k: string, v: unknown): void }).set('preferences', prefs)
}

export async function getAllPreferences(): Promise<Preferences> {
  const store = await getStore()
  const prefs = (store as unknown as { get(k: string, d: unknown): unknown }).get('preferences', DEFAULT_PREFS) as Preferences
  return { ...DEFAULT_PREFS, ...prefs }
}

export async function isMockMode(keyName: keyof ApiKeys): Promise<boolean> {
  const value = await getApiKey(keyName)
  return !value || value.trim() === '' || value.trim().toUpperCase() === 'PLACEHOLDER'
}

export async function getMockStatus(): Promise<{ anyMockActive: boolean; mockKeys: string[] }> {
  const keys = await getAllApiKeys()
  const mockKeys: string[] = []
  const allKeyNames: (keyof ApiKeys)[] = [
    'lastfm_key', 'musicbrainz_email', 'discogs_token', 'youtube_key',
    'spotify_client_id', 'anthropic_key', 'gemini_key', 'listenbrainz_token',
  ]
  for (const k of allKeyNames) {
    const v = keys[k] ?? ''
    if (!v || v.trim() === '' || v.trim().toUpperCase() === 'PLACEHOLDER') {
      mockKeys.push(k)
    }
  }
  return { anyMockActive: mockKeys.length > 0, mockKeys }
}
