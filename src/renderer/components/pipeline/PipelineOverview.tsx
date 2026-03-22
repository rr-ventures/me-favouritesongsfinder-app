import React from 'react'
import StepCard from './StepCard'
import type { PipelineStepInfo } from '../../hooks/usePipeline'
import type { PipelineEvent } from '../../../main/lib/pipeline/types'

import type { RunOptions } from '../../../main/lib/pipeline/types'

interface Props {
  steps: PipelineStepInfo[]
  logs: Record<string, PipelineEvent[]>
  runningSteps: Set<string>
  onRun: (stepName: string, opts?: RunOptions) => void
  onCancel: (stepName: string) => void
  onResume: (stepName: string, runId: number) => void
}

const CATEGORIES = [
  { id: 'api', label: 'API Sources', description: 'Fetch data from public APIs — free or low quota cost' },
  { id: 'scraped', label: 'Scrape & LLM Extract', description: 'Web scraping and AI-powered tracklist extraction' },
  { id: 'processing', label: 'Processing', description: 'Deduplication, scoring, and health checks' },
] as const

export default function PipelineOverview({ steps, logs, runningSteps, onRun, onCancel, onResume }: Props) {
  return (
    <div className="space-y-8">
      {CATEGORIES.map((cat) => {
        const catSteps = steps.filter((s) => s.category === cat.id)
        if (catSteps.length === 0) return null

        return (
          <section key={cat.id}>
            <div className="mb-3">
              <h2 className="font-semibold text-text-primary">{cat.label}</h2>
              <p className="text-xs text-text-muted mt-0.5">{cat.description}</p>
            </div>
            <div className="space-y-2">
              {catSteps.map((step) => (
                <StepCard
                  key={step.stepName}
                  step={step}
                  logs={logs[step.stepName] ?? []}
                  isRunning={runningSteps.has(step.stepName)}
                  onRun={(opts) => onRun(step.stepName, opts)}
                  onCancel={() => onCancel(step.stepName)}
                  onResume={(runId) => onResume(step.stepName, runId)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
