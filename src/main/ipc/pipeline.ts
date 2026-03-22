import { ipcMain } from 'electron'
import { orchestrator } from '../lib/pipeline/orchestrator.js'
import { stepRegistry } from '../lib/pipeline/step-registry.js'
import { getDb } from '../lib/db/connection.js'
import * as pipelineRuns from '../lib/db/queries/pipeline-runs.js'
import type { RunOptions } from '../lib/pipeline/types.js'
import { RUN_PRESETS } from '../lib/pipeline/types.js'

export function registerPipelineHandlers() {
  // Get status of all steps — enriched with scope limits and writes/reads
  ipcMain.handle('pipeline:getStatus', async () => {
    const db = getDb()
    const steps = stepRegistry.getAll()
    const running = orchestrator.getRunningSteps()

    return steps.map((step) => {
      const lastRun = pipelineRuns.getLastRun(db, step.name)
      const isRunning = running.includes(step.name)
      const runtime = orchestrator.getRuntimeState(step.name)

      return {
        stepName: step.name,
        displayName: step.displayName,
        category: step.category,
        description: step.description,
        dependsOn: step.dependsOn,
        estimatedCostUsd: step.estimatedCostUsd,
        writes: step.writes ?? [],
        reads: step.reads ?? [],
        canRunAlone: step.canRunAlone ?? false,
        scopeLimits: step.scopeLimits,
        status: isRunning ? 'running' : (lastRun?.status ?? 'idle'),
        lastRun,
        isRunning,
        includeInRunAll: true,
        // Live runtime info
        elapsedMs: runtime ? Date.now() - runtime.startedAt : undefined,
        itemsDone: runtime?.processed,
        itemsTotal: runtime?.total ?? undefined,
        progressPct: runtime && runtime.total ? Math.round((runtime.processed / runtime.total) * 100) : undefined,
      }
    })
  })

  // Get run presets
  ipcMain.handle('pipeline:getPresets', async () => {
    return RUN_PRESETS
  })

  // Get DB data counts (for UI to show what's available)
  ipcMain.handle('pipeline:getDataCounts', async () => {
    const db = getDb()
    try {
      return {
        artists: (db.prepare('SELECT COUNT(*) as c FROM artists').get() as { c: number }).c,
        tracks: (db.prepare('SELECT COUNT(*) as c FROM tracks').get() as { c: number }).c,
        tags: (db.prepare('SELECT COUNT(*) as c FROM tags').get() as { c: number }).c,
        mixSources: (db.prepare('SELECT COUNT(*) as c FROM mix_sources').get() as { c: number }).c,
        seeds: (db.prepare("SELECT COUNT(*) as c FROM seed_inputs WHERE type = 'artist'").get() as { c: number }).c,
        scoredTracks: (db.prepare('SELECT COUNT(*) as c FROM composite_scores').get() as { c: number }).c,
        pipelineRuns: (db.prepare('SELECT COUNT(*) as c FROM pipeline_runs').get() as { c: number }).c,
      }
    } catch {
      return { artists: 0, tracks: 0, tags: 0, mixSources: 0, seeds: 0, scoredTracks: 0, pipelineRuns: 0 }
    }
  })

  // Run a single step
  ipcMain.handle('pipeline:run', async (_event, stepName: string, options: RunOptions = {}) => {
    orchestrator.runStep(stepName, options).catch((e) => {
      console.error(`pipeline:run error for ${stepName}:`, e)
    })
    return { success: true }
  })

  // Cancel a step
  ipcMain.handle('pipeline:cancel', async (_event, stepName: string) => {
    orchestrator.cancelStep(stepName)
    return { success: true }
  })

  // Resume a step from a checkpoint
  ipcMain.handle('pipeline:resume', async (_event, stepName: string, runId: number, options: RunOptions = {}) => {
    orchestrator.resumeStep(stepName, runId, options).catch((e) => {
      console.error(`pipeline:resume error for ${stepName}:`, e)
    })
    return { success: true }
  })

  // Run all steps in dependency order (or a preset subset)
  ipcMain.handle('pipeline:runAll', async (_event, options: RunOptions & { stepNames?: string[] } = {}) => {
    const { stepNames, ...runOptions } = options
    orchestrator.runAll({ ...runOptions, stepNames }).catch((e) => {
      console.error('pipeline:runAll error:', e)
    })
    return { success: true }
  })

  // Run a named preset
  ipcMain.handle('pipeline:runPreset', async (_event, presetId: string) => {
    const preset = RUN_PRESETS.find((p) => p.id === presetId)
    if (!preset) throw new Error(`Unknown preset: ${presetId}`)
    orchestrator.runAll({
      scope: preset.scope,
      stepNames: preset.steps,
    }).catch((e) => {
      console.error('pipeline:runPreset error:', e)
    })
    return { success: true, preset }
  })

  // Cancel all running steps
  ipcMain.handle('pipeline:cancelAll', async () => {
    orchestrator.cancelAll()
    return { success: true }
  })

  // Get run history for a step
  ipcMain.handle('pipeline:getHistory', async (_event, stepName: string, limit = 10) => {
    const db = getDb()
    return pipelineRuns.getRunHistory(db, stepName, limit)
  })

  // Get all recent run history across all steps
  ipcMain.handle('pipeline:getAllHistory', async (_event, limit = 50) => {
    const db = getDb()
    try {
      return db.prepare(
        'SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT ?'
      ).all(limit)
    } catch {
      return []
    }
  })

  // Get logs for a specific run
  ipcMain.handle('pipeline:getRunLogs', async (_event, runId: number) => {
    const db = getDb()
    const run = db.prepare('SELECT log_json FROM pipeline_runs WHERE id = ?').get(runId) as { log_json: string | null } | undefined
    if (!run?.log_json) return []
    try { return JSON.parse(run.log_json) } catch { return [] }
  })

  // Get cost summary
  ipcMain.handle('pipeline:getCost', async () => {
    const tracker = orchestrator.getCostTracker()
    return {
      totalUsd: tracker.getTotalUsd(),
      entries: tracker.getEntries(),
    }
  })
}
