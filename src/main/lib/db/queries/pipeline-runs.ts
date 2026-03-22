import type Database from 'better-sqlite3'

export type PipelineRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled'

export interface PipelineRun {
  id: number
  step_name: string
  status: PipelineRunStatus
  started_at: string | null
  completed_at: string | null
  items_processed: number
  items_total: number | null
  items_failed: number
  items_skipped: number
  error_message: string | null
  log_json: string | null
  resume_state_json: string | null
  config_json: string | null
  estimated_cost_usd: number
}

export function recordRunStart(db: Database.Database, stepName: string, config?: unknown): PipelineRun {
  const result = db.prepare(`
    INSERT INTO pipeline_runs (step_name, status, started_at, config_json)
    VALUES (?, 'running', CURRENT_TIMESTAMP, ?)
  `).run(stepName, config != null ? JSON.stringify(config) : null)

  return db.prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(result.lastInsertRowid) as PipelineRun
}

export function updateRunProgress(
  db: Database.Database,
  runId: number,
  processed: number,
  total: number | null,
  failed: number,
  skipped: number,
): void {
  db.prepare(`
    UPDATE pipeline_runs SET
      items_processed = ?,
      items_total = ?,
      items_failed = ?,
      items_skipped = ?
    WHERE id = ?
  `).run(processed, total, failed, skipped, runId)
}

export function completeRun(
  db: Database.Database,
  runId: number,
  status: PipelineRunStatus,
  errorMessage?: string,
  costUsd?: number,
): void {
  db.prepare(`
    UPDATE pipeline_runs SET
      status = ?,
      completed_at = CURRENT_TIMESTAMP,
      error_message = ?,
      estimated_cost_usd = COALESCE(?, estimated_cost_usd)
    WHERE id = ?
  `).run(status, errorMessage ?? null, costUsd ?? null, runId)
}

export function saveCheckpoint(db: Database.Database, runId: number, resumeState: unknown): void {
  db.prepare('UPDATE pipeline_runs SET resume_state_json = ? WHERE id = ?').run(
    JSON.stringify(resumeState),
    runId,
  )
}

export function saveRunLogs(db: Database.Database, runId: number, logs: unknown[]): void {
  db.prepare('UPDATE pipeline_runs SET log_json = ? WHERE id = ?').run(
    JSON.stringify(logs),
    runId,
  )
}

export function getLastRun(db: Database.Database, stepName: string): PipelineRun | null {
  return (db.prepare(`
    SELECT * FROM pipeline_runs
    WHERE step_name = ?
    ORDER BY started_at DESC
    LIMIT 1
  `).get(stepName) as PipelineRun | undefined) ?? null
}

export function getRunHistory(db: Database.Database, stepName: string, limit = 10): PipelineRun[] {
  return db.prepare(`
    SELECT * FROM pipeline_runs WHERE step_name = ? ORDER BY started_at DESC LIMIT ?
  `).all(stepName, limit) as PipelineRun[]
}

export function getResumeState(db: Database.Database, runId: number): unknown | null {
  const run = db.prepare('SELECT resume_state_json FROM pipeline_runs WHERE id = ?').get(runId) as { resume_state_json: string | null } | undefined
  if (!run?.resume_state_json) return null
  try {
    return JSON.parse(run.resume_state_json)
  } catch {
    return null
  }
}
