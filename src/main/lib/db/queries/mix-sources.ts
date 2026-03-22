import type Database from 'better-sqlite3'

export type MixSourceType = 'youtube_mix' | 'mixcloud' | '1001tracklists' | 'nts' | 'worldwide_fm' | 'rinse_fm' | 'other_radio'

export interface MixSource {
  id: number
  source_type: MixSourceType
  source_url: string | null
  title: string | null
  creator_name: string | null
  raw_description: string | null
  scraped_at: string
}

export function upsertMixSource(
  db: Database.Database,
  mixSource: Omit<MixSource, 'id' | 'scraped_at'>,
): MixSource {
  const existing = mixSource.source_url
    ? (db.prepare('SELECT * FROM mix_sources WHERE source_url = ?').get(mixSource.source_url) as MixSource | undefined)
    : undefined

  if (existing) {
    db.prepare(`
      UPDATE mix_sources SET
        title = COALESCE(?, title),
        creator_name = COALESCE(?, creator_name),
        raw_description = COALESCE(?, raw_description),
        scraped_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(mixSource.title ?? null, mixSource.creator_name ?? null, mixSource.raw_description ?? null, existing.id)
    return db.prepare('SELECT * FROM mix_sources WHERE id = ?').get(existing.id) as MixSource
  }

  const result = db.prepare(`
    INSERT INTO mix_sources (source_type, source_url, title, creator_name, raw_description)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    mixSource.source_type,
    mixSource.source_url ?? null,
    mixSource.title ?? null,
    mixSource.creator_name ?? null,
    mixSource.raw_description ?? null,
  )

  return db.prepare('SELECT * FROM mix_sources WHERE id = ?').get(result.lastInsertRowid) as MixSource
}

export function linkTrackToMix(db: Database.Database, mixId: number, trackId: number, position?: number): void {
  db.prepare(`
    INSERT OR IGNORE INTO mix_tracks (mix_id, track_id, position) VALUES (?, ?, ?)
  `).run(mixId, trackId, position ?? null)
}

export function getMixesContainingTrack(db: Database.Database, trackId: number): MixSource[] {
  return db.prepare(`
    SELECT ms.* FROM mix_sources ms
    JOIN mix_tracks mt ON mt.mix_id = ms.id
    WHERE mt.track_id = ?
  `).all(trackId) as MixSource[]
}

export function getMixSourcesWithDescriptions(db: Database.Database): MixSource[] {
  return db.prepare('SELECT * FROM mix_sources WHERE raw_description IS NOT NULL ORDER BY scraped_at DESC').all() as MixSource[]
}

export function getCooccurringTracks(db: Database.Database, trackId: number, limit = 20): Array<{ track_id: number; count: number }> {
  return db.prepare(`
    SELECT mt2.track_id, COUNT(*) as count
    FROM mix_tracks mt1
    JOIN mix_tracks mt2 ON mt2.mix_id = mt1.mix_id AND mt2.track_id != mt1.track_id
    WHERE mt1.track_id = ?
    GROUP BY mt2.track_id
    ORDER BY count DESC
    LIMIT ?
  `).all(trackId, limit) as Array<{ track_id: number; count: number }>
}
