import React from 'react'
import { Link } from 'react-router-dom'

interface Props {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  actionLabel?: string
  actionTo?: string
}

function DefaultIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text-muted)' }}
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

export default function EmptyState({ icon, title, description, action, actionLabel, actionTo }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="mb-6 opacity-60">
        {icon ?? <DefaultIcon />}
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary text-sm max-w-xs leading-relaxed mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {action.label}
        </button>
      )}
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
