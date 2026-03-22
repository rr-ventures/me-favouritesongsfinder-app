import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getAllTracks } from '../../db/queries/tracks.js'
import { getAllArtists } from '../../db/queries/artists.js'
import { isMatch } from '../../utils/fuzzy-match.js'
import { logger } from '../../utils/logger.js'

export class DeduplicationStep extends BaseStep {
  name = 'deduplication'
  displayName = 'Deduplication'
  category = 'processing' as const
  description = 'Merges duplicate artists and tracks using fuzzy name matching. Transfers all relations to the surviving record.'
  dependsOn = ['lastfm-track-discovery', 'lastfm-track-similarity']
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()

    yield this.log('info', 'Finding and merging duplicate artists...')
    const artists = getAllArtists(db, 10000)
    let artistMerges = 0

    // Compare each artist against candidates
    const survivingArtists = new Map<number, number>() // id -> canonical id

    for (let i = 0; i < artists.length; i++) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      if (survivingArtists.has(artists[i].id)) continue

      for (let j = i + 1; j < artists.length; j++) {
        if (survivingArtists.has(artists[j].id)) continue
        const { match } = isMatch(artists[i].name, artists[j].name)
        if (match) {
          // Keep the one with more data (is_seed wins, then by id)
          const keepId = artists[i].is_seed >= artists[j].is_seed ? artists[i].id : artists[j].id
          const mergeId = keepId === artists[i].id ? artists[j].id : artists[i].id

          if (!options.dryRun) {
            mergeArtist(db, mergeId, keepId)
          }
          survivingArtists.set(mergeId, keepId)
          artistMerges++
          yield this.log('debug', `Merged artist: "${artists[j].name}" → "${artists[i].name}"`)
        }
      }

      if (i % 50 === 0) yield this.progress((i / artists.length) * 50)
    }

    yield this.log('info', `Merged ${artistMerges} duplicate artists. Now deduplicating tracks...`)

    const tracks = getAllTracks(db, 10000)
    let trackMerges = 0

    // Group by normalized artist_id for faster comparison
    const byArtist = new Map<number, typeof tracks>()
    for (const track of tracks) {
      const artistId = track.artist_id ?? 0
      if (!byArtist.has(artistId)) byArtist.set(artistId, [])
      byArtist.get(artistId)!.push(track)
    }

    for (const [, artistTracks] of byArtist) {
      for (let i = 0; i < artistTracks.length; i++) {
        for (let j = i + 1; j < artistTracks.length; j++) {
          const { match } = isMatch(artistTracks[i].title, artistTracks[j].title)
          if (match) {
            const keepId = artistTracks[i].id < artistTracks[j].id ? artistTracks[i].id : artistTracks[j].id
            const mergeId = keepId === artistTracks[i].id ? artistTracks[j].id : artistTracks[i].id
            if (!options.dryRun) {
              mergeTrack(db, mergeId, keepId)
            }
            trackMerges++
          }
        }
      }
    }

    yield this.progress(100)
    yield this.complete(`Deduplication: merged ${artistMerges} artists, ${trackMerges} tracks`)
  }
}

function mergeArtist(db: ReturnType<typeof getDb>, fromId: number, toId: number) {
  try {
    db.prepare('UPDATE tracks SET artist_id = ? WHERE artist_id = ?').run(toId, fromId)
    db.prepare('UPDATE artist_credits SET artist_id = ? WHERE artist_id = ? AND NOT EXISTS (SELECT 1 FROM artist_credits WHERE artist_id = ? AND track_id = artist_credits.track_id)').run(toId, fromId, toId)
    db.prepare('UPDATE artist_similarity SET artist_id_a = ? WHERE artist_id_a = ?').run(toId, fromId)
    db.prepare('UPDATE artist_similarity SET artist_id_b = ? WHERE artist_id_b = ?').run(toId, fromId)
    db.prepare('UPDATE tags SET entity_id = ? WHERE entity_type = "artist" AND entity_id = ?').run(toId, fromId)
    db.prepare('UPDATE artist_labels SET artist_id = ? WHERE artist_id = ?').run(toId, fromId)
    db.prepare('DELETE FROM artists WHERE id = ?').run(fromId)
  } catch (e) {
    logger.warn(`Artist merge ${fromId}→${toId} partial error`, e)
  }
}

function mergeTrack(db: ReturnType<typeof getDb>, fromId: number, toId: number) {
  try {
    db.prepare('UPDATE mix_tracks SET track_id = ? WHERE track_id = ? AND NOT EXISTS (SELECT 1 FROM mix_tracks WHERE track_id = ? AND mix_id = mix_tracks.mix_id)').run(toId, fromId, toId)
    db.prepare('UPDATE playlist_tracks SET track_id = ? WHERE track_id = ?').run(toId, fromId)
    db.prepare('UPDATE feedback SET track_id = ? WHERE track_id = ?').run(toId, fromId)
    db.prepare('UPDATE listening_history SET track_id = ? WHERE track_id = ?').run(toId, fromId)
    db.prepare('UPDATE signal_scores SET track_id = ? WHERE track_id = ? AND NOT EXISTS (SELECT 1 FROM signal_scores WHERE track_id = ? AND signal_type = signal_scores.signal_type)').run(toId, fromId, toId)
    db.prepare('DELETE FROM tracks WHERE id = ?').run(fromId)
  } catch (e) {
    logger.warn(`Track merge ${fromId}→${toId} partial error`, e)
  }
}
