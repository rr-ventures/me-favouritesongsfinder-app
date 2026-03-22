import React from 'react'

interface Props {
  value: number      // 0-100
  max?: number
  color?: string
  className?: string
  showLabel?: boolean
  height?: number
}

export default function ProgressBar({
  value,
  max = 100,
  color = 'var(--accent)',
  className = '',
  showLabel = false,
  height = 4,
}: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={`flex items-center gap-2 w-full ${className}`}>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height, background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-text-muted tabular-nums" style={{ minWidth: '3ch' }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}
