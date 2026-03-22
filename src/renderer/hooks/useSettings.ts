import { useState, useEffect, useCallback } from 'react'

export interface ApiKeys {
  lastfm_key?: string
  lastfm_secret?: string
  musicbrainz_email?: string
  listenbrainz_token?: string
  discogs_token?: string
  youtube_key?: string
  spotify_client_id?: string
  spotify_client_secret?: string
  anthropic_key?: string
  gemini_key?: string
}

export interface Preferences {
  autoPlayNext: boolean
  historyMinSeconds: number
  maxCostPerRunUsd: number
  lastTrackId: number | null
}

export interface MockStatus {
  anyMockActive: boolean
  mockKeys: string[]
}

export function useSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({})
  const [preferences, setPreferences] = useState<Preferences>({
    autoPlayNext: true,
    historyMinSeconds: 0,
    maxCostPerRunUsd: 10,
    lastTrackId: null,
  })
  const [mockStatus, setMockStatus] = useState<MockStatus>({ anyMockActive: false, mockKeys: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [keys, prefs, mock] = await Promise.all([
        window.electron.ipc.invoke('settings:getApiKeys') as Promise<ApiKeys>,
        window.electron.ipc.invoke('settings:getPreferences') as Promise<Preferences>,
        window.electron.ipc.invoke('settings:getMockStatus') as Promise<MockStatus>,
      ])
      setApiKeys(keys)
      setPreferences(prefs)
      setMockStatus(mock)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveApiKey = useCallback(async (keyName: string, value: string) => {
    await window.electron.ipc.invoke('settings:setApiKey', keyName, value)
    await refresh()
  }, [refresh])

  const testApiKey = useCallback(async (keyName: string): Promise<{ ok: boolean; message: string }> => {
    return window.electron.ipc.invoke('settings:testApiKey', keyName) as Promise<{ ok: boolean; message: string }>
  }, [])

  const testApiKeyValue = useCallback(async (keyName: string, value: string): Promise<{ ok: boolean; message: string }> => {
    return window.electron.ipc.invoke('settings:testApiKeyValue', keyName, value) as Promise<{ ok: boolean; message: string }>
  }, [])

  const savePreference = useCallback(async (key: keyof Preferences, value: unknown) => {
    await window.electron.ipc.invoke('settings:setPreference', key, value)
    await refresh()
  }, [refresh])

  return { apiKeys, preferences, mockStatus, loading, error, saveApiKey, testApiKey, testApiKeyValue, savePreference, refresh }
}
