import type Database from 'better-sqlite3'

export type FeedbackAction = 'like' | 'skip' | 'dislike' | 'save'
export type SkipReason = 'too_sleepy' | 'too_electronic' | 'too_vocal' | 'wrong_energy' | 'not_vibing'

export interface Feedback {
  id: number
  track_id: number
  action: FeedbackAction
  skip_reason: SkipReason | null
  created_at: string
}

export function recordFeedback(
  db: Database.Database,
  trackId: number,
  action: FeedbackAction,
  skipReason?: SkipReason,
): Feedback {
  const result = db.prepare(`
    INSERT INTO feedback (track_id, action, skip_reason) VALUES (?, ?, ?)
  `).run(trackId, action, skipReason ?? null)

  return db.prepare('SELECT * FROM feedback WHERE id = ?').get(result.lastInsertRowid) as Feedback
}

export function getFeedbackForTrack(db: Database.Database, trackId: number): Feedback[] {
  return db.prepare('SELECT * FROM feedback WHERE track_id = ? ORDER BY created_at DESC').all(trackId) as Feedback[]
}

export function getLikedTrackIds(db: Database.Database): number[] {
  const rows = db.prepare(`
    SELECT DISTINCT track_id FROM feedback
    WHERE action = 'like'
    AND track_id NOT IN (
      SELECT DISTINCT track_id FROM feedback WHERE action = 'dislike'
    )
  `).all() as { track_id: number }[]
  return rows.map((r) => r.track_id)
}

export function getDislikedArtistIds(db: Database.Database): number[] {
  const rows = db.prepare(`
    SELECT DISTINCT t.artist_id
    FROM feedback f
    JOIN tracks t ON t.id = f.track_id
    WHERE f.action = 'dislike' AND t.artist_id IS NOT NULL
    GROUP BY t.artist_id
    HAVING COUNT(*) >= 3
  `).all() as { artist_id: number }[]
  return rows.map((r) => r.artist_id)
}
