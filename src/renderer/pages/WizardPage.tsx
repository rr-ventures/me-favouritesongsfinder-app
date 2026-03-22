import React, { useState } from 'react'
import WizardStep1Welcome from '../components/wizard/WizardStep1Welcome'
import WizardStep2ApiKeys from '../components/wizard/WizardStep2ApiKeys'
import WizardStep3Seeds from '../components/wizard/WizardStep3Seeds'
import WizardStep4Done from '../components/wizard/WizardStep4Done'

const STEPS = [
  { id: 1, label: 'Welcome' },
  { id: 2, label: 'API Keys' },
  { id: 3, label: 'Seed Artists' },
  { id: 4, label: 'Done' },
]

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 w-full max-w-sm">
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const done = idx < step
        const active = idx === step
        return (
          <React.Fragment key={idx}>
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all shrink-0"
              style={{
                background: done
                  ? 'var(--status-success)'
                  : active
                  ? 'var(--accent)'
                  : 'var(--bg-surface)',
                color: done || active ? 'white' : 'var(--text-muted)',
                boxShadow: active ? '0 0 16px rgba(124,106,247,0.40)' : 'none',
                border: active ? '2px solid var(--accent-light)' : '1px solid var(--border)',
              }}
            >
              {done ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              ) : (
                idx
              )}
            </div>
            {i < total - 1 && (
              <div
                className="flex-1 h-0.5 rounded-full transition-all"
                style={{ background: done ? 'var(--status-success)' : 'var(--bg-surface)' }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default function WizardPage() {
  const [step, setStep] = useState(1)
  const [seedArtistCount, setSeedArtistCount] = useState(0)
  const [savedKeyCount, setSavedKeyCount] = useState(0)

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length))
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1))
  }

  function handleStep3Next() {
    // Count seeds and saved keys when moving to Done step
    window.electron.ipc.invoke('db:getSeeds').then((seeds) => {
      setSeedArtistCount((seeds as unknown[]).length)
    }).catch(() => setSeedArtistCount(1))

    window.electron.ipc.invoke('settings:getMockStatus').then((status) => {
      const s = status as { anyMockActive: boolean; mockKeys: string[] }
      const totalKeys = 8 // approximate total configurable keys
      setSavedKeyCount(totalKeys - s.mockKeys.length)
    }).catch(() => setSavedKeyCount(1))

    next()
  }

  return (
    <div
      className="wizard-overlay flex flex-col items-center h-screen overflow-hidden"
    >
      {/* Top bar — logo + step progress */}
      <div className="w-full flex items-center justify-between px-8 py-5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Logo mark */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c6af7, #9b8bf9)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <span className="font-bold text-sm" style={{ color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>SoundScope</span>
        </div>

        {/* Step progress (hidden on step 1) */}
        {step > 1 && step < 4 && (
          <ProgressBar step={step} total={STEPS.length} />
        )}

        {/* Step label */}
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 80, textAlign: 'right' }}>
          {step < 4 ? `Step ${step} of ${STEPS.length}` : ''}
        </span>
      </div>

      {/* Step content — scrollable */}
      <div className="flex-1 w-full overflow-y-auto flex items-start justify-center py-8 px-4">
        <div className="w-full" style={{ maxWidth: step === 1 || step === 4 ? 520 : 720 }}>
          {step === 1 && <WizardStep1Welcome onNext={next} />}
          {step === 2 && <WizardStep2ApiKeys onNext={next} />}
          {step === 3 && <WizardStep3Seeds onNext={handleStep3Next} onBack={back} />}
          {step === 4 && (
            <WizardStep4Done
              seedArtistCount={seedArtistCount}
              savedKeyCount={savedKeyCount}
              onBack={back}
            />
          )}
        </div>
      </div>
    </div>
  )
}
