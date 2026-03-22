import type Database from 'better-sqlite3'
import type { SignalResult } from './artist-similarity.js'

// "Collector overlap" = sharing mixes with tracks from seed artists
// Artists who appear in the same mixes as seed artists get a score boost

export function computeCollectorOverlap(db: Database.Database, trackId: number): SignalResult | null {
  const overlap = (db.prepare(`
    SELECT COUNT(DISTINCT mt1.mix_id) as shared_mixes
    FROM mix_tracks mt1
    JOIN mix_tracks mt2 ON mt2.mix_id = mt1.mix_id
    JOIN tracks seed_t ON seed_t.id = mt2.track_id AND seed_t.is_seed = 1
    WHERE mt1.track_id = ?
  `).get(trackId) as { shared_mixes: number }).shared_mixes

  if (overlap === 0) return null

  const raw = Math.min(overlap / 5, 1.0)  // Max at 5 shared mixes

  return {
    raw,
    normalized: raw,
    evidence: { sharedMixesWithSeeds: overlap },
  }
}
