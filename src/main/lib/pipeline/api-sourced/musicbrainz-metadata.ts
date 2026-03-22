import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getAllArtists, upsertArtist } from '../../db/queries/artists.js'
import { upsertTag } from '../../db/queries/tags.js'
import { getApiKey, isMockMode } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockData from './_mock-data/musicbrainz-artists.json' assert { type: 'json' }

const MB_BASE = 'https://musicbrainz.org/ws/2'
// STRICTLY 1 request per second
const limiter = new RateLimiter({ perSecond: 1 })

export class MusicbrainzMetadataStep extends BaseStep {
  name = 'musicbrainz-metadata'
  displayName = 'MusicBrainz Metadata'
  category = 'api' as const
  description = 'Resolves MBIDs, enriches artists with tags and label data. Strictly 1 req/sec.'
  dependsOn = ['lastfm-artist-expansion']
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('musicbrainz_email')

    if (mock) {
      yield this.log('warn', 'Mock mode — using built-in MusicBrainz data (no email configured)')
      const data = mockData as Array<{ name: string; mbid: string; labels: Array<{ name: string }>; tags: string[] }>

      for (let i = 0; i < data.length; i++) {
        if (this.cancelled) return
        const item = data[i]
        if (!options.dryRun) {
          const artist = upsertArtist(db, { name: item.name, mbid: item.mbid })
          for (const tag of item.tags) {
            upsertTag(db, 'artist', artist.id, tag, 'musicbrainz', 1.0)
          }
          for (const label of item.labels) {
            db.prepare('INSERT OR IGNORE INTO artist_labels (artist_id, label_name, label_name_normalized) VALUES (?, ?, ?)').run(
              artist.id, label.name, label.name.toLowerCase().trim()
            )
          }
        }
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}${item.name} (MBID: ${item.mbid})`)
        yield this.progress(((i + 1) / data.length) * 100)
      }
      yield this.complete(`Mock: enriched ${data.length} artists with MusicBrainz data`)
      return
    }

    const email = await getApiKey('musicbrainz_email')
    const userAgent = `SoundScope/1.0.0 (${email})`
    const artists = getAllArtists(db, options.limit ?? 100)  // Default limit due to 1 req/sec

    yield this.log('info', `Enriching ${artists.length} artists via MusicBrainz (ETA: ~${Math.ceil(artists.length / 60)} min)...`)

    let processed = 0
    for (const artist of artists) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      if (artist.mbid && !options.forceRefresh) {
        yield this.log('debug', `Skipping ${artist.name} — MBID already resolved`)
        continue
      }

      await limiter.wait()

      try {
        const url = `${MB_BASE}/artist?query=${encodeURIComponent(artist.name)}&limit=1&fmt=json`
        const res = await fetch(url, { headers: { 'User-Agent': userAgent } })

        if (!res.ok) {
          yield this.warning(`MusicBrainz: ${res.status} for ${artist.name}`)
          continue
        }

        const json = await res.json() as { artists?: Array<{ id: string; tags?: Array<{ name: string; count: number }> }> }
        const mbArtist = json.artists?.[0]
        if (!mbArtist) continue

        if (!options.dryRun) {
          upsertArtist(db, { name: artist.name, mbid: mbArtist.id })
          for (const tag of (mbArtist.tags ?? [])) {
            upsertTag(db, 'artist', artist.id, tag.name, 'musicbrainz', Math.min(tag.count / 10, 1.0))
          }
        }

        processed++
        yield this.itemProcessed(`${artist.name}: MBID ${mbArtist.id}`)
        yield this.progress((processed / artists.length) * 100)

        // Save checkpoint every 10 artists
        if (options.runId && processed % 10 === 0) {
          this.saveCheckpoint(options.runId, { lastProcessedIndex: processed, lastArtistId: artist.id })
        }
      } catch (e) {
        yield this.error(`MusicBrainz failed for ${artist.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete(`MusicBrainz: enriched ${processed} artists`)
  }
}
