import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { upsertMixSource, linkTrackToMix } from '../../db/queries/mix-sources.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { RateLimiter } from '../../utils/rate-limiter.js'

const limiter = new RateLimiter({ perSecond: 0.15 })  // ~7s between requests

export class RadioTracklistScrapeStep extends BaseStep {
  name = 'radio-tracklist-scrape'
  displayName = 'Radio Tracklist Scrape'
  category = 'scraped' as const
  description = 'Scrapes NTS, Worldwide FM, Rinse FM, and configured radio shows for tracklists using Cheerio.'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()

    let cheerio: typeof import('cheerio')
    try {
      cheerio = await import('cheerio')
    } catch {
      yield this.error('Cheerio not available.')
      return
    }

    const radioShows = db.prepare("SELECT * FROM source_channels WHERE source_type = 'radio_show' AND enabled = 1").all() as Array<{ id: number; name: string; url: string }>

    if (radioShows.length === 0) {
      yield this.warning('No radio shows configured. Add shows in Settings > Source Channels.')
      return
    }

    yield this.log('info', `Scraping ${radioShows.length} radio shows...`)
    let processed = 0
    let totalTracks = 0

    for (let i = 0; i < radioShows.length; i++) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      const show = radioShows[i]
      await limiter.wait()

      try {
        const res = await fetch(show.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MixingSongFinder/1.0 music research)',
            Accept: 'text/html',
          },
        })

        if (res.status === 403 || res.status === 429) {
          yield this.warning(`${show.name} blocked (${res.status}) — skipping source`)
          continue
        }
        if (!res.ok) { yield this.warning(`${show.name}: HTTP ${res.status}`); continue }

        const html = await res.text()
        const $ = cheerio.load(html)

        const tracks: Array<{ artist: string; title: string }> = []

        // Generic tracklist extraction — covers NTS, WWFM, Rinse patterns
        const patterns = [
          '.tracklist li, .track-list li, .tracklisting li',
          '[class*="tracklist"] [class*="track"]',
          '[class*="playlist"] [class*="item"]',
          'ol li, ul.tracks li',
        ]

        for (const selector of patterns) {
          $(selector).each((_, el) => {
            const text = $(el).text().trim()
            if (!text) return
            const parts = text.split(/\s*[-–—]\s/)
            if (parts.length >= 2 && parts[0].length < 100) {
              tracks.push({ artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() })
            }
          })
          if (tracks.length > 0) break
        }

        if (tracks.length > 0 && !options.dryRun) {
          const showType = show.url.includes('nts.live') ? 'nts'
            : show.url.includes('worldwide.fm') ? 'worldwide_fm'
            : show.url.includes('rinse.fm') ? 'rinse_fm'
            : 'other_radio'

          const mix = upsertMixSource(db, {
            source_type: showType,
            source_url: show.url,
            title: show.name,
            creator_name: show.name,
            raw_description: tracks.map((t) => `${t.artist} - ${t.title}`).join('\n'),
          })

          for (const t of tracks) {
            const artist = upsertArtist(db, { name: t.artist })
            const track = upsertTrack(db, { title: t.title, artist_id: artist.id })
            linkTrackToMix(db, mix.id, track.id)
          }

          totalTracks += tracks.length
        }

        processed++
        yield this.itemProcessed(`${show.name}: ${tracks.length} tracks`)
        yield this.progress(((i + 1) / radioShows.length) * 100)
      } catch (e) {
        yield this.error(`Radio scrape failed for ${show.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete(`Radio: ${totalTracks} tracks from ${processed} shows`)
  }
}
