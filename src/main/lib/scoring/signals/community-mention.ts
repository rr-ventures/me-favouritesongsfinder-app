import type Database from 'better-sqlite3'
import type { SignalResult } from './artist-similarity.js'

// Community mention = track/artist appears in Reddit or editorial mining sources

export function computeCommunityMention(db: Database.Database, trackId: number): SignalResult | null {
  const track = db.prepare('SELECT artist_id, title_normalized FROM tracks WHERE id = ?').get(trackId) as { artist_id: number | null; title_normalized: string } | undefined
  if (!track) return null

  // Count appearances in Reddit-sourced or editorial mix sources
  const mentions = (db.prepare(`
    SELECT COUNT(DISTINCT ms.id) as c
    FROM mix_tracks mt
    JOIN mix_sources ms ON ms.id = mt.mix_id
    WHERE mt.track_id = ? AND ms.source_type IN ('other_radio')
  `).get(trackId) as { c: number }).c

  // Check if artist has tags from community sources
  const communityTags = track.artist_id ? (db.prepare(`
    SELECT COUNT(*) as c FROM tags
    WHERE entity_type = 'artist' AND entity_id = ? AND source IN ('reddit', 'editorial')
  `).get(track.artist_id) as { c: number }).c : 0

  const total = mentions + communityTags * 0.5
  if (total === 0) return null

  const raw = Math.min(total / 5, 1.0)

  return {
    raw,
    normalized: raw,
    evidence: { mentions, communityTagCount: communityTags },
  }
}
