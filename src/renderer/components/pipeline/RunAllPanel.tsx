import React, { useState, useEffect } from 'react'
import type { PipelineStepInfo, DataCounts } from '../../hooks/usePipeline'
import type { RunPreset, RunScope, RunOptions } from '../../../main/lib/pipeline/types'

interface Props {
  steps: PipelineStepInfo[]
  runningSteps: Set<string>
  totalCostUsd: number
  presets: RunPreset[]
  dataCounts: DataCounts
  onRunPreset: (presetId: string) => Promise<void>
  onRunAll: (options: RunOptions, stepNames?: string[]) => Promise<void>
  onCancelAll: () => Promise<void>
}

function DataBadge({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      className="flex flex-col items-center px-3 py-1.5 rounded-lg"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <span className="text-sm font-bold tabular-nums" style={{ color: color ?? 'var(--text-primary)' }}>
        {value.toLocaleString()}
      </span>
      <span className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

export default function RunAllPanel({
  steps, runningSteps, totalCostUsd, presets, dataCounts,
  onRunPreset, onRunAll, onCancelAll,
}: Props) {
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customSteps, setCustomSteps] = useState<Set<string>>(new Set(steps.map((s) => s.stepName)))
  const [running, setRunning] = useState(false)

  const anyRunning = runningSteps.size > 0
  const hasData = dataCounts.tracks > 0 || dataCounts.artists > 0

  useEffect(() => {
    setCustomSteps(new Set(steps.map((s) => s.stepName)))
  }, [steps.length])

  async function handleRunPreset(presetId: string) {
    setRunning(true)
    setActivePreset(presetId)
    try {
      await onRunPreset(presetId)
    } finally {
      setRunning(false)
    }
  }

  async function handleRunCustom() {
    setRunning(true)
    setActivePreset('custom')
    try {
      await onRunAll({}, [...customSteps])
    } finally {
      setRunning(false)
    }
  }

  function toggleStep(name: string) {
    setCustomSteps((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div
      className="rounded-xl border"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      {/* ── Data status bar ── */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.015)' }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              Data Status
            </span>
            {!hasData && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--status-warning)' }}>
                No data yet — run the pipeline to start collecting music
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DataBadge label="Artists" value={dataCounts.artists} color={dataCounts.artists > 0 ? 'var(--accent-light)' : undefined} />
            <DataBadge label="Tracks" value={dataCounts.tracks} color={dataCounts.tracks > 0 ? '#34d399' : undefined} />
            <DataBadge label="Tags" value={dataCounts.tags} />
            <DataBadge label="Mixes" value={dataCounts.mixSources} />
            <DataBadge label="Scored" value={dataCounts.scoredTracks} color={dataCounts.scoredTracks > 0 ? '#fbbf24' : undefined} />
          </div>
        </div>

        {/* Cost display */}
        {totalCostUsd > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>Session LLM spend:</span>
            <span className="text-2xs font-mono font-semibold" style={{ color: '#f59b23' }}>${totalCostUsd.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* ── Presets ── */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Run Pipeline</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Choose a preset or configure a custom run below
            </p>
          </div>

          {anyRunning ? (
            <button
              onClick={onCancelAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ border: '1px solid rgba(248,113,113,0.40)', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}
            >
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
              Cancel All ({runningSteps.size} running)
            </button>
          ) : null}
        </div>

        {/* Preset cards */}
        {presets.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {presets.map((preset) => {
              const isActive = anyRunning && activePreset === preset.id
              const isFree = preset.free
              return (
                <button
                  key={preset.id}
                  onClick={() => !anyRunning && handleRunPreset(preset.id)}
                  disabled={anyRunning}
                  className="text-left p-3 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isActive ? 'rgba(96,165,250,0.08)' : 'var(--bg-surface)',
                    borderColor: isActive ? 'rgba(96,165,250,0.40)' : 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    if (!anyRunning) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,106,247,0.40)'
                  }}
                  onMouseLeave={(e) => {
                    if (!anyRunning) (e.currentTarget as HTMLElement).style.borderColor = isActive ? 'rgba(96,165,250,0.40)' : 'var(--border)'
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold" style={{ color: isActive ? '#60a5fa' : 'var(--text-primary)' }}>
                      {isActive && '⏳ '}{preset.label}
                    </span>
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        background: isFree ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)',
                        color: isFree ? '#34d399' : '#f59b23',
                      }}
                    >
                      {isFree ? 'Free' : `~$${presets.find((p) => p.id === preset.id)?.free ? '0' : '0.50+'}`}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {preset.description}
                  </p>
                  {preset.steps && (
                    <p className="text-2xs mt-1.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                      {preset.steps.length} steps
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Custom run toggle */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-2 text-xs transition-colors w-full px-3 py-2 rounded-lg"
          style={{
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            background: showCustom ? 'var(--bg-hover)' : 'transparent',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          Custom run — choose individual steps {showCustom ? '▲' : '▾'}
          <span className="ml-auto">{customSteps.size}/{steps.length} selected</span>
        </button>

        {/* Custom step picker */}
        {showCustom && (
          <div className="mt-2 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="p-3 grid grid-cols-1 gap-1 max-h-52 overflow-y-auto">
              {(['api', 'scraped', 'processing'] as const).map((cat) => {
                const catSteps = steps.filter((s) => s.category === cat)
                if (catSteps.length === 0) return null
                const catLabel = { api: 'API Sources', scraped: 'Scrape / LLM', processing: 'Processing' }[cat]
                return (
                  <React.Fragment key={cat}>
                    <div className="text-2xs font-bold uppercase tracking-widest mt-1 mb-0.5 px-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                      {catLabel}
                    </div>
                    {catSteps.map((step) => (
                      <label
                        key={step.stepName}
                        className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-bg-hover transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={customSteps.has(step.stepName)}
                          onChange={() => toggleStep(step.stepName)}
                          className="w-3.5 h-3.5 rounded"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
                          {step.displayName}
                        </span>
                        {step.canRunAlone && (
                          <span className="text-2xs" style={{ color: '#34d399' }} title="Can run standalone">✓</span>
                        )}
                        {step.estimatedCostUsd > 0 && (
                          <span className="text-2xs" style={{ color: '#f59b23' }}>${step.estimatedCostUsd.toFixed(2)}</span>
                        )}
                      </label>
                    ))}
                  </React.Fragment>
                )
              })}
            </div>
            <div
              className="flex items-center gap-3 px-3 py-2 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                onClick={() => setCustomSteps(new Set(steps.map((s) => s.stepName)))}
                className="text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Select all
              </button>
              <button
                onClick={() => {
                  const freeSteps = steps.filter((s) => s.estimatedCostUsd === 0).map((s) => s.stepName)
                  setCustomSteps(new Set(freeSteps))
                }}
                className="text-xs transition-colors"
                style={{ color: '#34d399' }}
              >
                Free only
              </button>
              <button
                onClick={() => setCustomSteps(new Set())}
                className="text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear
              </button>
              <div className="flex-1" />
              <button
                onClick={handleRunCustom}
                disabled={anyRunning || customSteps.size === 0}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                ▶ Run {customSteps.size} steps
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
