import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getAllArtists, upsertArtist } from '../../db/queries/artists.js'
import { upsertTag } from '../../db/queries/tags.js'
import { getApiKey, isMockMode } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockData from './_mock-data/discogs-labels.json' assert { type: 'json' }

const DISCOGS_BASE = 'https://api.discogs.com'
// 60 req/min authenticated = 1/sec
const limiter = new RateLimiter({ perMinute: 55 })

export class DiscogsEnrichmentStep extends BaseStep {
  name = 'discogs-enrichment'
  displayName = 'Discogs Enrichment'
  category = 'api' as const
  description = 'Enriches artists with label affiliations and style tags from Discogs. Also mines label rosters for new candidate artists.'
  dependsOn = ['lastfm-artist-expansion']
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('discogs_token')

    if (mock) {
      yield this.log('warn', 'Mock mode — using built-in Discogs label data')
      const data = mockData as Array<{ label_name: string; discogs_label_id: number; artists_on_label: string[] }>

      for (let i = 0; i < data.length; i++) {
        if (this.cancelled) return
        const label = data[i]
        if (!options.dryRun) {
          for (const artistName of label.artists_on_label) {
            const artist = upsertArtist(db, { name: artistName })
            db.prepare('INSERT OR IGNORE INTO artist_labels (artist_id, label_name, label_name_normalized, discogs_label_id) VALUES (?, ?, ?, ?)').run(
              artist.id, label.label_name, label.label_name.toLowerCase(), label.discogs_label_id
            )
          }
        }
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}Label: ${label.label_name} (${label.artists_on_label.length} artists)`)
        yield this.progress(((i + 1) / data.length) * 100)
      }
      yield this.complete(`Mock: processed ${data.length} labels`)
      return
    }

    const token = await getApiKey('discogs_token')
    const headers = { Authorization: `Discogs token=${token}`, 'User-Agent': 'MixingSongFinder/1.0.0' }
    const artists = getAllArtists(db, options.limit ?? 200)

    yield this.log('info', `Enriching ${artists.length} artists via Discogs...`)

    let processed = 0
    for (const artist of artists) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      await limiter.wait()

      try {
        const url = `${DISCOGS_BASE}/database/search?q=${encodeURIComponent(artist.name)}&type=artist&per_page=1`
        const res = await fetch(url, { headers })
        if (!res.ok) { yield this.warning(`Discogs: ${res.status} for ${artist.name}`); continue }

        const json = await res.json() as { results?: Array<{ id: number; style?: string[] }> }
        const result = json.results?.[0]
        if (!result) continue

        if (!options.dryRun && result.style) {
          upsertArtist(db, { name: artist.name, discogs_id: result.id })
          for (const style of result.style) {
            upsertTag(db, 'artist', artist.id, style, 'discogs', 0.8)
          }
        }

        processed++
        yield this.itemProcessed(`${artist.name}: ${result.style?.length ?? 0} styles`)
        yield this.progress((processed / artists.length) * 100)
      } catch (e) {
        yield this.error(`Discogs failed for ${artist.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete(`Discogs: enriched ${processed} artists`)
  }
}
