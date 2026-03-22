import type Database from 'better-sqlite3'

export type SignalType =
  | 'artist_similarity'
  | 'tag_match'
  | 'mix_cooccurrence'
  | 'label_credit'
  | 'collector_overlap'
  | 'community_mention'
  | 'source_agreement'
  | 'audio_similarity'

export interface SignalScore {
  track_id: number
  signal_type: SignalType
  raw_score: number
  normalized_score: number
  evidence_json: string | null
  calculated_at: string
}

export interface CompositeScore {
  track_id: number
  final_score: number
  source_count: number
  recommendation_reason: string | null
  last_calculated: string
}

export function upsertSignalScore(
  db: Database.Database,
  trackId: number,
  signalType: SignalType,
  rawScore: number,
  normalizedScore: number,
  evidence?: unknown,
): void {
  db.prepare(`
    INSERT INTO signal_scores (track_id, signal_type, raw_score, normalized_score, evidence_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(track_id, signal_type) DO UPDATE SET
      raw_score = excluded.raw_score,
      normalized_score = excluded.normalized_score,
      evidence_json = excluded.evidence_json,
      calculated_at = CURRENT_TIMESTAMP
  `).run(
    trackId,
    signalType,
    rawScore,
    normalizedScore,
    evidence != null ? JSON.stringify(evidence) : null,
  )
}

export function getSignalScores(db: Database.Database, trackId: number): SignalScore[] {
  return db.prepare('SELECT * FROM signal_scores WHERE track_id = ?').all(trackId) as SignalScore[]
}

export function upsertCompositeScore(
  db: Database.Database,
  trackId: number,
  finalScore: number,
  sourceCount: number,
  reason?: string,
): void {
  db.prepare(`
    INSERT INTO composite_scores (track_id, final_score, source_count, recommendation_reason)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      final_score = excluded.final_score,
      source_count = excluded.source_count,
      recommendation_reason = COALESCE(excluded.recommendation_reason, recommendation_reason),
      last_calculated = CURRENT_TIMESTAMP
  `).run(trackId, finalScore, sourceCount, reason ?? null)
}

export function getCompositeScore(db: Database.Database, trackId: number): CompositeScore | null {
  return (db.prepare('SELECT * FROM composite_scores WHERE track_id = ?').get(trackId) as CompositeScore | undefined) ?? null
}

export function getTopRanked(db: Database.Database, limit = 50, offset = 0): CompositeScore[] {
  return db.prepare('SELECT * FROM composite_scores ORDER BY final_score DESC LIMIT ? OFFSET ?').all(limit, offset) as CompositeScore[]
}

export function getSignalWeights(db: Database.Database): Record<SignalType, number> {
  const rows = db.prepare('SELECT signal_type, weight FROM signal_weights').all() as { signal_type: string; weight: number }[]
  return Object.fromEntries(rows.map((r) => [r.signal_type, r.weight])) as Record<SignalType, number>
}

export function updateSignalWeight(db: Database.Database, signalType: SignalType, weight: number): void {
  db.prepare('UPDATE signal_weights SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE signal_type = ?').run(weight, signalType)
}
