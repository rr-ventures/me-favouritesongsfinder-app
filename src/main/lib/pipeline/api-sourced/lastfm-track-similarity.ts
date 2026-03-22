import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getSeeds } from '../../db/queries/seed-inputs.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { getApiKey, isMockMode } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockTracks from './_mock-data/lastfm-tracks.json' assert { type: 'json' }

const LASTFM_BASE = 'http://ws.audioscrobbler.com/2.0/'
const limiter = new RateLimiter({ perSecond: 5 })

export class LastfmTrackSimilarityStep extends BaseStep {
  name = 'lastfm-track-similarity'
  displayName = 'Last.fm Track Similarity'
  category = 'api' as const
  description = 'Finds similar tracks to seed tracks using track.getSimilar. Uses seed tracks from seed_inputs table.'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('lastfm_key')

    if (mock) {
      yield this.log('warn', 'Mock mode — using built-in similar track data')
      // Return first 15 from mock tracks as "similar" results
      const data = (mockTracks as Array<{ title: string; artist_name: string; album_name: string; duration_seconds: number }>).slice(0, 15)

      for (let i = 0; i < data.length; i++) {
        if (this.cancelled) return
        const t = data[i]
        if (!options.dryRun) {
          const artist = upsertArtist(db, { name: t.artist_name })
          upsertTrack(db, { title: t.title, artist_id: artist.id, album_name: t.album_name, duration_seconds: t.duration_seconds })
        }
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}Similar: ${t.artist_name} - ${t.title}`)
        yield this.progress(((i + 1) / data.length) * 100)
      }
      yield this.complete(`Mock: ${data.length} similar tracks`)
      return
    }

    const apiKey = await getApiKey('lastfm_key')
    const seeds = getSeeds(db, 'track')

    if (seeds.length === 0) {
      yield this.warning('No seed tracks found. Add track seeds in Settings.')
      return
    }

    yield this.log('info', `Finding tracks similar to ${seeds.length} seed tracks...`)

    for (let i = 0; i < seeds.length; i++) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      await limiter.wait()

      const seedValue = seeds[i].input_value
      // Format: "Artist - Title"
      const [artistName, trackTitle] = seedValue.includes(' - ')
        ? seedValue.split(' - ', 2)
        : [seedValue, seedValue]

      try {
        const url = `${LASTFM_BASE}?method=track.getsimilar&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackTitle)}&api_key=${apiKey}&format=json&limit=50`
        const res = await fetch(url)
        const json = await res.json() as { similartracks?: { track?: Array<{ name: string; artist: { name: string }; duration: string }> } }
        const similar = json.similartracks?.track ?? []

        for (const t of similar) {
          if (!options.dryRun) {
            const artist = upsertArtist(db, { name: t.artist.name })
            upsertTrack(db, { title: t.name, artist_id: artist.id, duration_seconds: parseInt(t.duration, 10) || undefined })
          }
        }

        yield this.itemProcessed(`Seed "${seedValue}": ${similar.length} similar tracks`)
        yield this.progress(((i + 1) / seeds.length) * 100)
      } catch (e) {
        yield this.error(`Similar tracks failed for "${seedValue}": ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete('Track similarity expansion complete')
  }
}
