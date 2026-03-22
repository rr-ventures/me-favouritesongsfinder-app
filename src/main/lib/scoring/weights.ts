import type Database from 'better-sqlite3'
import { getDb } from '../db/connection.js'
import type { SignalType } from '../db/queries/scores.js'

export function getWeights(db: Database.Database): Record<SignalType, number> {
  const rows = db.prepare('SELECT signal_type, weight FROM signal_weights').all() as Array<{ signal_type: string; weight: number }>
  const weights: Record<string, number> = {}
  for (const row of rows) {
    weights[row.signal_type] = row.weight
  }
  return weights as Record<SignalType, number>
}

export function updateWeight(db: Database.Database, signalType: SignalType, weight: number): void {
  db.prepare('UPDATE signal_weights SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE signal_type = ?').run(weight, signalType)
}

// Adjust weights based on user feedback (positive feedback boosts weights that contributed to that score)
export function learnFromFeedback(db: Database.Database, trackId: number, action: 'like' | 'dislike' | 'skip'): void {
  const scores = db.prepare('SELECT signal_type, normalized_score FROM signal_scores WHERE track_id = ?').all(trackId) as Array<{ signal_type: string; normalized_score: number }>
  if (scores.length === 0) return

  const learningRate = 0.01
  const direction = action === 'like' ? 1 : action === 'dislike' ? -1 : -0.3

  for (const score of scores) {
    if (score.normalized_score > 0.3) {  // Only adjust weights that contributed meaningfully
      const currentWeight = (db.prepare('SELECT weight FROM signal_weights WHERE signal_type = ?').get(score.signal_type) as { weight: number } | undefined)?.weight ?? 0.15
      const delta = learningRate * direction * score.normalized_score
      const newWeight = Math.max(0.05, Math.min(0.5, currentWeight + delta))
      updateWeight(db, score.signal_type as SignalType, newWeight)
    }
  }
}
