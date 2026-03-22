import React, { useEffect, useState } from 'react'

interface RunRecord {
  id: number
  step_name: string
  status: string
  started_at: string | null
  completed_at: string | null
  items_processed: number
  items_total: number | null
  items_failed: number
  estimated_cost_usd: number
}

interface Props {
  stepName: string
  getHistory: (stepName: string) => Promise<unknown>
}

function statusStyle(status: string): { color: string; bg: string } {
  const map: Record<string, { color: string; bg: string }> = {
    completed: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
    failed: { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
    partial: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    cancelled: { color: '#9898a8', bg: 'rgba(152,152,168,0.1)' },
    running: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    pending: { color: '#5a5a6a', bg: 'rgba(90,90,106,0.1)' },
  }
  return map[status] ?? { color: '#9898a8', bg: 'transparent' }
}

function formatDate(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

export default function StepHistory({ stepName, getHistory }: Props) {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHistory(stepName).then((data) => {
      setRuns(data as RunRecord[])
      setLoading(false)
    })
  }, [stepName, getHistory])

  if (loading) return <div className="text-xs text-text-muted p-4">Loading history...</div>
  if (runs.length === 0) return <div className="text-xs text-text-muted p-4 italic">No run history.</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {['Status', 'Started', 'Duration', 'Processed', 'Failed', 'Cost'].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-text-muted font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const { color, bg } = statusStyle(run.status)
            return (
              <tr key={run.id} className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors">
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ color, background: bg }}>
                    {run.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary">{formatDate(run.started_at)}</td>
                <td className="px-3 py-2 text-text-secondary">{duration(run.started_at, run.completed_at)}</td>
                <td className="px-3 py-2 text-text-primary">
                  {run.items_processed}{run.items_total ? `/${run.items_total}` : ''}
                </td>
                <td className="px-3 py-2" style={{ color: run.items_failed > 0 ? '#f87171' : '#5a5a6a' }}>
                  {run.items_failed}
                </td>
                <td className="px-3 py-2 text-text-muted">
                  {run.estimated_cost_usd > 0 ? `$${run.estimated_cost_usd.toFixed(3)}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
