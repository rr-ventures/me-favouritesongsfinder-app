import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { upsertMixSource, linkTrackToMix } from '../../db/queries/mix-sources.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { logger } from '../../utils/logger.js'

export class MixcloudScrapeStep extends BaseStep {
  name = 'mixcloud-scrape'
  displayName = 'Mixcloud Scrape'
  category = 'scraped' as const
  description = 'Scrapes Mixcloud creator pages for tracklists using Playwright (JS-rendered SPA).'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const channels = db.prepare("SELECT * FROM source_channels WHERE source_type = 'mixcloud_creator' AND enabled = 1").all() as Array<{ id: number; name: string; url: string }>

    if (channels.length === 0) {
      yield this.warning('No Mixcloud creators configured. Add them in Settings > Source Channels.')
      return
    }

    yield this.log('info', `Scraping ${channels.length} Mixcloud creators...`)

    let playwright: typeof import('playwright') | null = null
    let browser: import('playwright').Browser | null = null

    try {
      playwright = await import('playwright')
      browser = await playwright.chromium.launch({ headless: true })
    } catch (e) {
      yield this.error(`Failed to launch Playwright: ${e instanceof Error ? e.message : String(e)}`)
      yield this.log('warn', 'To fix: run `npx playwright install chromium` in the project directory')
      return
    }

    let processed = 0

    for (const channel of channels) {
      if (this.cancelled) { yield this.warning('Cancelled'); break }

      const page = await browser.newPage()
      try {
        yield this.log('info', `Scraping ${channel.name}...`)
        await page.goto(channel.url, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(3000)

        // Find cloudcast links
        const cloudcastUrls = await page.$$eval('a[href*="/cloudcast/"], a[href*="/mix/"]', (links) =>
          links.map((l) => (l as HTMLAnchorElement).href).filter((h, i, arr) => arr.indexOf(h) === i).slice(0, 10),
        )

        yield this.log('info', `Found ${cloudcastUrls.length} mixes on ${channel.name}`)

        for (const mixUrl of cloudcastUrls) {
          if (this.cancelled) break
          await page.goto(mixUrl, { waitUntil: 'networkidle', timeout: 30000 })
          await page.waitForTimeout(4000)

          // Try to find tracklist
          const tracks = await page.$$eval(
            '[class*="tracklist"] li, [class*="track-list"] li, .track-item, [data-track]',
            (items) => items.map((el) => el.textContent?.trim() ?? '').filter(Boolean),
          )

          const mixTitle = await page.title()

          if (!options.dryRun && tracks.length > 0) {
            const mix = upsertMixSource(db, {
              source_type: 'mixcloud',
              source_url: mixUrl,
              title: mixTitle,
              creator_name: channel.name,
              raw_description: tracks.join('\n'),
            })

            for (const trackText of tracks) {
              const parts = trackText.split(/\s*[-–—]\s/)
              if (parts.length >= 2) {
                const artist = upsertArtist(db, { name: parts[0].trim() })
                const track = upsertTrack(db, { title: parts[1].trim(), artist_id: artist.id })
                linkTrackToMix(db, mix.id, track.id)
              }
            }
          }

          yield this.itemProcessed(`${channel.name} / ${mixTitle}: ${tracks.length} tracks`)
          await page.waitForTimeout(3000 + Math.random() * 2000)
        }

        processed++
        yield this.progress((processed / channels.length) * 100)
      } catch (e) {
        yield this.error(`Mixcloud scrape failed for ${channel.name}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        await page.close()
      }
    }

    await browser.close()
    yield this.complete(`Mixcloud: scraped ${processed} creators`)
  }
}
