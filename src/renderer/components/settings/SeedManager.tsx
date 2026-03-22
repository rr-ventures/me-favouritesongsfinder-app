import React, { useState, useEffect } from 'react'
import LoadingSpinner from '../shared/LoadingSpinner'

interface SeedInput {
  id: number
  input_type: string
  input_value: string
  created_at: string
}

interface Props {
  onAdd: (inputType: string, inputValue: string) => Promise<void>
  onRemove: (id: number) => Promise<void>
  getSeeds: (inputType?: string) => Promise<unknown>
}

export default function SeedManager({ onAdd, onRemove, getSeeds }: Props) {
  const [seeds, setSeeds] = useState<SeedInput[]>([])
  const [newValue, setNewValue] = useState('')
  const [inputType, setInputType] = useState<string>('artist')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const data = await getSeeds() as SeedInput[]
    setSeeds(data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleAdd() {
    const val = newValue.trim()
    if (!val) return
    setAdding(true)
    try {
      await onAdd(inputType, val)
      setNewValue('')
      await refresh()
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id: number) {
    await onRemove(id)
    await refresh()
  }

  const artistSeeds = seeds.filter((s) => s.input_type === 'artist')
  const trackSeeds = seeds.filter((s) => s.input_type === 'track')
  const otherSeeds = seeds.filter((s) => !['artist', 'track'].includes(s.input_type))

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm"><LoadingSpinner size={16} /> Loading seeds...</div>

  return (
    <div className="space-y-4">
      {/* Add new seed */}
      <div className="flex gap-2">
        <select
          value={inputType}
          onChange={(e) => setInputType(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="artist">Artist</option>
          <option value="track">Track</option>
          <option value="spotify_url">Spotify URL</option>
          <option value="youtube_url">YouTube URL</option>
        </select>
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={
            inputType === 'artist' ? 'e.g. Bonobo' :
            inputType === 'track' ? 'e.g. Nujabes - Aruarian Dance' :
            inputType === 'spotify_url' ? 'https://open.spotify.com/artist/...' :
            'https://www.youtube.com/watch?v=...'
          }
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newValue.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40"
        >
          {adding ? <LoadingSpinner size={14} /> : 'Add'}
        </button>
      </div>

      {/* Seeds display */}
      {seeds.length === 0 ? (
        <p className="text-text-muted text-sm italic">
          No seeds added yet. Add at least 3 seed artists to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {[
            { label: 'Artists', items: artistSeeds },
            { label: 'Tracks', items: trackSeeds },
            { label: 'URLs', items: otherSeeds },
          ].filter((g) => g.items.length > 0).map(({ label, items }) => (
            <div key={label}>
              <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{label}</div>
              <div className="flex flex-wrap gap-2">
                {items.map((seed) => (
                  <div
                    key={seed.id}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  >
                    <span className="text-text-primary">{seed.input_value}</span>
                    <button
                      onClick={() => handleRemove(seed.id)}
                      className="text-text-muted hover:text-status-error transition-colors ml-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
