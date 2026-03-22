import React, { useEffect, useState } from 'react'

interface Props {
  message: string
  onDismiss?: () => void
  duration?: number
}

export default function ErrorToast({ message, onDismiss, duration = 5000 }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onDismiss])

  if (!visible) return null

  return (
    <div
      className="fixed bottom-24 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-lg shadow-xl max-w-sm"
      style={{
        background: '#1e1e26',
        border: '1px solid rgba(248,113,113,0.4)',
        color: '#f87171',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="text-sm flex-1">{message}</span>
      <button
        onClick={() => { setVisible(false); onDismiss?.() }}
        className="text-text-muted hover:text-text-primary transition-colors shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
