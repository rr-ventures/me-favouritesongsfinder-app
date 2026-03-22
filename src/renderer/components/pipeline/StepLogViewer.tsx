import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { PipelineEvent } from '../../../main/lib/pipeline/types'

interface Props {
  logs: PipelineEvent[]
  stepName: string
  startedAt?: number  // ms timestamp when step started, for relative time display
  maxHeight?: number
}

type FilterLevel = 'all' | 'info' | 'warn' | 'error' | 'api'

function getEventColor(event: PipelineEvent): string {
  if (event.type === 'api_call') return '#60a5fa'       // blue — API calls
  if (event.type === 'error') return '#f87171'           // red
  if (event.type === 'warning') return '#fbbf24'         // amber
  if (event.type === 'complete') return '#34d399'        // green
  if (event.type === 'item_processed') return '#a78bfa'  // purple
  if (event.type === 'cost_update') return '#f59e0b'     // orange
  if (event.type === 'progress') return '#64748b'        // slate — progress is noise, dim it
  if (event.level === 'warn') return '#fbbf24'
  if (event.level === 'error') return '#f87171'
  if (event.level === 'debug') return '#4b5563'
  return '#94a3b8'
}

function getLevelTag(event: PipelineEvent): string {
  if (event.type === 'api_call') return 'API'
  if (event.type === 'error') return 'ERR'
  if (event.type === 'warning') return 'WARN'
  if (event.type === 'complete') return 'DONE'
  if (event.type === 'item_processed') return 'ITEM'
  if (event.type === 'cost_update') return 'COST'
  if (event.type === 'progress') return 'PROG'
  return (event.level ?? 'info').toUpperCase().slice(0, 4)
}

function formatTimestamp(ts: Date | string, startedAt?: number): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  if (startedAt) {
    const delta = d.getTime() - startedAt
    if (delta < 0) return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const m = Math.floor(delta / 60000)
    const s = ((delta % 60000) / 1000).toFixed(1)
    return m > 0 ? `+${m}m${s}s` : `+${s}s`
  }
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function passesFilter(event: PipelineEvent, filter: FilterLevel): boolean {
  if (filter === 'all') return true
  if (filter === 'api') return event.type === 'api_call'
  if (filter === 'error') return event.type === 'error' || event.level === 'error'
  if (filter === 'warn') return event.type === 'warning' || event.level === 'warn'
  if (filter === 'info') return (
    event.type === 'log' && (event.level === 'info' || !event.level) ||
    event.type === 'complete' ||
    event.type === 'item_processed'
  )
  return true
}

function exportLogs(logs: PipelineEvent[], stepName: string) {
  const lines = logs.map((e) =>
    `[${formatTimestamp(e.timestamp)}][${getLevelTag(e)}] ${e.message}` +
    (e.elapsedMs !== undefined ? ` (t+${(e.elapsedMs / 1000).toFixed(1)}s)` : '') +
    (e.data && e.type !== 'progress' ? ` | ${JSON.stringify(e.data)}` : '')
  )
  const text = `# SoundScope Pipeline Log — ${stepName}\n# Exported: ${new Date().toISOString()}\n\n${lines.join('\n')}`
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `soundscope-${stepName}-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const FILTER_OPTIONS: Array<{ id: FilterLevel; label: string; color?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'info', label: 'Info', color: '#94a3b8' },
  { id: 'warn', label: 'Warn', color: '#fbbf24' },
  { id: 'error', label: 'Error', color: '#f87171' },
  { id: 'api', label: 'API calls', color: '#60a5fa' },
]

export default function StepLogViewer({ logs, stepName, startedAt, maxHeight = 320 }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const [filter, setFilter] = useState<FilterLevel>('all')

  useEffect(() => {
    if (autoFollow) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoFollow])

  function onScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (atBottom !== autoFollow) setAutoFollow(atBottom)
  }

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter((e) => passesFilter(e, filter))

  const apiCallCount = logs.filter((e) => e.type === 'api_call').length
  const errorCount = logs.filter((e) => e.type === 'error' || e.level === 'error').length
  const warnCount = logs.filter((e) => e.type === 'warning' || e.level === 'warn').length

  if (logs.length === 0) {
    return (
      <div
        className="mx-4 mb-4 rounded-lg p-4 text-center text-xs"
        style={{ background: '#0a0a0a', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
      >
        No logs yet. Run this step to see output here.
      </div>
    )
  }

  return (
    <div className="mx-4 mb-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {/* Filter pills */}
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className="px-2 py-0.5 rounded text-2xs font-medium transition-all"
              style={{
                background: filter === opt.id ? (opt.color ? `${opt.color}22` : 'var(--bg-hover)') : 'transparent',
                border: `1px solid ${filter === opt.id ? (opt.color ?? 'var(--accent)') : 'var(--border)'}`,
                color: filter === opt.id ? (opt.color ?? 'var(--text-primary)') : 'var(--text-muted)',
              }}
            >
              {opt.label}
              {opt.id === 'api' && apiCallCount > 0 && <span className="ml-1 opacity-70">{apiCallCount}</span>}
              {opt.id === 'error' && errorCount > 0 && <span className="ml-1 opacity-70">{errorCount}</span>}
              {opt.id === 'warn' && warnCount > 0 && <span className="ml-1 opacity-70">{warnCount}</span>}
            </button>
          ))}
        </div>

        <span className="text-2xs ml-1" style={{ color: 'var(--text-muted)' }}>
          {filteredLogs.length}/{logs.length} entries
        </span>

        <div className="flex-1" />

        {/* Auto-follow toggle */}
        <button
          onClick={() => setAutoFollow(!autoFollow)}
          className="flex items-center gap-1 text-2xs px-2 py-0.5 rounded transition-colors"
          style={{
            color: autoFollow ? 'var(--accent-light)' : 'var(--text-muted)',
            border: `1px solid ${autoFollow ? 'rgba(124,106,247,0.30)' : 'var(--border)'}`,
            background: autoFollow ? 'rgba(124,106,247,0.08)' : 'transparent',
          }}
          title="Auto-scroll to latest log entry"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6,9 12,15 18,9" />
          </svg>
          Follow
        </button>

        <button
          onClick={() => exportLogs(logs, stepName)}
          className="text-2xs px-2 py-0.5 rounded transition-colors flex items-center gap-1"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          .txt
        </button>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="rounded-lg overflow-y-auto"
        style={{
          background: '#050505',
          border: '1px solid var(--border)',
          maxHeight,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '11px',
          lineHeight: 1.65,
          padding: '8px 10px',
        }}
      >
        {filteredLogs.map((entry, i) => {
          const color = getEventColor(entry)
          const tag = getLevelTag(entry)
          const isApi = entry.type === 'api_call'
          const isImportant = entry.type === 'complete' || entry.type === 'error'

          return (
            <div
              key={i}
              className="flex gap-2 items-start"
              style={{
                borderBottom: isImportant ? `1px solid ${color}22` : undefined,
                marginBottom: isImportant ? '2px' : undefined,
                paddingBottom: isImportant ? '2px' : undefined,
                background: isApi ? 'rgba(96,165,250,0.04)' : undefined,
              }}
            >
              {/* Timestamp */}
              <span
                className="shrink-0 tabular-nums"
                style={{ color: '#3a3a4a', minWidth: startedAt ? 52 : 60, userSelect: 'none' }}
              >
                {formatTimestamp(entry.timestamp, startedAt)}
              </span>

              {/* Level tag */}
              <span
                className="shrink-0 font-bold"
                style={{ color, minWidth: 38, userSelect: 'none', opacity: isImportant ? 1 : 0.75 }}
              >
                [{tag}]
              </span>

              {/* ETA / elapsed pill */}
              {entry.etaMs !== undefined && entry.etaMs > 0 && (
                <span
                  className="shrink-0 text-2xs px-1 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', fontSize: '9px', marginTop: '1px' }}
                >
                  ETA {formatRelativeMs(entry.etaMs)}
                </span>
              )}

              {/* Message */}
              <span
                style={{
                  color: isImportant ? color : (color !== '#94a3b8' ? color : '#8899aa'),
                  wordBreak: 'break-word',
                  flex: 1,
                  fontWeight: isImportant ? 600 : 400,
                }}
              >
                {entry.message}

                {/* Progress percentage inline */}
                {entry.type === 'progress' && entry.data != null && (
                  <span style={{ opacity: 0.5 }}>
                    {` [${Math.round(((entry.data as Record<string, unknown>).percent as number) ?? 0)}%]`}
                  </span>
                )}

                {/* Cost inline */}
                {entry.type === 'cost_update' && entry.data != null && (
                  <span style={{ opacity: 0.6 }}>
                    {` [step: $${(((entry.data as Record<string, unknown>).costUsd as number) ?? 0).toFixed(4)}]`}
                  </span>
                )}

                {/* Items done/total */}
                {entry.itemsDone !== undefined && entry.itemsTotal !== undefined && entry.type !== 'progress' && (
                  <span style={{ opacity: 0.45 }}>
                    {' '}({entry.itemsDone}/{entry.itemsTotal})
                  </span>
                )}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function formatRelativeMs(ms: number): string {
  if (ms < 1000) return `<1s`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return s > 0 ? `${m}m${s}s` : `${m}m`
}
