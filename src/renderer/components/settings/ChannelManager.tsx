import React, { useState, useEffect } from 'react'
import LoadingSpinner from '../shared/LoadingSpinner'

interface SourceChannel {
  id: number
  source_type: string
  name: string
  url: string
  enabled: number
  notes: string | null
}

interface Props {
  onAdd: (data: { source_type: string; name: string; url: string; notes?: string }) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onToggle: (id: number, enabled: boolean) => Promise<void>
  getChannels: (sourceType?: string) => Promise<unknown>
}

const SOURCE_TYPES = [
  { value: 'youtube_channel', label: 'YouTube Channel' },
  { value: 'mixcloud_creator', label: 'Mixcloud Creator' },
  { value: 'radio_show', label: 'Radio Show' },
  { value: 'blog', label: 'Editorial Blog' },
]

export default function ChannelManager({ onAdd, onRemove, onToggle, getChannels }: Props) {
  const [channels, setChannels] = useState<SourceChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ source_type: 'youtube_channel', name: '', url: '', notes: '' })
  const [showForm, setShowForm] = useState(false)

  async function refresh() {
    const data = await getChannels() as SourceChannel[]
    setChannels(data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleAdd() {
    if (!form.name.trim() || !form.url.trim()) return
    setAdding(true)
    try {
      await onAdd({ ...form, notes: form.notes || undefined })
      setForm({ source_type: 'youtube_channel', name: '', url: '', notes: '' })
      setShowForm(false)
      await refresh()
    } finally {
      setAdding(false)
    }
  }

  const grouped = SOURCE_TYPES.map((t) => ({
    ...t,
    items: channels.filter((c) => c.source_type === t.value),
  })).filter((g) => g.items.length > 0 || g.value === form.source_type)

  if (loading) return <div className="flex items-center gap-2 text-text-muted text-sm"><LoadingSpinner size={16} /> Loading...</div>

  return (
    <div className="space-y-4">
      {/* Add button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-dashed border-border text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add source channel
        </button>
      ) : (
        <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex gap-2">
            <select
              value={form.source_type}
              onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
              className="px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary focus:outline-none focus:border-accent"
            >
              {SOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Channel name"
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || !form.name.trim() || !form.url.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40"
            >
              {adding ? <LoadingSpinner size={14} /> : 'Add'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Channel list */}
      {channels.length === 0 ? (
        <p className="text-text-muted text-sm italic">No source channels yet. Add YouTube channels, Mixcloud creators, or blogs to mine.</p>
      ) : (
        SOURCE_TYPES.map((type) => {
          const items = channels.filter((c) => c.source_type === type.value)
          if (items.length === 0) return null
          return (
            <div key={type.value}>
              <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{type.label}</div>
              <div className="space-y-2">
                {items.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <button
                      onClick={() => onToggle(ch.id, !ch.enabled).then(refresh)}
                      className={`w-8 h-4 rounded-full transition-colors relative ${ch.enabled ? 'bg-accent' : 'bg-border-light'}`}
                    >
                      <span
                        className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform"
                        style={{ left: ch.enabled ? '18px' : '2px' }}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{ch.name}</div>
                      <div className="text-xs text-text-muted truncate">{ch.url}</div>
                    </div>
                    <button
                      onClick={() => onRemove(ch.id).then(refresh)}
                      className="text-text-muted hover:text-status-error transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19,6l-1,14H6L5,6" />
                        <path d="M10,11v6M14,11v6" />
                        <path d="M9,6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
