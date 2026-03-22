import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getSeeds } from '../../db/queries/seed-inputs.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { getApiKey, isMockMode } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockData from './_mock-data/lastfm-artists.json' assert { type: 'json' }

const LASTFM_BASE = 'http://ws.audioscrobbler.com/2.0/'
const limiter = new RateLimiter({ perSecond: 5 })

export class LastfmArtistExpansionStep extends BaseStep {
  name = 'lastfm-artist-expansion'
  displayName = 'Last.fm Artist Expansion'
  category = 'api' as const
  description = 'Expands seed artists via Last.fm getSimilar (2-3 hops). Builds the candidate artist pool.'
  dependsOn: string[] = []
  estimatedCostUsd = 0
  writes = ['artists', 'artist_similarity']
  canRunAlone = true
  scopeLimits = { quick: 50, standard: 150, full: 500 }

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('lastfm_key')
    const limit = this.resolveLimit(options, 200)

    if (mock) {
      yield this.log('warn', '⚠ Mock mode — using built-in artist data (no Last.fm API key set)')
      const data = mockData as Array<{ name: string; name_normalized: string; similarity_score: number; lastfm_url: string; is_seed: number }>
      const total = Math.min(data.length, limit)

      for (let i = 0; i < total; i++) {
        if (this.cancelled) { yield this.warning('Cancelled'); return }
        const artist = data[i]
        if (!options.dryRun) {
          upsertArtist(db, { name: artist.name, lastfm_url: artist.lastfm_url, is_seed: artist.is_seed })
        }
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}${artist.name} (score: ${artist.similarity_score})`)
        yield this.progressItems(i + 1, total)
      }
      yield this.complete(`Mock: processed ${total} artists`)
      return
    }

    const apiKey = await getApiKey('lastfm_key')
    const seeds = getSeeds(db, 'artist')

    if (seeds.length === 0) {
      yield this.warning('No seed artists found — add seeds in Settings → Seed Artists first.')
      return
    }

    yield this.log('info', `Seed artists: ${seeds.map((s) => s.input_value).join(', ')}`)
    yield this.log('info', `Expanding up to ${limit} artist hops via Last.fm getSimilar...`)

    const expanded = new Set<string>()
    const queue = seeds.map((s) => s.input_value)
    let processed = 0
    let apiCalls = 0

    while (queue.length > 0 && processed < limit) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }

      const artistName = queue.shift()!
      if (expanded.has(artistName.toLowerCase())) continue
      expanded.add(artistName.toLowerCase())

      await limiter.wait()

      const url = `${LASTFM_BASE}?method=artist.getsimilar&artist=${encodeURIComponent(artistName)}&api_key=${apiKey}&format=json&limit=50`
      yield this.apiCall('GET', url)
      apiCalls++

      try {
        const res = await fetch(url)
        const json = await res.json() as {
          similarartists?: { artist?: Array<{ name: string; match: string; url: string }> }
          error?: number
          message?: string
        }

        if (json.error) {
          yield this.warning(`Last.fm error ${json.error} for "${artistName}": ${json.message ?? ''}`)
          continue
        }

        const similar = json.similarartists?.artist ?? []

        for (const sim of similar) {
          if (!options.dryRun) {
            upsertArtist(db, { name: sim.name, lastfm_url: sim.url, is_seed: 0 })
          }
          if (!expanded.has(sim.name.toLowerCase()) && processed < limit) {
            queue.push(sim.name)
          }
        }

        processed += similar.length
        yield this.itemProcessed(`"${artistName}" → ${similar.length} similar artists (total: ${expanded.size})`)
        yield this.progressItems(processed, limit, `${expanded.size} artists discovered`)
      } catch (e) {
        yield this.error(`Failed fetching similar for "${artistName}": ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.log('info', `Made ${apiCalls} API calls to Last.fm`)
    yield this.complete(`Done — discovered ${expanded.size} artists (${processed} hops explored)`)
  }
}
