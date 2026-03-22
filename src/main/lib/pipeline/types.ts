export interface PipelineStep {
  name: string
  displayName: string
  category: 'api' | 'scraped' | 'processing'
  description: string
  dependsOn: string[]
  estimatedCostUsd: number
  /** What this step writes to — shown in UI */
  writes?: string[]
  /** What data it reads from / requires to be useful */
  reads?: string[]
  /** Whether this step can run independently without its dependsOn data (degrades gracefully) */
  canRunAlone?: boolean
  /** Scope limits: how many items to process per scope level */
  scopeLimits?: { quick: number; standard: number; full: number }

  run(options: RunOptions): AsyncGenerator<PipelineEvent>
  resume(state: ResumeState, options: RunOptions): AsyncGenerator<PipelineEvent>
  cancel(): void
  getLastRun(): PipelineRunRecord | null
}

export interface PipelineEvent {
  type: 'log' | 'progress' | 'error' | 'warning' | 'complete' | 'item_processed' | 'cost_update' | 'api_call' | 'timing'
  level?: 'debug' | 'info' | 'warn' | 'error'
  timestamp: Date
  message: string
  data?: unknown
  // Enriched timing/progress fields (added by orchestrator)
  elapsedMs?: number
  etaMs?: number
  itemsTotal?: number
  itemsDone?: number
  /** If this event is an API call, the URL (sans key) */
  apiUrl?: string
}

export type RunScope = 'quick' | 'standard' | 'full' | 'custom'

export interface RunOptions {
  dryRun?: boolean
  limit?: number
  forceRefresh?: boolean
  skipProcessed?: boolean
  runId?: number
  scope?: RunScope
}

export interface ResumeState {
  lastProcessedId?: number
  lastProcessedIndex?: number
  pendingItems?: unknown[]
  customState?: Record<string, unknown>
}

export interface PipelineRunRecord {
  id: number
  step_name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled'
  started_at: string | null
  completed_at: string | null
  items_processed: number
  items_total: number | null
  items_failed: number
  items_skipped: number
  error_message: string | null
  estimated_cost_usd: number
  scope?: RunScope
}

export interface StepStatus {
  stepName: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled'
  progress: number        // 0-100
  currentItem: string | null
  lastRun: PipelineRunRecord | null
  isRunning: boolean
  includeInRunAll: boolean
  elapsedMs?: number
  etaMs?: number
  itemsDone?: number
  itemsTotal?: number
}

export interface RunAllOptions extends RunOptions {
  stepNames?: string[]    // subset to run; defaults to all enabled
}

export type PipelineEventHandler = (event: PipelineEvent & { stepName: string }) => void

/** Preset run configurations shown in the UI */
export interface RunPreset {
  id: string
  label: string
  description: string
  scope: RunScope
  /** Subset of steps to include; undefined = all */
  steps?: string[]
  free: boolean
}

export const RUN_PRESETS: RunPreset[] = [
  {
    id: 'quick',
    label: 'Quick Discovery',
    description: 'Last.fm only — 50 artists, 200 tracks. Free, takes ~2 min. Great for first run.',
    scope: 'quick',
    steps: ['lastfm-artist-expansion', 'lastfm-track-discovery', 'deduplication', 'tag-normalization', 'score-calculation', 'pool-health-check'],
    free: true,
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'API sources + LLM extraction. 200 artists, 500 tracks. Costs ~$0.50 in LLM fees.',
    scope: 'standard',
    steps: [
      'lastfm-artist-expansion', 'lastfm-track-discovery', 'lastfm-track-similarity',
      'musicbrainz-metadata', 'listenbrainz-recs',
      'youtube-tracklist-extract',
      'deduplication', 'tag-normalization', 'score-calculation', 'pool-health-check',
    ],
    free: false,
  },
  {
    id: 'full',
    label: 'Full Pipeline',
    description: 'All sources including Discogs, Spotify, Reddit, Bandcamp, scrapers. ~$2–5 in LLM fees.',
    scope: 'full',
    steps: undefined, // all steps
    free: false,
  },
  {
    id: 'rescore',
    label: 'Re-score Only',
    description: 'Skip data collection — just re-run deduplication, tag normalization, and scoring. Free.',
    scope: 'quick',
    steps: ['deduplication', 'tag-normalization', 'score-calculation', 'pool-health-check'],
    free: true,
  },
]
