import { ipcMain } from 'electron'
import { getDb } from '../lib/db/connection.js'
import * as artists from '../lib/db/queries/artists.js'
import * as tracks from '../lib/db/queries/tracks.js'
import * as feedback from '../lib/db/queries/feedback.js'
import * as playlists from '../lib/db/queries/playlists.js'
import * as scores from '../lib/db/queries/scores.js'
import * as seeds from '../lib/db/queries/seed-inputs.js'
import * as tags from '../lib/db/queries/tags.js'
import * as mixSources from '../lib/db/queries/mix-sources.js'

export function registerDatabaseHandlers() {
  // ---- Artists ----
  ipcMain.handle('db:getArtists', () => artists.getAllArtists(getDb()))
  ipcMain.handle('db:getSeedArtists', () => artists.getSeeds(getDb()))
  ipcMain.handle('db:upsertArtist', (_e, data: artists.ArtistInsert) => artists.upsertArtist(getDb(), data))
  ipcMain.handle('db:deleteArtist', (_e, id: number) => artists.deleteArtist(getDb(), id))

  // ---- Tracks ----
  ipcMain.handle('db:getTracks', (_e, limit = 50, offset = 0) => tracks.getAllTracks(getDb(), limit, offset))
  ipcMain.handle('db:getTopTracks', (_e, limit = 50, offset = 0) => tracks.getTopRankedTracks(getDb(), limit, offset))
  ipcMain.handle('db:searchTracks', (_e, query: string) => tracks.searchTracks(getDb(), query))
  ipcMain.handle('db:upsertTrack', (_e, data: tracks.TrackInsert) => tracks.upsertTrack(getDb(), data))
  ipcMain.handle('db:updateYouTubeVideoId', (_e, trackId: number, videoId: string) =>
    tracks.updateYouTubeVideoId(getDb(), trackId, videoId))

  // ---- Feedback ----
  ipcMain.handle('db:recordFeedback', (_e, trackId: number, action: feedback.FeedbackAction, skipReason?: feedback.SkipReason) =>
    feedback.recordFeedback(getDb(), trackId, action, skipReason))
  ipcMain.handle('db:getFeedbackForTrack', (_e, trackId: number) =>
    feedback.getFeedbackForTrack(getDb(), trackId))
  ipcMain.handle('db:getLikedTrackIds', () => feedback.getLikedTrackIds(getDb()))
  ipcMain.handle('db:getDislikedArtistIds', () => feedback.getDislikedArtistIds(getDb()))

  // ---- Playlists ----
  ipcMain.handle('db:getPlaylists', () => playlists.getPlaylists(getDb()))
  ipcMain.handle('db:createPlaylist', (_e, name: string, description?: string) =>
    playlists.createPlaylist(getDb(), name, description))
  ipcMain.handle('db:deletePlaylist', (_e, id: number) => playlists.deletePlaylist(getDb(), id))
  ipcMain.handle('db:getPlaylistTracks', (_e, playlistId: number) =>
    playlists.getPlaylistTracks(getDb(), playlistId))
  ipcMain.handle('db:likeTrack', (_e, trackId: number) => playlists.likeTrack(getDb(), trackId))
  ipcMain.handle('db:unlikeTrack', (_e, trackId: number) => playlists.unlikeTrack(getDb(), trackId))
  ipcMain.handle('db:addTrackToPlaylist', (_e, playlistId: number, trackId: number) =>
    playlists.addTrackToPlaylist(getDb(), playlistId, trackId))
  ipcMain.handle('db:removeTrackFromPlaylist', (_e, playlistId: number, trackId: number) =>
    playlists.removeTrackFromPlaylist(getDb(), playlistId, trackId))

  // ---- Scores ----
  ipcMain.handle('db:getSignalScores', (_e, trackId: number) => scores.getSignalScores(getDb(), trackId))
  ipcMain.handle('db:getCompositeScore', (_e, trackId: number) => scores.getCompositeScore(getDb(), trackId))
  ipcMain.handle('db:getTopRanked', (_e, limit = 50, offset = 0) => scores.getTopRanked(getDb(), limit, offset))
  ipcMain.handle('db:getSignalWeights', () => scores.getSignalWeights(getDb()))

  // ---- Seeds ----
  ipcMain.handle('db:getSeeds', (_e, inputType?: seeds.SeedInputType) => seeds.getSeeds(getDb(), inputType))
  ipcMain.handle('db:addSeed', (_e, inputType: seeds.SeedInputType, inputValue: string) =>
    seeds.addSeed(getDb(), inputType, inputValue))
  ipcMain.handle('db:removeSeed', (_e, id: number) => seeds.removeSeed(getDb(), id))

  // ---- Tags ----
  ipcMain.handle('db:getTagsForEntity', (_e, entityType: tags.TagEntityType, entityId: number) =>
    tags.getTagsForEntity(getDb(), entityType, entityId))

  // ---- Mix Sources ----
  ipcMain.handle('db:getMixSources', () => mixSources.getMixSourcesWithDescriptions(getDb()))
  ipcMain.handle('db:getMixesForTrack', (_e, trackId: number) =>
    mixSources.getMixesContainingTrack(getDb(), trackId))

  // ---- DB stats (for pipeline health check) ----
  ipcMain.handle('db:getStats', () => {
    const db = getDb()
    const artistCount = (db.prepare('SELECT COUNT(*) as c FROM artists').get() as { c: number }).c
    const trackCount = (db.prepare('SELECT COUNT(*) as c FROM tracks').get() as { c: number }).c
    const scoredCount = (db.prepare('SELECT COUNT(*) as c FROM composite_scores').get() as { c: number }).c
    const avgScore = (db.prepare('SELECT AVG(final_score) as a FROM composite_scores').get() as { a: number | null }).a
    return { artistCount, trackCount, scoredCount, avgScore: avgScore ?? 0 }
  })

  // ---- Taste descriptors ----
  ipcMain.handle('db:getTasteDescriptors', () => {
    return getDb().prepare('SELECT * FROM taste_descriptors ORDER BY weight DESC').all()
  })
  ipcMain.handle('db:addTasteDescriptor', (_e, descriptor: string, weight = 1.0) => {
    getDb().prepare('INSERT OR IGNORE INTO taste_descriptors (descriptor, weight) VALUES (?, ?)').run(descriptor, weight)
    return { success: true }
  })
  ipcMain.handle('db:removeTasteDescriptor', (_e, id: number) => {
    getDb().prepare('DELETE FROM taste_descriptors WHERE id = ?').run(id)
    return { success: true }
  })

  // ---- Source channels ----
  ipcMain.handle('db:getSourceChannels', (_e, sourceType?: string) => {
    if (sourceType) {
      return getDb().prepare('SELECT * FROM source_channels WHERE source_type = ? ORDER BY name').all(sourceType)
    }
    return getDb().prepare('SELECT * FROM source_channels ORDER BY source_type, name').all()
  })
  ipcMain.handle('db:addSourceChannel', (_e, data: { source_type: string; name: string; url: string; notes?: string }) => {
    getDb().prepare('INSERT INTO source_channels (source_type, name, url, notes) VALUES (?, ?, ?, ?)').run(
      data.source_type, data.name, data.url, data.notes ?? null,
    )
    return { success: true }
  })
  ipcMain.handle('db:removeSourceChannel', (_e, id: number) => {
    getDb().prepare('DELETE FROM source_channels WHERE id = ?').run(id)
    return { success: true }
  })
  ipcMain.handle('db:toggleSourceChannel', (_e, id: number, enabled: boolean) => {
    getDb().prepare('UPDATE source_channels SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
    return { success: true }
  })
}
