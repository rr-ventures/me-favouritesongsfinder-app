import type Database from 'better-sqlite3'
import type { SignalResult } from './artist-similarity.js'

// Source agreement = how many independent sources "agree" on this track

export function computeSourceAgreement(db: Database.Database, trackId: number): SignalResult | null {
  // Count distinct source types in tags
  const tagSources = db.prepare(`
    SELECT DISTINCT source FROM tags
    WHERE entity_type = 'track' AND entity_id = ?
    UNION
    SELECT DISTINCT t.source FROM tags t
    JOIN tracks tr ON tr.artist_id = t.entity_id
    WHERE t.entity_type = 'artist' AND tr.id = ?
  `).all(trackId, trackId) as Array<{ source: string }>

  // Count distinct mix source types
  const mixSources = db.prepare(`
    SELECT DISTINCT ms.source_type FROM mix_tracks mt
    JOIN mix_sources ms ON ms.id = mt.mix_id
    WHERE mt.track_id = ?
  `).all(trackId) as Array<{ source_type: string }>

  const totalSources = new Set([
    ...tagSources.map((s) => s.source),
    ...mixSources.map((s) => s.source_type),
  ]).size

  if (totalSources < 2) return null

  // Score: 2 sources = 0.5, 3 = 0.7, 4 = 0.85, 5+ = 1.0
  const raw = Math.min(0.35 + (totalSources - 1) * 0.17, 1.0)

  return {
    raw,
    normalized: raw,
    evidence: {
      tagSources: tagSources.map((s) => s.source),
      mixSources: mixSources.map((s) => s.source_type),
      totalSources,
    },
  }
}
