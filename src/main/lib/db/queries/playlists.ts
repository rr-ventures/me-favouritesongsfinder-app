import type Database from 'better-sqlite3'

export interface Playlist {
  id: number
  name: string
  description: string | null
  is_auto: number
  created_at: string
}

export interface PlaylistTrack {
  playlist_id: number
  track_id: number
  position: number
  added_at: string
}

export function getPlaylists(db: Database.Database): Playlist[] {
  return db.prepare('SELECT * FROM playlists ORDER BY is_auto DESC, name').all() as Playlist[]
}

export function createPlaylist(db: Database.Database, name: string, description?: string): Playlist {
  const result = db.prepare(`
    INSERT INTO playlists (name, description, is_auto) VALUES (?, ?, 0)
  `).run(name, description ?? null)
  return db.prepare('SELECT * FROM playlists WHERE id = ?').get(result.lastInsertRowid) as Playlist
}

export function deletePlaylist(db: Database.Database, id: number): void {
  // Don't delete the auto Liked Songs playlist
  db.prepare('DELETE FROM playlists WHERE id = ? AND is_auto = 0').run(id)
}

export function addTrackToPlaylist(db: Database.Database, playlistId: number, trackId: number): void {
  const maxPosition = (db.prepare('SELECT MAX(position) as m FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as { m: number | null }).m ?? 0
  db.prepare(`
    INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)
  `).run(playlistId, trackId, maxPosition + 1)
}

export function removeTrackFromPlaylist(db: Database.Database, playlistId: number, trackId: number): void {
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId)
}

export function getPlaylistTracks(db: Database.Database, playlistId: number): PlaylistTrack[] {
  return db.prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position').all(playlistId) as PlaylistTrack[]
}

export function likeTrack(db: Database.Database, trackId: number): void {
  addTrackToPlaylist(db, 1, trackId) // playlist id 1 = Liked Songs
}

export function unlikeTrack(db: Database.Database, trackId: number): void {
  removeTrackFromPlaylist(db, 1, trackId)
}
