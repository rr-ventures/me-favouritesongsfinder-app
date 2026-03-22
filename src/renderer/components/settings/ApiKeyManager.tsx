import React, { useState } from 'react'
import LoadingSpinner from '../shared/LoadingSpinner'

interface ApiKeyField {
  key: string
  label: string
  placeholder: string
  helpUrl?: string
  helpText: string
  type?: 'key' | 'email'
}

const API_FIELDS: ApiKeyField[] = [
  {
    key: 'lastfm_key',
    label: 'Last.fm API Key',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://www.last.fm/api/account/create',
    helpText: 'Free. Used for artist expansion, track discovery, and similarity data.',
  },
  {
    key: 'musicbrainz_email',
    label: 'MusicBrainz Email',
    placeholder: 'you@example.com',
    helpUrl: 'https://musicbrainz.org/register',
    helpText: 'Your email address, used as the User-Agent identifier. No API key needed.',
    type: 'email',
  },
  {
    key: 'discogs_token',
    label: 'Discogs Personal Token',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://www.discogs.com/settings/developers',
    helpText: 'Free account. Used for label rosters and style tags.',
  },
  {
    key: 'youtube_key',
    label: 'YouTube Data API Key',
    placeholder: 'AIza...',
    helpUrl: 'https://console.developers.google.com/',
    helpText: 'Free tier gives 10,000 units/day. Used for channel mining only (1 unit/call).',
  },
  {
    key: 'spotify_client_id',
    label: 'Spotify Client ID',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://developer.spotify.com/dashboard',
    helpText: 'For related artist discovery. Requires Client Secret below.',
  },
  {
    key: 'spotify_client_secret',
    label: 'Spotify Client Secret',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    helpText: 'Paired with Client ID above.',
  },
  {
    key: 'listenbrainz_token',
    label: 'ListenBrainz Token',
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    helpUrl: 'https://listenbrainz.org/profile/',
    helpText: 'Free. Used for collaborative filtering recommendations.',
  },
  {
    key: 'anthropic_key',
    label: 'Anthropic (Claude) API Key',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/',
    helpText: 'Used for tracklist extraction from mixes and editorial mining. ~$0.50/run.',
  },
  {
    key: 'gemini_key',
    label: 'Google Gemini API Key',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    helpText: 'Alternative to Claude. Free tier available.',
  },
]

interface Props {
  initialKeys: Record<string, string>
  onSave: (keyName: string, value: string) => Promise<void>
  onTest: (keyName: string, value: string) => Promise<{ ok: boolean; message: string }>
}

interface KeyState {
  value: string
  dirty: boolean
  testing: boolean
  testResult: { ok: boolean; message: string } | null
}

export default function ApiKeyManager({ initialKeys, onSave, onTest }: Props) {
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>(() => {
    const initial: Record<string, KeyState> = {}
    for (const f of API_FIELDS) {
      initial[f.key] = {
        value: initialKeys[f.key] ?? '',
        dirty: false,
        testing: false,
        testResult: null,
      }
    }
    return initial
  })
  const [saving, setSaving] = useState<string | null>(null)

  function update(key: string, value: string) {
    setKeyStates((s) => ({
      ...s,
      [key]: { ...s[key], value, dirty: true, testResult: null },
    }))
  }

  async function save(key: string) {
    setSaving(key)
    try {
      await onSave(key, keyStates[key].value)
      setKeyStates((s) => ({ ...s, [key]: { ...s[key], dirty: false } }))
    } finally {
      setSaving(null)
    }
  }

  async function test(key: string) {
    setKeyStates((s) => ({ ...s, [key]: { ...s[key], testing: true, testResult: null } }))
    try {
      // Save first if dirty
      if (keyStates[key].dirty) await save(key)
      const result = await onTest(key, keyStates[key].value)
      setKeyStates((s) => ({ ...s, [key]: { ...s[key], testing: false, testResult: result } }))
    } catch (e) {
      setKeyStates((s) => ({
        ...s,
        [key]: { ...s[key], testing: false, testResult: { ok: false, message: 'Error' } },
      }))
    }
  }

  return (
    <div className="space-y-4">
      {API_FIELDS.map((field) => {
        const state = keyStates[field.key]
        const isSaving = saving === field.key
        const hasValue = state.value.trim().length > 0

        return (
          <div key={field.key} className="p-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-sm text-text-primary">{field.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{field.helpText}</div>
              </div>
              {field.helpUrl && (
                <a
                  href={field.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-light hover:underline shrink-0 ml-4"
                  onClick={(e) => { e.preventDefault(); window.electron.ipc.send('shell:openExternal', field.helpUrl) }}
                >
                  Get key ↗
                </a>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type={field.type === 'email' ? 'email' : 'password'}
                value={state.value}
                onChange={(e) => update(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-mono bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              {state.dirty && (
                <button
                  onClick={() => save(field.key)}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-50"
                >
                  {isSaving ? <LoadingSpinner size={14} /> : 'Save'}
                </button>
              )}
              {hasValue && (
                <button
                  onClick={() => test(field.key)}
                  disabled={state.testing}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-light transition-colors disabled:opacity-50"
                >
                  {state.testing ? <LoadingSpinner size={14} /> : 'Test'}
                </button>
              )}
            </div>
            {state.testResult && (
              <div
                className="mt-2 text-xs px-2 py-1 rounded flex items-center gap-1.5"
                style={{
                  color: state.testResult.ok ? '#4ade80' : '#f87171',
                  background: state.testResult.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                }}
              >
                <span>{state.testResult.ok ? '✓' : '✗'}</span>
                <span>{state.testResult.message}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
