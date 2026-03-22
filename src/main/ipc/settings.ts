import { ipcMain } from 'electron'
import * as store from '../lib/settings/store.js'
import type { ApiKeys } from '../lib/settings/store.js'

// Test a key by making one lightweight call per service
async function testApiKey(keyName: string, value: string): Promise<{ ok: boolean; message: string }> {
  if (!value || value.trim() === '') return { ok: false, message: 'No key provided' }
  try {
    switch (keyName) {
      case 'lastfm_key': {
        const res = await fetch(`http://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=${value}&format=json&limit=1`)
        const json = await res.json() as { error?: number; message?: string }
        if (json.error) return { ok: false, message: json.message ?? 'Invalid key' }
        return { ok: true, message: 'Connected' }
      }
      case 'musicbrainz_email': {
        // MusicBrainz just needs a valid email in User-Agent, test with a lightweight lookup
        const res = await fetch('https://musicbrainz.org/ws/2/artist?query=bonobo&limit=1&fmt=json', {
          headers: { 'User-Agent': `MixingSongFinder/1.0.0 (${value})` },
        })
        return res.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${res.status}` }
      }
      case 'discogs_token': {
        const res = await fetch('https://api.discogs.com/oauth/identity', {
          headers: { Authorization: `Discogs token=${value}` },
        })
        return res.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${res.status}` }
      }
      case 'youtube_key': {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&maxResults=1&q=test&key=${value}`)
        const json = await res.json() as { error?: { message?: string } }
        if (json.error) return { ok: false, message: json.error.message ?? 'Invalid key' }
        return { ok: true, message: 'Connected' }
      }
      case 'anthropic_key': {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': value, 'anthropic-version': '2023-06-01' },
        })
        return res.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${res.status}` }
      }
      case 'gemini_key': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${value}`)
        return res.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${res.status}` }
      }
      default:
        return { ok: true, message: 'Not tested' }
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Network error' }
  }
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:getApiKeys', async () => {
    return store.getAllApiKeys()
  })

  ipcMain.handle('settings:setApiKey', async (_event, keyName: string, value: string) => {
    await store.setApiKey(keyName as keyof ApiKeys, value)
    return { success: true }
  })

  ipcMain.handle('settings:testApiKey', async (_event, keyName: string) => {
    const value = await store.getApiKey(keyName as keyof ApiKeys)
    return testApiKey(keyName, value)
  })

  ipcMain.handle('settings:testApiKeyValue', async (_event, keyName: string, value: string) => {
    return testApiKey(keyName, value)
  })

  ipcMain.handle('settings:getPreferences', async () => {
    return store.getAllPreferences()
  })

  ipcMain.handle('settings:setPreference', async (_event, key: string, value: unknown) => {
    await store.setPreference(key as keyof import('../lib/settings/store.js').Preferences, value as never)
    return { success: true }
  })

  ipcMain.handle('settings:getMockStatus', async () => {
    return store.getMockStatus()
  })
}
