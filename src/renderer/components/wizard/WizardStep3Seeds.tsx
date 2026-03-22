import React, { useState, useRef } from 'react'

interface Props {
  onNext: () => void
  onBack: () => void
}

const SUGGESTIONS = [
  'Bonobo', 'Nujabes', 'Four Tet', 'Floating Points', 'Rival Consoles',
  'Jon Hopkins', 'Nicolas Jaar', 'Actress', 'Andy Stott', 'Burial',
  'Aphex Twin', 'Boards of Canada', 'The Cinematic Orchestra', 'Royksopp',
  'Dj Shadow', 'Massive Attack', 'Portishead', 'Arca', 'FKA Twigs',
  'BadBadNotGood', 'Thundercat', 'Flying Lotus', 'Kamasi Washington',
]

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function WizardStep3Seeds({ onNext, onBack }: Props) {
  const [artists, setArtists] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addArtist(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (artists.map((a) => a.toLowerCase()).includes(trimmed.toLowerCase())) return
    setArtists((prev) => [...prev, trimmed])
    setInputValue('')
    inputRef.current?.focus()
  }

  function removeArtist(name: string) {
    setArtists((prev) => prev.filter((a) => a !== name))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addArtist(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && artists.length > 0) {
      setArtists((prev) => prev.slice(0, -1))
    }
  }

  async function handleFinish() {
    if (artists.length === 0) {
      setError('Add at least one artist to continue.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      for (const artist of artists) {
        await window.electron.ipc.invoke('db:addSeed', { type: 'artist', value: artist })
      }
      onNext()
    } catch (e) {
      setError('Failed to save seeds. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const suggestions = SUGGESTIONS.filter(
    (s) => !artists.map((a) => a.toLowerCase()).includes(s.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full px-2 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Seed Artists
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Artists you love — these anchor the entire discovery process. Add at least one.
        </p>
      </div>

      {/* Input area */}
      <div
        className="flex flex-wrap gap-2 p-3 rounded-xl cursor-text min-h-16"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
        onClick={() => inputRef.current?.focus()}
      >
        {artists.map((artist) => (
          <span
            key={artist}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
            style={{ background: 'rgba(124,106,247,0.18)', color: 'var(--accent-light)', border: '1px solid rgba(124,106,247,0.30)' }}
          >
            {artist}
            <button
              onClick={(e) => { e.stopPropagation(); removeArtist(artist) }}
              className="rounded-full transition-colors hover:text-white"
              style={{ color: 'var(--accent)' }}
            >
              <XIcon />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={artists.length === 0 ? 'Type an artist name and press Enter…' : 'Add more…'}
          className="flex-1 text-sm min-w-40 bg-transparent"
          style={{
            outline: 'none',
            border: 'none',
            color: 'var(--text-primary)',
          }}
        />
        {inputValue.trim() && (
          <button
            onClick={() => addArtist(inputValue)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <PlusIcon /> Add
          </button>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(229,83,75,0.10)', color: 'var(--status-error)', border: '1px solid rgba(229,83,75,0.20)' }}>
          {error}
        </div>
      )}

      {/* Suggestions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          Suggestions
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, 18).map((s) => (
            <button
              key={s}
              onClick={() => addArtist(s)}
              className="px-3 py-1.5 rounded-full text-sm transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--accent-light)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back
        </button>

        <div className="flex items-center gap-3">
          {artists.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {artists.length} artist{artists.length !== 1 ? 's' : ''} added
            </span>
          )}
          <button
            onClick={handleFinish}
            disabled={artists.length === 0 || saving}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{
              background: artists.length > 0 ? 'white' : 'var(--bg-elevated)',
              color: artists.length > 0 ? '#000' : 'var(--text-muted)',
              boxShadow: artists.length > 0 ? '0 2px 16px rgba(255,255,255,0.15)' : 'none',
            }}
          >
            {saving ? 'Saving…' : 'Continue'}
            {!saving && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12,5 19,12 12,19" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
