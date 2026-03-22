import type Database from 'better-sqlite3'

export type SeedInputType = 'artist' | 'track' | 'spotify_url' | 'youtube_url' | 'freetext'

export interface SeedInput {
  id: number
  input_type: SeedInputType
  input_value: string
  resolved_artist_id: number | null
  resolved_track_id: number | null
  created_at: string
}

export function addSeed(
  db: Database.Database,
  inputType: SeedInputType,
  inputValue: string,
): SeedInput {
  const existing = db.prepare('SELECT * FROM seed_inputs WHERE input_type = ? AND input_value = ?').get(inputType, inputValue) as SeedInput | undefined
  if (existing) return existing

  const result = db.prepare(`
    INSERT INTO seed_inputs (input_type, input_value) VALUES (?, ?)
  `).run(inputType, inputValue)

  return db.prepare('SELECT * FROM seed_inputs WHERE id = ?').get(result.lastInsertRowid) as SeedInput
}

export function getSeeds(db: Database.Database, inputType?: SeedInputType): SeedInput[] {
  if (inputType) {
    return db.prepare('SELECT * FROM seed_inputs WHERE input_type = ? ORDER BY created_at').all(inputType) as SeedInput[]
  }
  return db.prepare('SELECT * FROM seed_inputs ORDER BY created_at').all() as SeedInput[]
}

export function removeSeed(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM seed_inputs WHERE id = ?').run(id)
}

export function resolveSeed(
  db: Database.Database,
  id: number,
  artistId?: number,
  trackId?: number,
): void {
  db.prepare('UPDATE seed_inputs SET resolved_artist_id = ?, resolved_track_id = ? WHERE id = ?').run(
    artistId ?? null,
    trackId ?? null,
    id,
  )
}
