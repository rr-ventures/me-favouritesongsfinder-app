import type Database from 'better-sqlite3'
import { normalizeName } from '../../utils/name-normalizer.js'

export interface Artist {
  id: number
  name: string
  name_normalized: string
  mbid: string | null
  discogs_id: number | null
  spotify_id: string | null
  lastfm_url: string | null
  bandcamp_url: string | null
  is_seed: number
  created_at: string
  updated_at: string
}

export interface ArtistInsert {
  name: string
  mbid?: string
  discogs_id?: number
  spotify_id?: string
  lastfm_url?: string
  bandcamp_url?: string
  is_seed?: number
}

export function upsertArtist(db: Database.Database, artist: ArtistInsert): Artist {
  const normalized = normalizeName(artist.name)
  const existing = db.prepare('SELECT * FROM artists WHERE name_normalized = ?').get(normalized) as Artist | undefined
  if (existing) {
    db.prepare(`
      UPDATE artists SET
        mbid = COALESCE(?, mbid),
        discogs_id = COALESCE(?, discogs_id),
        spotify_id = COALESCE(?, spotify_id),
        lastfm_url = COALESCE(?, lastfm_url),
        bandcamp_url = COALESCE(?, bandcamp_url),
        is_seed = MAX(is_seed, ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      artist.mbid ?? null,
      artist.discogs_id ?? null,
      artist.spotify_id ?? null,
      artist.lastfm_url ?? null,
      artist.bandcamp_url ?? null,
      artist.is_seed ?? 0,
      existing.id,
    )
    return db.prepare('SELECT * FROM artists WHERE id = ?').get(existing.id) as Artist
  }

  const result = db.prepare(`
    INSERT INTO artists (name, name_normalized, mbid, discogs_id, spotify_id, lastfm_url, bandcamp_url, is_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artist.name,
    normalized,
    artist.mbid ?? null,
    artist.discogs_id ?? null,
    artist.spotify_id ?? null,
    artist.lastfm_url ?? null,
    artist.bandcamp_url ?? null,
    artist.is_seed ?? 0,
  )

  return db.prepare('SELECT * FROM artists WHERE id = ?').get(result.lastInsertRowid) as Artist
}

export function findArtistByNormalizedName(db: Database.Database, name: string): Artist | null {
  const normalized = normalizeName(name)
  return (db.prepare('SELECT * FROM artists WHERE name_normalized = ?').get(normalized) as Artist | undefined) ?? null
}

export function getSeeds(db: Database.Database): Artist[] {
  return db.prepare('SELECT * FROM artists WHERE is_seed = 1 ORDER BY name').all() as Artist[]
}

export function getSimilarArtists(db: Database.Database, artistId: number): Array<Artist & { similarity_score: number }> {
  return db.prepare(`
    SELECT a.*, s.score as similarity_score
    FROM artist_similarity s
    JOIN artists a ON a.id = s.artist_id_b
    WHERE s.artist_id_a = ?
    ORDER BY s.score DESC
    LIMIT 100
  `).all(artistId) as Array<Artist & { similarity_score: number }>
}

export function getAllArtists(db: Database.Database, limit = 1000, offset = 0): Artist[] {
  return db.prepare('SELECT * FROM artists ORDER BY name LIMIT ? OFFSET ?').all(limit, offset) as Artist[]
}

export function deleteArtist(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM artists WHERE id = ?').run(id)
}
