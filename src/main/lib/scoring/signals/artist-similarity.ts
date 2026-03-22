import type Database from 'better-sqlite3'

export interface SignalResult {
  raw: number
  normalized: number
  evidence: unknown
}

export function computeArtistSimilarity(db: Database.Database, trackId: number): SignalResult | null {
  const track = db.prepare('SELECT artist_id FROM tracks WHERE id = ?').get(trackId) as { artist_id: number | null } | undefined
  if (!track?.artist_id) return null

  const rows = db.prepare(`
    SELECT s.score, a.name as seed_name
    FROM artist_similarity s
    JOIN artists a ON a.id = s.artist_id_a
    WHERE s.artist_id_b = ? AND a.is_seed = 1
    ORDER BY s.score DESC
    LIMIT 5
  `).all(track.artist_id) as Array<{ score: number; seed_name: string }>

  if (rows.length === 0) return null

  const maxScore = rows[0].score
  const avgScore = rows.reduce((sum, r) => sum + r.score, 0) / rows.length
  const raw = maxScore * 0.7 + avgScore * 0.3

  return {
    raw,
    normalized: Math.min(raw, 1.0),
    evidence: rows.map((r) => ({ seed: r.seed_name, score: r.score })),
  }
}
