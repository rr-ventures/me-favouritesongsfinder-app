import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getSeeds } from '../../db/queries/seed-inputs.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { isMockMode, getApiKey } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockArtists from './_mock-data/lastfm-artists.json' assert { type: 'json' }

// NEEDS VERIFICATION at build time — endpoint is experimental
const LISTENBRAINZ_BASE = 'https://labs.api.listenbrainz.org'
const limiter = new RateLimiter({ perSecond: 2 })

export class ListenbrainzRecsStep extends BaseStep {
  name = 'listenbrainz-recs'
  displayName = 'ListenBrainz Recommendations'
  category = 'api' as const
  description = 'Fetches similar artists via ListenBrainz collaborative filtering. Experimental endpoint — may need verification.'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('listenbrainz_token')

    if (mock) {
      yield this.log('warn', 'Mock mode — using built-in artist data (no ListenBrainz token)')
      // Use subset of mock artists as if they were ListenBrainz suggestions
      const data = (mockArtists as Array<{ name: string; lastfm_url: string }>).slice(10, 20)
      for (let i = 0; i < data.length; i++) {
        if (this.cancelled) return
        if (!options.dryRun) upsertArtist(db, { name: data[i].name, lastfm_url: data[i].lastfm_url })
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}LB suggestion: ${data[i].name}`)
        yield this.progress(((i + 1) / data.length) * 100)
      }
      yield this.complete(`Mock: ${data.length} artist suggestions`)
      return
    }

    const seeds = getSeeds(db, 'artist')
    if (seeds.length === 0) {
      yield this.warning('No seed artists. Add seeds in Settings.')
      return
    }

    yield this.log('info', `Querying ListenBrainz for ${seeds.length} seed artists...`)

    let processed = 0
    for (const seed of seeds) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      await limiter.wait()

      try {
        // NEEDS VERIFICATION — endpoint URL may have changed
        const url = `${LISTENBRAINZ_BASE}/similar-artists?artist_name=${encodeURIComponent(seed.input_value)}`
        const res = await fetch(url, {
          headers: { Authorization: `Token ${await getApiKey('listenbrainz_token')}` },
        })

        if (!res.ok) {
          yield this.warning(`ListenBrainz returned ${res.status} for ${seed.input_value}`)
          continue
        }

        const json = await res.json() as { payload?: Array<{ artist_name?: string; artist_mbid?: string }> }
        const artists = json.payload ?? []

        for (const a of artists) {
          if (a.artist_name && !options.dryRun) {
            upsertArtist(db, { name: a.artist_name, mbid: a.artist_mbid })
          }
        }

        processed++
        yield this.itemProcessed(`${seed.input_value}: ${artists.length} similar artists`)
        yield this.progress((processed / seeds.length) * 100)
      } catch (e) {
        yield this.warning(`ListenBrainz failed for ${seed.input_value}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete(`ListenBrainz: processed ${processed} seeds`)
  }
}
