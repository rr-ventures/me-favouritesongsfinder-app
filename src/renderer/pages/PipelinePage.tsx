import React, { useMemo, useState } from 'react'
import { usePipeline } from '../hooks/usePipeline'
import RunAllPanel from '../components/pipeline/RunAllPanel'
import StepCard from '../components/pipeline/StepCard'
import type { PipelineEvent, RunOptions } from '../../main/lib/pipeline/types'

const CATEGORIES = [
  {
    id: 'api' as const,
    label: 'API Sources',
    description: 'Fetch data from Last.fm, ListenBrainz, MusicBrainz, Discogs, YouTube, Spotify. Free or low-cost.',
    color: '#60a5fa',
  },
  {
    id: 'scraped' as const,
    label: 'Scrape & LLM Extract',
    description: 'Web scraping + AI-powered tracklist and recommendation extraction. Requires LLM keys. Costs ~$0.01–$2 per run.',
    color: '#a78bfa',
  },
  {
    id: 'processing' as const,
    label: 'Processing',
    description: 'Deduplication, tag normalisation, score calculation, health check. Free. Run after every data collection pass.',
    color: '#34d399',
  },
]

// Live global console — shows the last N events across ALL steps
function GlobalConsole({ logs }: { logs: Array<{ stepName: string; event: PipelineEvent }> }) {
  const [open, setOpen] = useState(false)
  const recent = logs.slice(-100).reverse()

  if (logs.length === 0 && !open) return null

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-bg-hover"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: logs.length > 0 ? '#34d399' : 'var(--text-muted)',
              boxShadow: logs.length > 0 ? '0 0 6px #34d399' : undefined,
              animation: logs.length > 0 ? 'pulse 2s ease-in-out infinite' : undefined,
            }}
          />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Global Console
          </span>
          <span className="text-2xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
            {logs.length} events
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▾'}</span>
      </button>

      {open && (
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: 300,
            background: '#050505',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            lineHeight: 1.65,
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
          }}
        >
          {recent.map((entry, i) => {
            const e = entry.event
            const isError = e.type === 'error' || e.level === 'error'
            const isComplete = e.type === 'complete'
            const isApi = e.type === 'api_call'
            const stepColor = entry.stepName === '_orchestrator' ? '#6b7280' : 'var(--text-muted)'
            return (
              <div key={i} className="flex gap-2 items-start">
                <span className="shrink-0 tabular-nums" style={{ color: '#2d2d3a', minWidth: 60 }}>
                  {new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="shrink-0 text-2xs" style={{ color: stepColor, minWidth: 120, opacity: 0.7 }}>
                  {entry.stepName}
                </span>
                <span style={{
                  color: isError ? '#f87171' : isComplete ? '#34d399' : isApi ? '#60a5fa' : '#4a5568',
                  wordBreak: 'break-word',
                  flex: 1,
                }}>
                  {e.message}
                  {e.elapsedMs !== undefined && (
                    <span style={{ opacity: 0.4 }}> [{(e.elapsedMs / 1000).toFixed(1)}s]</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PipelinePage() {
  const {
    steps, logs, loading, runningSteps, totalCostUsd, presets, dataCounts,
    runStep, cancelStep, resumeStep, runAll, runPreset, cancelAll, clearLogs,
  } = usePipeline()

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['api', 'processing']))

  // Group logs by step name
  const logsByStep = useMemo(() => {
    const map: Record<string, PipelineEvent[]> = {}
    for (const entry of logs) {
      if (!map[entry.stepName]) map[entry.stepName] = []
      map[entry.stepName].push(entry.event)
    }
    return map
  }, [logs])

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span className="ml-3 text-sm">Loading pipeline…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Gradient header ── */}
      <div
        className="shrink-0 px-6 pt-8 pb-5"
        style={{
          background: 'linear-gradient(180deg, rgba(96,165,250,0.10) 0%, transparent 100%)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-black leading-none" style={{ fontSize: 32, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Pipeline
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {runningSteps.size > 0
                ? `${runningSteps.size} step${runningSteps.size > 1 ? 's' : ''} running — ${[...runningSteps].join(', ')}`
                : `${steps.length} steps · ${steps.filter((s) => s.status === 'completed').length} completed`
              }
            </p>
          </div>

          {/* Quick status pills */}
          <div className="flex items-center gap-2">
            {runningSteps.size > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}
              >
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                {runningSteps.size} running
              </div>
            )}
            {totalCostUsd > 0 && (
              <div
                className="px-3 py-1.5 rounded-full text-xs font-medium font-mono"
                style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)', color: '#f59b23' }}
              >
                ${totalCostUsd.toFixed(4)} spent
              </div>
            )}
            {logs.length > 0 && (
              <button
                onClick={() => clearLogs()}
                className="px-3 py-1.5 rounded-full text-xs transition-colors"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Clear logs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Run panel */}
        <RunAllPanel
          steps={steps}
          runningSteps={runningSteps}
          totalCostUsd={totalCostUsd}
          presets={presets}
          dataCounts={dataCounts}
          onRunPreset={runPreset}
          onRunAll={runAll}
          onCancelAll={cancelAll}
        />

        {/* Global console */}
        <GlobalConsole logs={logs} />

        {/* Pipeline steps by category */}
        {CATEGORIES.map((cat) => {
          const catSteps = steps.filter((s) => s.category === cat.id)
          if (catSteps.length === 0) return null
          const isExpanded = expandedCategories.has(cat.id)
          const runningInCat = catSteps.filter((s) => runningSteps.has(s.stepName)).length
          const completedInCat = catSteps.filter((s) => s.status === 'completed').length
          const failedInCat = catSteps.filter((s) => s.status === 'failed').length

          return (
            <section key={cat.id}>
              {/* Category header — click to expand/collapse */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-3 mb-2 group"
              >
                <div
                  className="w-1 h-5 rounded-full shrink-0"
                  style={{ background: cat.color }}
                />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {cat.label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {completedInCat}/{catSteps.length} done
                    </span>
                    {runningInCat > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                        {runningInCat} running
                      </span>
                    )}
                    {failedInCat > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                        {failedInCat} failed
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cat.description}</p>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▾'}</span>
              </button>

              {isExpanded && (
                <div className="space-y-2">
                  {catSteps.map((step) => (
                    <StepCard
                      key={step.stepName}
                      step={step}
                      logs={logsByStep[step.stepName] ?? []}
                      isRunning={runningSteps.has(step.stepName)}
                      onRun={(opts) => runStep(step.stepName, opts as RunOptions)}
                      onCancel={() => cancelStep(step.stepName)}
                      onResume={(runId) => resumeStep(step.stepName, runId)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
