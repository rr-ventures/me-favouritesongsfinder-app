import type { PipelineStep, PipelineEvent, RunOptions, ResumeState, PipelineRunRecord, RunScope } from './types.js'
import { getDb } from '../db/connection.js'
import * as pipelineRuns from '../db/queries/pipeline-runs.js'
import { logger } from '../utils/logger.js'

export abstract class BaseStep implements PipelineStep {
  abstract name: string
  abstract displayName: string
  abstract category: 'api' | 'scraped' | 'processing'
  abstract description: string
  abstract dependsOn: string[]
  abstract estimatedCostUsd: number

  /** What tables/data this step writes */
  writes?: string[]
  /** What tables/data this step reads (for dependency display) */
  reads?: string[]
  /** Can this step produce useful output even without its dependsOn steps having run? */
  canRunAlone?: boolean = false
  /** Per-scope item limits — used to resolve RunOptions.limit when scope is set */
  scopeLimits?: { quick: number; standard: number; full: number }

  protected cancelled = false

  cancel(): void {
    this.cancelled = true
  }

  getLastRun(): PipelineRunRecord | null {
    try {
      return pipelineRuns.getLastRun(getDb(), this.name)
    } catch {
      return null
    }
  }

  abstract run(options: RunOptions): AsyncGenerator<PipelineEvent>

  async *resume(state: ResumeState, options: RunOptions): AsyncGenerator<PipelineEvent> {
    yield this.log('info', `No resume state — restarting ${this.displayName}`)
    yield* this.run(options)
  }

  /**
   * Resolve the effective item limit given options.
   * Priority: explicit options.limit > scopeLimits[scope] > fallback
   */
  protected resolveLimit(options: RunOptions, fallback: number): number {
    if (options.limit !== undefined) return options.limit
    if (options.scope && this.scopeLimits) {
      const scope = options.scope as RunScope
      if (scope === 'quick') return this.scopeLimits.quick
      if (scope === 'standard') return this.scopeLimits.standard
      if (scope === 'full') return this.scopeLimits.full
    }
    return fallback
  }

  // ── Event builders ─────────────────────────────────────────────────────────

  protected log(level: PipelineEvent['level'], message: string, data?: unknown): PipelineEvent {
    return { type: 'log', level, timestamp: new Date(), message, data }
  }

  protected progress(percent: number, message?: string, extra?: { done?: number; total?: number }): PipelineEvent {
    return {
      type: 'progress',
      timestamp: new Date(),
      message: message ?? `${Math.round(percent)}%`,
      data: { percent, ...extra },
    }
  }

  /** Emit a progress event with item counts — auto-computes percent */
  protected progressItems(done: number, total: number, label?: string): PipelineEvent {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return {
      type: 'progress',
      timestamp: new Date(),
      message: label ? `${label} (${done}/${total})` : `${done}/${total} items`,
      data: { percent: pct, done, total, itemsDone: done, itemsTotal: total },
    }
  }

  protected itemProcessed(message: string, data?: unknown): PipelineEvent {
    return { type: 'item_processed', timestamp: new Date(), message, data }
  }

  /** Log an outgoing API call — shows in the log viewer as an API call event */
  protected apiCall(method: string, url: string, data?: unknown): PipelineEvent {
    // Strip API keys from URLs for display
    const safeUrl = url.replace(/[&?](api_key|key|token|secret|password)=[^&]*/gi, (m, k) => `&${k}=***`)
    return {
      type: 'api_call',
      level: 'debug',
      timestamp: new Date(),
      message: `${method} ${safeUrl}`,
      apiUrl: safeUrl,
      data,
    }
  }

  protected error(message: string, data?: unknown): PipelineEvent {
    return { type: 'error', level: 'error', timestamp: new Date(), message, data }
  }

  protected warning(message: string, data?: unknown): PipelineEvent {
    return { type: 'warning', level: 'warn', timestamp: new Date(), message, data }
  }

  protected complete(message: string, data?: unknown): PipelineEvent {
    return { type: 'complete', level: 'info', timestamp: new Date(), message, data }
  }

  protected costUpdate(model: string, inputTokens: number, outputTokens: number, costUsd: number): PipelineEvent {
    return {
      type: 'cost_update',
      timestamp: new Date(),
      message: `LLM cost: $${costUsd.toFixed(4)} — ${model} (${inputTokens}in / ${outputTokens}out tokens)`,
      data: { stepName: this.name, model, inputTokens, outputTokens, costUsd },
    }
  }

  protected saveCheckpoint(runId: number, state: unknown): void {
    try {
      pipelineRuns.saveCheckpoint(getDb(), runId, state)
    } catch (e) {
      logger.warn('Failed to save checkpoint', e)
    }
  }
}
