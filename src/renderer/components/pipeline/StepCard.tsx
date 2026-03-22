import React, { useState, useEffect } from 'react'
import StepLogViewer from './StepLogViewer'
import type { PipelineStepInfo } from '../../hooks/usePipeline'
import type { PipelineEvent, RunOptions, RunScope } from '../../../main/lib/pipeline/types'

interface Props {
  step: PipelineStepInfo
  logs: PipelineEvent[]
  isRunning: boolean
  onRun: (options?: RunOptions) => void
  onCancel: () => void
  onResume: (runId: number) => void
}

type Status = 'idle' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled'

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running:   '#60a5fa',
    completed: '#34d399',
    failed:    '#f87171',
    partial:   '#fbbf24',
    cancelled: '#6b7280',
    idle:      '#374151',
  }
  const color = colors[status] ?? colors.idle
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: 8, height: 8,
        background: color,
        boxShadow: status === 'running' ? `0 0 6px ${color}` : undefined,
        animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : undefined,
      }}
    />
  )
}

function categoryBadge(cat: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    api:        { label: 'API',       bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa' },
    scraped:    { label: 'Scrape/LLM', bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
    processing: { label: 'Processing', bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  }
  const cfg = map[cat] ?? { label: cat, bg: 'var(--bg-surface)', color: 'var(--text-muted)' }
  return (
    <span
      className="text-2xs px-1.5 py-0.5 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color, letterSpacing: '0.04em' }}
    >
      {cfg.label}
    </span>
  )
}

function formatDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function formatLastRun(lastRun: unknown): { text: string; color: string } {
  if (!lastRun) return { text: 'Never run', color: 'var(--text-muted)' }
  const run = lastRun as { started_at?: string; items_processed?: number; items_failed?: number; status?: string; estimated_cost_usd?: number }
  if (!run.started_at) return { text: 'Never run', color: 'var(--text-muted)' }

  const ago = Date.now() - new Date(run.started_at).getTime()
  const hours = Math.floor(ago / 3600000)
  const days = Math.floor(hours / 24)
  const timeStr = days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : 'Just now'

  const statusColors: Record<string, string> = {
    completed: 'var(--status-success)',
    failed: 'var(--status-error)',
    partial: 'var(--status-warning)',
    cancelled: 'var(--text-muted)',
  }

  let text = `${timeStr} · ${run.items_processed ?? 0} items`
  if (run.items_failed && run.items_failed > 0) text += `, ${run.items_failed} errors`
  if (run.estimated_cost_usd && run.estimated_cost_usd > 0) text += ` · $${run.estimated_cost_usd.toFixed(4)}`

  return {
    text,
    color: statusColors[run.status ?? ''] ?? 'var(--text-muted)',
  }
}

export default function StepCard({ step, logs, isRunning, onRun, onCancel, onResume }: Props) {
  const [showLogs, setShowLogs] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [selectedScope, setSelectedScope] = useState<'quick' | 'standard' | 'full'>('standard')
  const [stepStartedAt, setStepStartedAt] = useState<number | undefined>()

  const status: Status = isRunning ? 'running' : (step.status as Status)
  const lastRun = step.lastRun as { id?: number; status?: string; items_processed?: number; estimated_cost_usd?: number } | null
  const canResume = lastRun && lastRun.status === 'partial' && lastRun.id
  const { text: lastRunText, color: lastRunColor } = formatLastRun(step.lastRun)

  // Track when step starts for relative timestamp display in log viewer
  useEffect(() => {
    if (isRunning && !stepStartedAt) {
      setStepStartedAt(Date.now())
      setShowLogs(true) // Auto-open logs when running
    } else if (!isRunning) {
      // Keep startedAt for the duration of review, reset on next run
    }
  }, [isRunning])

  // Progress from logs
  const progressEvents = logs.filter((e) => e.type === 'progress')
  const latestProgress = progressEvents.length > 0
    ? (progressEvents[progressEvents.length - 1].data as { percent?: number })?.percent ?? 0
    : 0
  const progressPct = step.progressPct ?? latestProgress

  // ETA from latest event
  const latestEta = logs.length > 0 ? logs[logs.length - 1]?.etaMs : undefined
  const elapsedMs = step.elapsedMs ?? (isRunning && stepStartedAt ? Date.now() - stepStartedAt : undefined)

  // Latest meaningful log message (not progress noise)
  const lastMeaningfulLog = [...logs].reverse().find((e) =>
    e.type !== 'progress' && e.message && e.message.length > 0
  )

  // API call count from this session
  const apiCallCount = logs.filter((e) => e.type === 'api_call').length
  const errorCount = logs.filter((e) => e.type === 'error' || e.level === 'error').length

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: isRunning
          ? 'rgba(96,165,250,0.35)'
          : status === 'completed' ? 'rgba(52,211,153,0.20)'
          : status === 'failed' ? 'rgba(248,113,113,0.25)'
          : 'var(--border)',
        boxShadow: isRunning ? '0 0 0 1px rgba(96,165,250,0.12)' : undefined,
      }}
    >
      {/* ── Header row ── */}
      <div className="flex items-start gap-3 p-3.5">
        {/* Status dot */}
        <div className="mt-1.5 shrink-0">
          <StatusDot status={status} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {step.displayName}
            </span>
            {categoryBadge(step.category)}
            {step.estimatedCostUsd > 0 && (
              <span className="text-2xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59b23' }}>
                ~${step.estimatedCostUsd.toFixed(2)}
              </span>
            )}
            {step.canRunAlone && (
              <span className="text-2xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399' }}>
                standalone ✓
              </span>
            )}
          </div>

          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {step.description}
          </p>

          {/* Writes / reads chips */}
          {(step.writes?.length > 0) && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>writes:</span>
              {step.writes.map((w) => (
                <span key={w} className="text-2xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--bg-surface)', color: '#a78bfa' }}>
                  {w}
                </span>
              ))}
            </div>
          )}

          {/* Last run info */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-2xs" style={{ color: lastRunColor }}>{lastRunText}</span>
            {step.dependsOn.length > 0 && (
              <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                needs: {step.dependsOn.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isRunning ? (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ border: '1px solid rgba(248,113,113,0.40)', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}
            >
              Cancel
            </button>
          ) : (
            <>
              {canResume && (
                <button
                  onClick={() => onResume(lastRun!.id!)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ border: '1px solid rgba(251,191,36,0.40)', color: '#fbbf24', background: 'rgba(251,191,36,0.08)' }}
                >
                  Resume
                </button>
              )}
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="px-2 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  background: showOptions ? 'var(--bg-hover)' : 'transparent',
                }}
                title="Run options"
              >
                ⚙
              </button>
              <button
                onClick={() => onRun({ scope: selectedScope })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(124,106,247,0.30)',
                }}
              >
                ▶ Run
              </button>
            </>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-2 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              border: `1px solid ${showLogs ? 'rgba(124,106,247,0.40)' : 'var(--border)'}`,
              color: showLogs ? 'var(--accent-light)' : 'var(--text-muted)',
              background: showLogs ? 'rgba(124,106,247,0.08)' : 'transparent',
            }}
          >
            Logs{logs.length > 0 ? ` (${logs.length})` : ''}
            {errorCount > 0 && <span className="ml-1" style={{ color: '#f87171' }}>⚠{errorCount}</span>}
          </button>
        </div>
      </div>

      {/* ── Run options panel ── */}
      {showOptions && !isRunning && (
        <div
          className="px-4 pb-3 pt-0 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3 pt-3 flex-wrap">
            {/* Scope selector */}
            {step.scopeLimits && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scope:</span>
                {(['quick', 'standard', 'full'] as Array<'quick' | 'standard' | 'full'>).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedScope(s)}
                    className="px-2 py-1 rounded text-xs font-medium transition-colors capitalize"
                    style={{
                      background: selectedScope === s ? 'rgba(124,106,247,0.20)' : 'var(--bg-surface)',
                      border: `1px solid ${selectedScope === s ? 'rgba(124,106,247,0.40)' : 'var(--border)'}`,
                      color: selectedScope === s ? 'var(--accent-light)' : 'var(--text-muted)',
                    }}
                  >
                    {s}
                    {step.scopeLimits && (
                      <span className="ml-1 opacity-60">
                        ({step.scopeLimits[s]})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1" />

            {/* Dry run */}
            <button
              onClick={() => { onRun({ dryRun: true }); setShowOptions(false) }}
              className="px-2.5 py-1 rounded text-xs transition-colors"
              style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
            >
              Dry run (preview)
            </button>

            {/* Run with scope */}
            <button
              onClick={() => { onRun({ scope: selectedScope }); setShowOptions(false) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              ▶ Run ({selectedScope})
            </button>
          </div>
        </div>
      )}

      {/* ── Live progress bar ── */}
      {isRunning && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
              {step.itemsDone !== undefined && step.itemsTotal
                ? `${step.itemsDone} / ${step.itemsTotal} items`
                : progressPct > 0 ? `${Math.round(progressPct)}%` : 'Running…'}
            </span>
            <div className="flex items-center gap-2">
              {apiCallCount > 0 && (
                <span className="text-2xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                  {apiCallCount} API calls
                </span>
              )}
              {elapsedMs !== undefined && (
                <span className="text-2xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {formatDuration(elapsedMs)}
                </span>
              )}
              {latestEta !== undefined && latestEta > 0 && (
                <span className="text-2xs tabular-nums" style={{ color: '#60a5fa' }}>
                  ETA {formatDuration(latestEta)}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(progressPct, 3)}%`,
                background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
                boxShadow: '0 0 8px rgba(96,165,250,0.5)',
              }}
            />
          </div>

          {/* Last log message */}
          {lastMeaningfulLog && (
            <div
              className="mt-1 text-2xs truncate"
              style={{ color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}
            >
              › {lastMeaningfulLog.message}
            </div>
          )}
        </div>
      )}

      {/* ── Log viewer ── */}
      {showLogs && (
        <StepLogViewer
          logs={logs}
          stepName={step.stepName}
          startedAt={stepStartedAt}
          maxHeight={280}
        />
      )}
    </div>
  )
}
