import React, { useState } from 'react'
import LoadingSpinner from '../shared/LoadingSpinner'

interface Playlist {
  id: number
  name: string
  description: string | null
  track_count?: number
  created_at: string
}

interface Props {
  playlists: Playlist[]
  selectedId: number | null
  onSelect: (id: number) => void
  onCreate: (name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export default function PlaylistList({ playlists, selectedId, onSelect, onCreate, onDelete }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading(true)
    try {
      await onCreate(newName.trim())
      setNewName('')
      setCreating(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      {playlists.map((pl) => (
        <div
          key={pl.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${selectedId === pl.id ? 'bg-accent/15' : 'hover:bg-bg-hover'}`}
          onClick={() => onSelect(pl.id)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-text-muted">
            <path d="M21 15V6m-8-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6M16 6V2m0 4-6 6" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className={`text-sm truncate ${selectedId === pl.id ? 'text-accent-light font-medium' : 'text-text-secondary'}`}>
              {pl.name}
            </div>
          </div>
          {pl.id !== 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(pl.id) }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-status-error transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {creating ? (
        <div className="flex gap-1.5 px-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            placeholder="Playlist name..."
            className="flex-1 px-2 py-1.5 rounded text-xs bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-2 py-1.5 rounded text-xs bg-accent text-white disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size={10} /> : '✓'}
          </button>
          <button onClick={() => setCreating(false)} className="px-2 py-1.5 rounded text-xs border border-border text-text-muted">✗</button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New playlist
        </button>
      )}
    </div>
  )
}
