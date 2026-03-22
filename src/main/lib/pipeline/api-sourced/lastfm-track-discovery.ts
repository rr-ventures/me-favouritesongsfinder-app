import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getAllArtists, upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { upsertTag } from '../../db/queries/tags.js'
import { getApiKey, isMockMode } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockTracks from './_mock-data/lastfm-tracks.json' assert { type: 'json' }

const LASTFM_BASE = 'http://ws.audioscrobbler.com/2.0/'
const limiter = new RateLimiter({ perSecond: 5 })

export class LastfmTrackDiscoveryStep extends BaseStep {
  name = 'lastfm-track-discovery'
  displayName = 'Last.fm Track Discovery'
  category = 'api' as const
  description = 'Fetches top tracks + tags for each candidate artist via Last.fm artist.getTopTracks.'
  dependsOn = ['lastfm-artist-expansion']
  estimatedCostUsd = 0
  writes = ['tracks', 'tags']
  canRunAlone = false
  scopeLimits = { quick: 100, standard: 300, full: 1000 }

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('lastfm_key')
    const artistLimit = this.resolveLimit(options, 500)

    if (mock) {
      yield this.log('warn', '⚠ Mock mode — using built-in track data (no Last.fm API key)')
      const data = mockTracks as Array<{ title: string; title_normalized: string; artist_name: string; album_name: string; duration_seconds: number; tags: string[] }>
      const total = Math.min(data.length, artistLimit * 10)

      for (let i = 0; i < total; i++) {
        if (this.cancelled) { yield this.warning('Cancelled'); return }
        const track = data[i]
        if (!options.dryRun) {
          const artist = upsertArtist(db, { name: track.artist_name })
          const trackRecord = upsertTrack(db, {
            title: track.title, artist_id: artist.id,
            album_name: track.album_name, duration_seconds: track.duration_seconds,
          })
          for (const tag of track.tags) upsertTag(db, 'track', trackRecord.id, tag, 'lastfm', 1.0)
        }
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}${track.artist_name} — ${track.title}`)
        yield this.progressItems(i + 1, total)
      }
      yield this.complete(`Mock: processed ${total} tracks`)
      return
    }

    const apiKey = await getApiKey('lastfm_key')
    const artists = getAllArtists(db, artistLimit)

    if (artists.length === 0) {
      yield this.warning('No artists found. Run Last.fm Artist Expansion first.')
      return
    }

    yield this.log('info', `Fetching tracks for ${artists.length} artists (limit: ${artistLimit}) via Last.fm...`)

    let processed = 0
    let totalTracks = 0
    let apiCalls = 0

    for (const artist of artists) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      await limiter.wait()

      try {
        const url = `${LASTFM_BASE}?method=artist.gettoptracks&artist=${encodeURIComponent(artist.name)}&api_key=${apiKey}&format=json&limit=10`
        yield this.apiCall('GET', url)
        apiCalls++

        const res = await fetch(url)
        const json = await res.json() as { toptracks?: { track?: Array<{ name: string; duration: string; album?: { title: string } }> } }
        const tracks = json.toptracks?.track ?? []

        for (const t of tracks) {
          if (!options.dryRun) {
            upsertTrack(db, {
              title: t.name, artist_id: artist.id,
              album_name: t.album?.title,
              duration_seconds: parseInt(t.duration, 10) || undefined,
            })
          }
        }

        processed++
        totalTracks += tracks.length
        yield this.itemProcessed(`${artist.name}: ${tracks.length} tracks (running total: ${totalTracks})`)
        yield this.progressItems(processed, artists.length, `Tracks: ${totalTracks}`)
      } catch (e) {
        yield this.error(`Failed for "${artist.name}": ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.log('info', `Made ${apiCalls} Last.fm API calls`)
    yield this.complete(`Discovered ${totalTracks} tracks for ${processed}/${artists.length} artists`)
  }
}
