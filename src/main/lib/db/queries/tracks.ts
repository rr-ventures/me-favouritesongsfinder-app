import type Database from 'better-sqlite3'
import { normalizeName } from '../../utils/name-normalizer.js'

export interface Track {
  id: number
  title: string
  title_normalized: string
  artist_id: number | null
  mbid: string | null
  duration_seconds: number | null
  album_name: string | null
  album_art_url: string | null
  release_year: number | null
  spotify_id: string | null
  youtube_video_id: string | null
  soundcloud_url: string | null
  bandcamp_url: string | null
  is_seed: number
  playback_source: 'youtube' | 'spotify' | 'soundcloud' | 'unavailable' | null
  created_at: string
  updated_at: string
}

export interface TrackWithArtist extends Track {
  artist_name: string | null
  artist_name_normalized: string | null
  final_score?: number | null
  recommendation_reason?: string | null
}

export interface TrackInsert {
  title: string
  artist_id?: number
  mbid?: string
  duration_seconds?: number
  album_name?: string
  album_art_url?: string
  release_year?: number
  spotify_id?: string
  youtube_video_id?: string
  soundcloud_url?: string
  bandcamp_url?: string
  is_seed?: number
  playback_source?: Track['playback_source']
}

export function upsertTrack(db: Database.Database, track: TrackInsert): Track {
  const normalized = normalizeName(track.title)

  const existing = db.prepare(`
    SELECT * FROM tracks WHERE title_normalized = ? AND artist_id IS ?
  `).get(normalized, track.artist_id ?? null) as Track | undefined

  if (existing) {
    db.prepare(`
      UPDATE tracks SET
        mbid = COALESCE(?, mbid),
        duration_seconds = COALESCE(?, duration_seconds),
        album_name = COALESCE(?, album_name),
        album_art_url = COALESCE(?, album_art_url),
        release_year = COALESCE(?, release_year),
        spotify_id = COALESCE(?, spotify_id),
        youtube_video_id = COALESCE(?, youtube_video_id),
        soundcloud_url = COALESCE(?, soundcloud_url),
        bandcamp_url = COALESCE(?, bandcamp_url),
        playback_source = COALESCE(?, playback_source),
        is_seed = MAX(is_seed, ?),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      track.mbid ?? null,
      track.duration_seconds ?? null,
      track.album_name ?? null,
      track.album_art_url ?? null,
      track.release_year ?? null,
      track.spotify_id ?? null,
      track.youtube_video_id ?? null,
      track.soundcloud_url ?? null,
      track.bandcamp_url ?? null,
      track.playback_source ?? null,
      track.is_seed ?? 0,
      existing.id,
    )
    return db.prepare('SELECT * FROM tracks WHERE id = ?').get(existing.id) as Track
  }

  const result = db.prepare(`
    INSERT INTO tracks (title, title_normalized, artist_id, mbid, duration_seconds, album_name,
      album_art_url, release_year, spotify_id, youtube_video_id, soundcloud_url, bandcamp_url,
      is_seed, playback_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    track.title,
    normalized,
    track.artist_id ?? null,
    track.mbid ?? null,
    track.duration_seconds ?? null,
    track.album_name ?? null,
    track.album_art_url ?? null,
    track.release_year ?? null,
    track.spotify_id ?? null,
    track.youtube_video_id ?? null,
    track.soundcloud_url ?? null,
    track.bandcamp_url ?? null,
    track.is_seed ?? 0,
    track.playback_source ?? null,
  )

  return db.prepare('SELECT * FROM tracks WHERE id = ?').get(result.lastInsertRowid) as Track
}

export function findTrackByNormalizedName(db: Database.Database, title: string, artistId?: number): Track | null {
  const normalized = normalizeName(title)
  if (artistId !== undefined) {
    return (db.prepare('SELECT * FROM tracks WHERE title_normalized = ? AND artist_id = ?').get(normalized, artistId) as Track | undefined) ?? null
  }
  return (db.prepare('SELECT * FROM tracks WHERE title_normalized = ?').get(normalized) as Track | undefined) ?? null
}

export function getTopRankedTracks(db: Database.Database, limit = 50, offset = 0): TrackWithArtist[] {
  return db.prepare(`
    SELECT t.*, a.name as artist_name, a.name_normalized as artist_name_normalized,
           cs.final_score, cs.recommendation_reason
    FROM tracks t
    LEFT JOIN artists a ON a.id = t.artist_id
    LEFT JOIN composite_scores cs ON cs.track_id = t.id
    WHERE t.playback_source != 'unavailable' OR t.playback_source IS NULL
    ORDER BY cs.final_score DESC NULLS LAST, t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as TrackWithArtist[]
}

export function searchTracks(db: Database.Database, query: string, limit = 20): TrackWithArtist[] {
  const normalized = normalizeName(query)
  return db.prepare(`
    SELECT t.*, a.name as artist_name, a.name_normalized as artist_name_normalized
    FROM tracks t
    LEFT JOIN artists a ON a.id = t.artist_id
    WHERE t.title_normalized LIKE ? OR a.name_normalized LIKE ?
    LIMIT ?
  `).all(`%${normalized}%`, `%${normalized}%`, limit) as TrackWithArtist[]
}

export function updateYouTubeVideoId(db: Database.Database, trackId: number, videoId: string): void {
  db.prepare(`
    UPDATE tracks SET youtube_video_id = ?, playback_source = 'youtube', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(videoId, trackId)
}

export function getAllTracks(db: Database.Database, limit = 1000, offset = 0): Track[] {
  return db.prepare('SELECT * FROM tracks ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as Track[]
}
