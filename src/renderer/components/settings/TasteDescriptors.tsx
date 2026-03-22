import React, { useState, useEffect } from 'react'
import LoadingSpinner from '../shared/LoadingSpinner'

interface Descriptor {
  id: number
  descriptor: string
  weight: number
}

interface Props {
  onAdd: (descriptor: string) => Promise<void>
  onRemove: (id: number) => Promise<void>
  getDescriptors: () => Promise<unknown>
}

const SUGGESTIONS = [
  'downtempo', 'trip-hop', 'lo-fi', 'instrumental', 'jazzy beats',
  'late night', 'mellow', 'ambient', 'electronic', 'psychedelic',
  'soulful', 'chill', 'cinematic', 'atmospheric', 'organic',
]

export default function TasteDescriptors({ onAdd, onRemove, getDescriptors }: Props) {
  const [descriptors, setDescriptors] = useState<Descriptor[]>([])
  const [newValue, setNewValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  async function refresh() {
    const data = await getDescriptors() as Descriptor[]
    setDescriptors(data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleAdd(value: string) {
    const val = value.trim()
    if (!val || descriptors.some((d) => d.descriptor.toLowerCase() === val.toLowerCase())) return
    setAdding(true)
    try {
      await onAdd(val)
      setNewValue('')
      await refresh()
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm"><LoadingSpinner size={16} /> Loading...</div>

  const existingSet = new Set(descriptors.map((d) => d.descriptor.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd(newValue)}
          placeholder="e.g. dreamy, late night, organic beats..."
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={() => handleAdd(newValue)}
          disabled={adding || !newValue.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40"
        >
          {adding ? <LoadingSpinner size={14} /> : 'Add'}
        </button>
      </div>

      {/* Suggestions */}
      <div>
        <div className="text-xs text-text-muted mb-2">Suggestions — click to add:</div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.filter((s) => !existingSet.has(s)).map((s) => (
            <button
              key={s}
              onClick={() => handleAdd(s)}
              className="px-2 py-1 rounded-full text-xs border border-dashed border-border text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Current descriptors */}
      {descriptors.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Your descriptors</div>
          <div className="flex flex-wrap gap-2">
            {descriptors.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                style={{ background: 'rgba(124,106,247,0.12)', border: '1px solid rgba(124,106,247,0.3)', color: 'var(--accent-light)' }}
              >
                <span>{d.descriptor}</span>
                <button
                  onClick={() => onRemove(d.id).then(refresh)}
                  className="opacity-60 hover:opacity-100 transition-opacity ml-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
