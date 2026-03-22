import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { upsertMixSource, linkTrackToMix } from '../../db/queries/mix-sources.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import { getSeeds } from '../../db/queries/seed-inputs.js'

const BASE_URL = 'https://www.1001tracklists.com'
const limiter = new RateLimiter({ perSecond: 0.15 })  // 5-10s between requests

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
]

export class Tracklists1001ScrapeStep extends BaseStep {
  name = '1001tracklists-scrape'
  displayName = '1001Tracklists Scrape'
  category = 'scraped' as const
  description = 'Scrapes 1001tracklists.com for DJ set tracklists. Stops immediately on 403/429. Uses Cheerio (static HTML).'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()

    let cheerio: typeof import('cheerio')
    try {
      cheerio = await import('cheerio')
    } catch {
      yield this.error('Cheerio not available. Run `npm install cheerio`.')
      return
    }

    const seeds = getSeeds(db, 'artist').slice(0, 5)  // Limit to 5 seed artists
    if (seeds.length === 0) {
      yield this.warning('No seed artists to search for. Add seeds in Settings.')
      return
    }

    yield this.log('info', `Searching 1001tracklists for ${seeds.length} artists...`)
    let processed = 0
    let blocked = false

    for (const seed of seeds) {
      if (this.cancelled || blocked) break

      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
      await limiter.wait()

      try {
        const searchUrl = `${BASE_URL}/search/tracklist?searchValue=${encodeURIComponent(seed.input_value)}&searchType=1`
        const res = await fetch(searchUrl, {
          headers: { 'User-Agent': ua, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
        })

        // CRITICAL: stop on 403/429
        if (res.status === 403 || res.status === 429) {
          yield this.warning(`1001tracklists blocked (${res.status}) — stopping and flagging for retry`)
          blocked = true
          break
        }

        if (!res.ok) {
          yield this.warning(`1001tracklists: HTTP ${res.status} for "${seed.input_value}"`)
          continue
        }

        const html = await res.text()
        const $ = cheerio.load(html)

        // Extract tracklist links
        const tracklistLinks: string[] = []
        $('a[href*="/tracklist/"]').each((_, el) => {
          const href = $(el).attr('href')
          if (href && href.includes('/tracklist/')) {
            tracklistLinks.push(href.startsWith('http') ? href : BASE_URL + href)
          }
        })

        yield this.log('info', `Found ${tracklistLinks.length} tracklists for ${seed.input_value}`)

        for (const url of tracklistLinks.slice(0, 3)) {
          if (this.cancelled || blocked) break
          await limiter.wait()

          try {
            const pageRes = await fetch(url, {
              headers: { 'User-Agent': ua, Accept: 'text/html' },
            })

            if (pageRes.status === 403 || pageRes.status === 429) {
              yield this.warning(`Blocked on tracklist page — stopping`)
              blocked = true
              break
            }
            if (!pageRes.ok) continue

            const pageHtml = await pageRes.text()
            const $p = cheerio.load(pageHtml)

            const title = $p('h1').first().text().trim() || $p('title').text()
            const tracks: Array<{ artist: string; title: string }> = []

            // Extract track rows from 1001tracklists table structure
            $p('.tlTrackInfo, .trInfo, [class*="trackValue"]').each((_, row) => {
              const text = $p(row).text().trim()
              const parts = text.split(/\s*[-–—]\s/)
              if (parts.length >= 2) {
                tracks.push({ artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() })
              }
            })

            if (!options.dryRun && tracks.length > 0) {
              const mix = upsertMixSource(db, {
                source_type: '1001tracklists',
                source_url: url,
                title,
                creator_name: seed.input_value,
                raw_description: tracks.map((t) => `${t.artist} - ${t.title}`).join('\n'),
              })

              for (const t of tracks) {
                const artist = upsertArtist(db, { name: t.artist })
                const track = upsertTrack(db, { title: t.title, artist_id: artist.id })
                linkTrackToMix(db, mix.id, track.id)
              }
            }

            yield this.itemProcessed(`${title}: ${tracks.length} tracks`)
            processed++
          } catch (e) {
            yield this.error(`Failed to parse tracklist ${url}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        yield this.progress(((seeds.indexOf(seed) + 1) / seeds.length) * 100)
      } catch (e) {
        yield this.error(`1001tracklists search failed for "${seed.input_value}": ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (blocked) {
      yield this.warning('1001tracklists scraped partially — source was blocked. Will retry blocked sources next run.')
    }

    yield this.complete(`1001tracklists: ${processed} tracklists scraped`)
  }
}
