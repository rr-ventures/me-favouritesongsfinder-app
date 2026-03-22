import { BrowserWindow } from 'electron'
import type { PipelineStep, PipelineEvent, RunOptions, ResumeState, RunAllOptions } from './types.js'
import { stepRegistry } from './step-registry.js'
import { DependencyGraph } from './dependency-graph.js'
import { CostTracker } from './cost-tracker.js'
import { getDb } from '../db/connection.js'
import * as pipelineRuns from '../db/queries/pipeline-runs.js'
import { logger } from '../utils/logger.js'

interface StepRuntimeState {
  startedAt: number
  processed: number
  total: number | null
  lastProgressPct: number
}

class PipelineOrchestrator {
  private graph = new DependencyGraph()
  private costTracker = new CostTracker()
  private cancelFlags = new Map<string, boolean>()
  private runningSteps = new Set<string>()
  private runtimeState = new Map<string, StepRuntimeState>()

  initialize() {
    this.graph.register(stepRegistry.getAll())
  }

  async runStep(stepName: string, options: RunOptions = {}): Promise<void> {
    const step = stepRegistry.get(stepName)
    if (!step) throw new Error(`Unknown step: ${stepName}`)

    if (this.runningSteps.has(stepName)) {
      logger.warn(`Step ${stepName} is already running`)
      return
    }

    this.runningSteps.add(stepName)
    this.cancelFlags.set(stepName, false)

    const startedAt = Date.now()
    const runtime: StepRuntimeState = { startedAt, processed: 0, total: null, lastProgressPct: 0 }
    this.runtimeState.set(stepName, runtime)

    const db = getDb()
    const runRecord = pipelineRuns.recordRunStart(db, stepName, options)
    const runId = runRecord.id

    const enrich = (event: PipelineEvent): PipelineEvent & { stepName: string } => {
      const elapsedMs = Date.now() - startedAt

      // Compute ETA based on progress percent
      let etaMs: number | undefined
      if (event.type === 'progress' && event.data) {
        const pct = (event.data as { percent?: number }).percent ?? 0
        if (pct > 2) {
          etaMs = Math.round((elapsedMs / pct) * (100 - pct))
        }
        runtime.lastProgressPct = pct
      } else if (runtime.lastProgressPct > 2) {
        const pct = runtime.lastProgressPct
        etaMs = Math.round((elapsedMs / pct) * (100 - pct))
      }

      // Track item counts from progress events
      if (event.type === 'progress' && event.data) {
        const d = event.data as { done?: number; total?: number; itemsDone?: number; itemsTotal?: number }
        if (d.done !== undefined) runtime.processed = d.done
        if (d.total !== undefined) runtime.total = d.total
        if (d.itemsDone !== undefined) runtime.processed = d.itemsDone
        if (d.itemsTotal !== undefined) runtime.total = d.itemsTotal
      }
      if (event.type === 'item_processed') runtime.processed++

      return {
        ...event,
        stepName,
        elapsedMs,
        etaMs,
        itemsDone: runtime.processed,
        itemsTotal: runtime.total ?? undefined,
      }
    }

    const emit = (event: PipelineEvent) => {
      this.broadcast(enrich(event))
    }

    try {
      emit({
        type: 'log',
        level: 'info',
        timestamp: new Date(),
        message: `▶ Starting ${step.displayName}${options.dryRun ? ' [DRY RUN]' : ''}${options.scope ? ` [${options.scope.toUpperCase()}]` : ''}`,
      })

      let processed = 0, failed = 0, skipped = 0

      for await (const event of step.run({ ...options, runId })) {
        if (this.cancelFlags.get(stepName)) {
          emit({ type: 'log', level: 'warn', timestamp: new Date(), message: '⏹ Cancelled by user' })
          pipelineRuns.completeRun(db, runId, 'cancelled')
          return
        }

        emit(event)

        if (event.type === 'item_processed') processed++
        if (event.type === 'error') failed++
        if (event.data && typeof event.data === 'object' && 'skipped' in event.data) skipped++
        if (event.type === 'cost_update' && event.data) {
          const { stepName: sn, model, inputTokens, outputTokens } = event.data as {
            stepName: string; model: string; inputTokens: number; outputTokens: number
          }
          this.costTracker.track(sn ?? stepName, model, inputTokens, outputTokens)

          // Broadcast updated total cost
          const totalUsd = this.costTracker.getTotalUsd()
          this.broadcast({
            type: 'cost_update',
            timestamp: new Date(),
            message: `Total cost so far: ${CostTracker.formatUsd(totalUsd)}`,
            stepName: '_orchestrator',
            elapsedMs: Date.now() - startedAt,
            data: { totalUsd },
          })
        }

        pipelineRuns.updateRunProgress(db, runId, processed, null, failed, skipped)
      }

      const elapsedMs = Date.now() - startedAt
      const costUsd = this.costTracker.getStepUsd(stepName)
      pipelineRuns.completeRun(db, runId, failed > 0 && processed > 0 ? 'partial' : 'completed', undefined, costUsd)

      emit({
        type: 'complete',
        level: 'info',
        timestamp: new Date(),
        message: `✓ ${step.displayName} complete — ${processed} items processed, ${failed} errors, ${formatMs(elapsedMs)}`,
        data: { processed, failed, skipped, costUsd, elapsedMs },
        elapsedMs,
      })
    } catch (err) {
      const elapsedMs = Date.now() - startedAt
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Step ${stepName} failed`, err)
      pipelineRuns.completeRun(db, runId, 'failed', message)
      emit({ type: 'error', level: 'error', timestamp: new Date(), message: `✗ ${message}`, elapsedMs })
    } finally {
      this.runningSteps.delete(stepName)
      this.cancelFlags.delete(stepName)
      this.runtimeState.delete(stepName)
    }
  }

  async resumeStep(stepName: string, runId: number, options: RunOptions = {}): Promise<void> {
    const step = stepRegistry.get(stepName)
    if (!step) throw new Error(`Unknown step: ${stepName}`)

    const db = getDb()
    const resumeState = pipelineRuns.getResumeState(db, runId) as ResumeState | null
    if (!resumeState) {
      return this.runStep(stepName, options)
    }

    this.runningSteps.add(stepName)
    this.cancelFlags.set(stepName, false)
    const startedAt = Date.now()

    const emit = (event: PipelineEvent) => {
      this.broadcast({ ...event, stepName, elapsedMs: Date.now() - startedAt })
    }

    try {
      emit({ type: 'log', level: 'info', timestamp: new Date(), message: `↩ Resuming ${step.displayName}` })

      for await (const event of step.resume(resumeState, { ...options, runId })) {
        if (this.cancelFlags.get(stepName)) {
          emit({ type: 'log', level: 'warn', timestamp: new Date(), message: '⏹ Cancelled' })
          pipelineRuns.completeRun(db, runId, 'cancelled')
          return
        }
        emit(event)
      }

      pipelineRuns.completeRun(db, runId, 'completed')
      emit({
        type: 'complete',
        level: 'info',
        timestamp: new Date(),
        message: `✓ ${step.displayName} resumed & complete`,
        elapsedMs: Date.now() - startedAt,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pipelineRuns.completeRun(db, runId, 'failed', message)
      emit({ type: 'error', level: 'error', timestamp: new Date(), message: `✗ ${message}` })
    } finally {
      this.runningSteps.delete(stepName)
      this.cancelFlags.delete(stepName)
    }
  }

  cancelStep(stepName: string): void {
    this.cancelFlags.set(stepName, true)
  }

  async runAll(options: RunAllOptions = {}): Promise<void> {
    const levels = this.graph.getExecutionOrder(options.stepNames)
    const totalSteps = levels.flat().length
    let completedSteps = 0

    const orchestratorEmit = (event: Omit<PipelineEvent, 'timestamp'>) => {
      this.broadcast({ ...event, timestamp: new Date(), stepName: '_orchestrator' } as PipelineEvent & { stepName: string })
    }

    orchestratorEmit({
      type: 'log',
      level: 'info',
      message: `▶▶ Run All starting — ${totalSteps} steps in ${levels.length} phases${options.scope ? ` [${options.scope.toUpperCase()} scope]` : ''}`,
    })

    this.costTracker.reset()
    const runAllStart = Date.now()

    for (const levelSteps of levels) {
      for (const stepName of levelSteps) {
        if (this.cancelFlags.get('_all')) {
          orchestratorEmit({ type: 'log', level: 'warn', message: '⏹ Run All cancelled by user' })
          return
        }

        completedSteps++
        orchestratorEmit({
          type: 'progress',
          message: `Phase ${completedSteps}/${totalSteps}: running ${stepName}`,
          data: { percent: Math.round(((completedSteps - 1) / totalSteps) * 100) },
        })

        await this.runStep(stepName, options)
      }
    }

    const totalCost = this.costTracker.getTotalUsd()
    const elapsed = Date.now() - runAllStart
    orchestratorEmit({
      type: 'complete',
      level: 'info',
      message: `✓✓ Run All complete — ${totalSteps} steps, ${formatMs(elapsed)}, total cost: ${CostTracker.formatUsd(totalCost)}`,
      data: { totalCostUsd: totalCost, elapsedMs: elapsed, stepsCompleted: totalSteps },
    })
  }

  cancelAll(): void {
    this.cancelFlags.set('_all', true)
    for (const stepName of this.runningSteps) {
      this.cancelFlags.set(stepName, true)
    }
  }

  getRunningSteps(): string[] {
    return [...this.runningSteps]
  }

  getRuntimeState(stepName: string): StepRuntimeState | undefined {
    return this.runtimeState.get(stepName)
  }

  getCostTracker(): CostTracker {
    return this.costTracker
  }

  private broadcast(event: PipelineEvent & { stepName?: string }) {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('pipeline:event', event)
      }
    }
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

export const orchestrator = new PipelineOrchestrator()
