import type Database from 'better-sqlite3'
import type { SignalResult } from './artist-similarity.js'

export function computeLabelCredit(db: Database.Database, trackId: number): SignalResult | null {
  const track = db.prepare('SELECT artist_id FROM tracks WHERE id = ?').get(trackId) as { artist_id: number | null } | undefined
  if (!track?.artist_id) return null

  // Get labels for this artist
  const artistLabels = db.prepare('SELECT label_name_normalized FROM artist_labels WHERE artist_id = ?').all(track.artist_id) as Array<{ label_name_normalized: string }>
  if (artistLabels.length === 0) return null

  // Get labels for seed artists
  const seedLabels = db.prepare(`
    SELECT DISTINCT al.label_name_normalized
    FROM artist_labels al
    JOIN artists a ON a.id = al.artist_id
    WHERE a.is_seed = 1
  `).all() as Array<{ label_name_normalized: string }>

  const seedLabelSet = new Set(seedLabels.map((l) => l.label_name_normalized))
  const sharedLabels = artistLabels.filter((l) => seedLabelSet.has(l.label_name_normalized))

  if (sharedLabels.length === 0) return null

  const raw = Math.min(sharedLabels.length * 0.4, 1.0)

  return {
    raw,
    normalized: raw,
    evidence: { sharedLabels: sharedLabels.map((l) => l.label_name_normalized) },
  }
}
