import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'
import { useDatabase } from '../hooks/useDatabase'
import ApiKeyManager from '../components/settings/ApiKeyManager'
import SeedManager from '../components/settings/SeedManager'
import TasteDescriptors from '../components/settings/TasteDescriptors'
import ChannelManager from '../components/settings/ChannelManager'
import HomeworkImport from '../components/settings/HomeworkImport'
import LoadingSpinner from '../components/shared/LoadingSpinner'

type Section = 'keys' | 'seeds' | 'descriptors' | 'channels' | 'preferences' | 'import'

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const isFirstRun = searchParams.get('firstRun') === 'true'
  const [activeSection, setActiveSection] = useState<Section>('keys')

  const { apiKeys, preferences, loading, saveApiKey, testApiKeyValue, savePreference } = useSettings()
  const db = useDatabase()

  const sections: { id: Section; label: string }[] = [
    { id: 'keys', label: 'API Keys' },
    { id: 'seeds', label: 'Seed Artists' },
    { id: 'descriptors', label: 'Taste Descriptors' },
    { id: 'channels', label: 'Source Channels' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'import', label: 'Import' },
  ]

  return (
    <div className="flex h-full">
      {/* Section nav */}
      <nav className="w-48 shrink-0 border-r border-border py-4 px-2 space-y-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={[
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
              activeSection === s.id
                ? 'bg-accent/15 text-accent-light font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isFirstRun && (
          <div className="mb-6 p-4 rounded-xl border" style={{ background: 'rgba(124,106,247,0.1)', borderColor: 'rgba(124,106,247,0.3)' }}>
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-accent-light">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <div className="font-semibold text-text-primary text-sm mb-1">Welcome to MixingSongFinder!</div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  Start by adding a Last.fm API key (free) and a few seed artists below.
                  You can also fill in <code className="text-accent-light bg-bg-surface px-1 rounded">BACKLOG-homework.md</code> and
                  use the <button onClick={() => setActiveSection('import')} className="text-accent-light underline underline-offset-2 hover:text-accent transition-colors">Import</button> tab to load your full taste profile at once.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-text-muted"><LoadingSpinner /> Loading settings...</div>
        ) : (
          <>
            {activeSection === 'keys' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-text-primary">API Keys</h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Connect data sources. Keys are stored locally on your machine only.
                    Missing keys fall back to mock data — useful for development.
                  </p>
                </div>
                <ApiKeyManager
                  initialKeys={apiKeys as Record<string, string>}
                  onSave={saveApiKey}
                  onTest={testApiKeyValue}
                />
              </div>
            )}

            {activeSection === 'seeds' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-text-primary">Seed Artists & Tracks</h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Artists and tracks you know you love. These are the starting point for discovery.
                    Add at least 3–5 for best results.
                  </p>
                </div>
                <SeedManager
                  onAdd={(type, value) => db.addSeed(type, value) as Promise<void>}
                  onRemove={(id) => db.removeSeed(id) as Promise<void>}
                  getSeeds={() => db.getSeeds()}
                />
              </div>
            )}

            {activeSection === 'descriptors' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-text-primary">Taste Descriptors</h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Words and phrases describing the music you want. Used to guide scoring and LLM extraction.
                  </p>
                </div>
                <TasteDescriptors
                  onAdd={(d) => db.addTasteDescriptor(d) as Promise<void>}
                  onRemove={(id) => db.removeTasteDescriptor(id) as Promise<void>}
                  getDescriptors={() => db.getTasteDescriptors()}
                />
              </div>
            )}

            {activeSection === 'channels' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-text-primary">Source Channels</h2>
                  <p className="text-text-secondary text-sm mt-1">
                    YouTube channels, Mixcloud creators, radio shows, and blogs to mine for tracks.
                  </p>
                </div>
                <ChannelManager
                  onAdd={(data) => db.addSourceChannel(data) as Promise<void>}
                  onRemove={(id) => db.removeSourceChannel(id) as Promise<void>}
                  onToggle={(id, enabled) => db.toggleSourceChannel(id, enabled) as Promise<void>}
                  getChannels={(type) => db.getSourceChannels(type)}
                />
              </div>
            )}

            {activeSection === 'preferences' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-text-primary">Preferences</h2>
                  <p className="text-text-secondary text-sm mt-1">Playback and pipeline behaviour settings.</p>
                </div>
                <div className="space-y-4">
                  <PreferenceSetting
                    label="Auto-play next track"
                    description="Automatically play the next track when one ends (radio mode)"
                    checked={preferences.autoPlayNext}
                    onChange={(v) => savePreference('autoPlayNext', v)}
                  />
                  <PreferenceNumber
                    label="Max cost per run (USD)"
                    description="Show a warning when estimated pipeline cost exceeds this amount"
                    value={preferences.maxCostPerRunUsd}
                    min={1}
                    max={100}
                    onChange={(v) => savePreference('maxCostPerRunUsd', v)}
                  />
                </div>
              </div>
            )}

            {activeSection === 'import' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-text-primary">Import</h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Bulk-import your taste profile from a homework sheet, or add tracks from CSV, JSON, or text files.
                    Imported tracks become seeds and will be scored on the next pipeline run.
                  </p>
                </div>
                <HomeworkImport />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PreferenceSetting({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
      <div>
        <div className="font-medium text-sm text-text-primary">{label}</div>
        <div className="text-xs text-text-muted mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ml-4 ${checked ? 'bg-accent' : 'bg-border-light'}`}
      >
        <span
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  )
}

function PreferenceNumber({ label, description, value, min, max, onChange }: {
  label: string; description: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
      <div>
        <div className="font-medium text-sm text-text-primary">{label}</div>
        <div className="text-xs text-text-muted mt-0.5">{description}</div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <span className="text-xs text-text-muted">$</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 px-2 py-1 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary text-right focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  )
}
