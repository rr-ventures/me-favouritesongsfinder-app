import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  seedArtistCount: number
  savedKeyCount: number
  onBack: () => void
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9,12 12,15 16,9" />
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  )
}

export default function WizardStep4Done({ seedArtistCount, savedKeyCount, onBack }: Props) {
  const navigate = useNavigate()
  const [launching, setLaunching] = useState(false)

  async function handleStartDiscovering() {
    setLaunching(true)
    // Trigger the first pipeline run in background (fire and forget)
    window.electron.ipc.invoke('pipeline:runAll', { steps: ['lastfm-artist-expansion', 'lastfm-track-discovery'] })
      .catch(() => {})
    // Navigate to discover
    navigate('/discover', { replace: true })
  }

  async function handleGoToPipeline() {
    navigate('/pipeline', { replace: true })
  }

  const summaryItems = [
    { label: 'Seed artists added', value: seedArtistCount, icon: '🎤' },
    { label: 'API keys configured', value: savedKeyCount, icon: '🔑' },
  ]

  return (
    <div className="flex flex-col items-center text-center px-8 py-12 max-w-lg mx-auto animate-fade-in">
      {/* Success icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
        style={{
          background: 'rgba(30,215,96,0.12)',
          border: '2px solid rgba(30,215,96,0.30)',
          boxShadow: '0 0 40px rgba(30,215,96,0.15)',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2" strokeLinecap="round">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </div>

      <h2
        className="font-black mb-2 leading-none"
        style={{ fontSize: 32, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}
      >
        You're all set!
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        SoundScope is ready to discover music for you.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 w-full mb-8">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl p-4 text-left"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* What happens next */}
      <div
        className="w-full text-left rounded-xl p-4 mb-8"
        style={{ background: 'rgba(124,106,247,0.08)', border: '1px solid rgba(124,106,247,0.20)' }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>What happens next?</p>
        <ul className="space-y-2">
          {[
            'A quick pipeline run will start in the background (Last.fm artist expansion + track discovery)',
            'Once tracks are collected, run Score Calculation to rank them by taste match',
            'Head to Discover and start liking / skipping to refine your feed',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold"
                style={{ background: 'rgba(124,106,247,0.20)', color: 'var(--accent-light)' }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleStartDiscovering}
          disabled={launching}
          className="w-full py-4 rounded-full font-bold text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-70"
          style={{
            background: 'white',
            color: '#000',
            boxShadow: '0 4px 24px rgba(255,255,255,0.15)',
            letterSpacing: '-0.01em',
          }}
        >
          {launching ? 'Starting…' : 'Start Discovering →'}
        </button>

        <button
          onClick={handleGoToPipeline}
          className="w-full py-3 rounded-full font-semibold text-sm transition-all hover:bg-bg-hover flex items-center justify-center gap-2"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <PipelineIcon />
          Go to Pipeline (advanced)
        </button>
      </div>

      <button
        onClick={onBack}
        className="mt-4 text-xs transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Back
      </button>
    </div>
  )
}
