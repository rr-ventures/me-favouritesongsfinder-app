import type Database from 'better-sqlite3'
import type { SignalResult } from './artist-similarity.js'

export function computeTagMatch(db: Database.Database, trackId: number): SignalResult | null {
  const track = db.prepare('SELECT artist_id FROM tracks WHERE id = ?').get(trackId) as { artist_id: number | null } | undefined
  if (!track) return null

  // Get taste descriptors
  const descriptors = db.prepare('SELECT descriptor FROM taste_descriptors').all() as Array<{ descriptor: string }>
  if (descriptors.length === 0) return null

  const descriptorSet = new Set(descriptors.map((d) => d.descriptor.toLowerCase()))

  // Get track tags
  const trackTags = db.prepare('SELECT tag_normalized, weight FROM tags WHERE entity_type = "track" AND entity_id = ?').all(trackId) as Array<{ tag_normalized: string; weight: number }>
  let trackScore = trackTags.filter((t) => descriptorSet.has(t.tag_normalized)).reduce((sum, t) => sum + t.weight, 0)

  // Get artist tags
  let artistScore = 0
  if (track.artist_id) {
    const artistTags = db.prepare('SELECT tag_normalized, weight FROM tags WHERE entity_type = "artist" AND entity_id = ?').all(track.artist_id) as Array<{ tag_normalized: string; weight: number }>
    artistScore = artistTags.filter((t) => descriptorSet.has(t.tag_normalized)).reduce((sum, t) => sum + t.weight, 0)
  }

  const raw = Math.min((trackScore * 0.6 + artistScore * 0.4) / descriptors.length, 1.0)
  if (raw === 0) return null

  const matchedTags = [...trackTags, ...(track.artist_id ? db.prepare('SELECT tag_normalized FROM tags WHERE entity_type = "artist" AND entity_id = ?').all(track.artist_id) as Array<{ tag_normalized: string }> : [])]
    .filter((t) => descriptorSet.has(t.tag_normalized))
    .map((t) => t.tag_normalized)

  return {
    raw,
    normalized: Math.min(raw * 2, 1.0),  // Boost since this signal tends to be low
    evidence: { matchedTags: [...new Set(matchedTags)], descriptorCount: descriptors.length },
  }
}
