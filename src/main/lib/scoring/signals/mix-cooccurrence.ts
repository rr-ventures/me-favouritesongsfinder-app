import type Database from 'better-sqlite3'
import type { SignalResult } from './artist-similarity.js'

export function computeMixCooccurrence(db: Database.Database, trackId: number): SignalResult | null {
  // Count how many mixes this track appears in
  const mixCount = (db.prepare('SELECT COUNT(*) as c FROM mix_tracks WHERE track_id = ?').get(trackId) as { c: number }).c
  if (mixCount === 0) return null

  // Count how many of those mixes also contain seed tracks
  const seedCooccurrences = (db.prepare(`
    SELECT COUNT(DISTINCT mt1.mix_id) as c
    FROM mix_tracks mt1
    JOIN mix_tracks mt2 ON mt2.mix_id = mt1.mix_id AND mt2.track_id != mt1.track_id
    JOIN tracks t ON t.id = mt2.track_id
    WHERE mt1.track_id = ? AND t.is_seed = 1
  `).get(trackId) as { c: number }).c

  const totalMixes = (db.prepare('SELECT COUNT(*) as c FROM mix_sources').get() as { c: number }).c
  if (totalMixes === 0) return null

  // Score = (mix appearances / total mixes) * (1 + seed co-occurrence bonus)
  const raw = Math.min((mixCount / Math.max(totalMixes * 0.1, 1)) * (1 + seedCooccurrences * 0.5), 1.0)

  return {
    raw,
    normalized: Math.min(raw, 1.0),
    evidence: { mixCount, seedCooccurrences, totalMixes },
  }
}
