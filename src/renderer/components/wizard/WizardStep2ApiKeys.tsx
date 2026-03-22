import React, { useState } from 'react'

interface Props {
  onNext: () => void
}

interface ApiKeyField {
  key: string
  label: string
  description: string
  placeholder: string
  required?: boolean
  link: string
  linkLabel: string
}

const API_KEY_FIELDS: ApiKeyField[] = [
  {
    key: 'lastfm_key',
    label: 'Last.fm API Key',
    description: 'Used to discover similar artists and tracks. Required for the pipeline to run.',
    placeholder: 'your_lastfm_api_key',
    required: true,
    link: 'https://www.last.fm/api/account/create',
    linkLabel: 'Get Last.fm key',
  },
  {
    key: 'youtube_key',
    label: 'YouTube Data API Key',
    description: 'Used to mine channel video descriptions and search for playback.',
    placeholder: 'AIza...',
    link: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    linkLabel: 'Enable YouTube Data API',
  },
  {
    key: 'spotify_client_id',
    label: 'Spotify Client ID',
    description: 'Used to find related artists. Pair with a client secret.',
    placeholder: 'your_spotify_client_id',
    link: 'https://developer.spotify.com/dashboard',
    linkLabel: 'Spotify Developer Dashboard',
  },
  {
    key: 'spotify_client_secret',
    label: 'Spotify Client Secret',
    description: 'Paired with your Spotify Client ID.',
    placeholder: 'your_spotify_client_secret',
    link: 'https://developer.spotify.com/dashboard',
    linkLabel: 'Spotify Developer Dashboard',
  },
  {
    key: 'discogs_token',
    label: 'Discogs Token',
    description: 'Used to enrich artists with label affiliations and discover label rosters.',
    placeholder: 'your_discogs_token',
    link: 'https://www.discogs.com/settings/developers',
    linkLabel: 'Discogs developer settings',
  },
  {
    key: 'anthropic_key',
    label: 'Anthropic (Claude) API Key',
    description: 'Powers AI tracklist extraction, Reddit mining, and editorial blog scraping.',
    placeholder: 'sk-ant-...',
    link: 'https://console.anthropic.com/',
    linkLabel: 'Anthropic console',
  },
  {
    key: 'gemini_key',
    label: 'Google Gemini API Key',
    description: 'Alternative LLM for AI extraction steps (used if Anthropic is not set).',
    placeholder: 'AIza...',
    link: 'https://aistudio.google.com/app/apikey',
    linkLabel: 'Google AI Studio',
  },
]

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'

interface FieldState {
  value: string
  saved: boolean
  testStatus: TestStatus
  testMessage: string
}

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15,3 21,3 21,9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  )
}

export default function WizardStep2ApiKeys({ onNext }: Props) {
  const [fields, setFields] = useState<Record<string, FieldState>>(
    Object.fromEntries(API_KEY_FIELDS.map((f) => [f.key, { value: '', saved: false, testStatus: 'idle', testMessage: '' }]))
  )

  const lastfmSaved = fields['lastfm_key']?.saved

  function updateField(key: string, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function handleSave(field: ApiKeyField) {
    const val = fields[field.key]?.value.trim()
    if (!val) return
    await window.electron.ipc.invoke('settings:setApiKey', field.key, val)
    updateField(field.key, { saved: true })
  }

  async function handleTest(field: ApiKeyField) {
    const val = fields[field.key]?.value.trim()
    if (val) {
      await window.electron.ipc.invoke('settings:setApiKey', field.key, val)
    }
    updateField(field.key, { testStatus: 'testing', testMessage: '' })
    try {
      const result = await window.electron.ipc.invoke('settings:testApiKey', field.key) as { ok: boolean; message: string }
      updateField(field.key, {
        testStatus: result.ok ? 'ok' : 'error',
        testMessage: result.message,
        saved: result.ok ? true : fields[field.key].saved,
      })
    } catch (e) {
      updateField(field.key, { testStatus: 'error', testMessage: 'Connection failed' })
    }
  }

  function openExternal(url: string) {
    window.electron.ipc.invoke('shell:openExternal', url).catch(() => {
      // Fallback — not critical
    })
  }

  return (
    <div className="flex flex-col gap-0 max-w-2xl mx-auto w-full px-2 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          API Keys
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Only <strong style={{ color: 'var(--text-primary)' }}>Last.fm</strong> is required. All others are optional — missing keys use mock data automatically.
        </p>
      </div>

      <div className="space-y-3">
        {API_KEY_FIELDS.map((field) => {
          const state = fields[field.key]
          return (
            <div
              key={field.key}
              className="rounded-xl p-4"
              style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${state.saved ? 'rgba(30,215,96,0.25)' : 'var(--border)'}`,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {field.label}
                    </span>
                    {field.required && (
                      <span
                        className="text-2xs px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(124,106,247,0.20)', color: 'var(--accent-light)', letterSpacing: '0.05em' }}
                      >
                        REQUIRED
                      </span>
                    )}
                    {state.saved && (
                      <span
                        className="text-2xs px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1"
                        style={{ background: 'rgba(30,215,96,0.12)', color: 'var(--status-success)' }}
                      >
                        <CheckIcon /> Saved
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{field.description}</p>
                </div>
                <button
                  onClick={() => openExternal(field.link)}
                  className="text-xs flex items-center gap-1 shrink-0 transition-colors"
                  style={{ color: 'var(--accent-light)' }}
                >
                  {field.linkLabel} <ExternalLinkIcon />
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={state.value}
                  onChange={(e) => updateField(field.key, { value: e.target.value, saved: false, testStatus: 'idle' })}
                  placeholder={state.saved ? '••••••••••••' : field.placeholder}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(field) }}
                />
                <button
                  onClick={() => handleSave(field)}
                  disabled={!state.value.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => handleTest(field)}
                  disabled={state.testStatus === 'testing' || (!state.value.trim() && !state.saved)}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(124,106,247,0.12)',
                    border: '1px solid rgba(124,106,247,0.25)',
                    color: 'var(--accent-light)',
                  }}
                >
                  {state.testStatus === 'testing' ? '…' : 'Test'}
                </button>
              </div>

              {/* Test result */}
              {state.testStatus !== 'idle' && state.testStatus !== 'testing' && state.testMessage && (
                <div
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    background: state.testStatus === 'ok'
                      ? 'rgba(30,215,96,0.08)'
                      : 'rgba(229,83,75,0.08)',
                    color: state.testStatus === 'ok' ? 'var(--status-success)' : 'var(--status-error)',
                    border: `1px solid ${state.testStatus === 'ok' ? 'rgba(30,215,96,0.20)' : 'rgba(229,83,75,0.20)'}`,
                  }}
                >
                  {state.testMessage}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={onNext}
          disabled={!lastfmSaved}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          style={{
            background: lastfmSaved ? 'white' : 'var(--bg-elevated)',
            color: lastfmSaved ? '#000' : 'var(--text-muted)',
            boxShadow: lastfmSaved ? '0 2px 16px rgba(255,255,255,0.15)' : 'none',
          }}
          title={!lastfmSaved ? 'Save your Last.fm API key to continue' : ''}
        >
          {lastfmSaved ? 'Continue' : 'Save Last.fm key to continue'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12,5 19,12 12,19" />
          </svg>
        </button>
      </div>
    </div>
  )
}
