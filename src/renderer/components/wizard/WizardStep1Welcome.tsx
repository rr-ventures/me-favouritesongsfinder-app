import React from 'react'

interface Props {
  onNext: () => void
}

export default function WizardStep1Welcome({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-12 max-w-lg mx-auto animate-fade-in">
      {/* Logo */}
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-accent"
        style={{
          background: 'linear-gradient(135deg, #5a4de6 0%, #9b8bf9 100%)',
          boxShadow: '0 8px 40px rgba(124,106,247,0.40)',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      {/* Headline */}
      <h1
        className="font-black mb-3 leading-none"
        style={{ fontSize: 40, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}
      >
        Welcome to<br />
        <span
          style={{
            background: 'linear-gradient(135deg, #9b8bf9, #7c6af7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          SoundScope
        </span>
      </h1>

      <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.6 }}>
        Your personal music discovery engine, powered by real data from the scenes you love.
      </p>

      <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
        Takes about 2 minutes to set up. We'll ask for a few API keys and some artists you love.
      </p>

      {/* Feature bullets */}
      <div className="grid gap-3 w-full mb-10" style={{ maxWidth: 380 }}>
        {[
          { icon: '🎧', title: 'Taste-matched ranking', desc: 'Tracks scored against your actual taste profile' },
          { icon: '🔍', title: 'Deep discovery', desc: 'Last.fm, Bandcamp, Reddit, DJ mixes & more' },
          { icon: '🤖', title: 'AI-powered extraction', desc: 'LLMs parse tracklists and editorial blogs for you' },
        ].map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-3 text-left px-4 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-2xl leading-none shrink-0">{f.icon}</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{f.title}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full max-w-xs py-4 rounded-full font-bold text-base transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'white',
          color: '#000',
          boxShadow: '0 4px 24px rgba(255,255,255,0.15)',
          letterSpacing: '-0.01em',
        }}
      >
        Get started
      </button>

      <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        All data stays local on your machine
      </p>
    </div>
  )
}
