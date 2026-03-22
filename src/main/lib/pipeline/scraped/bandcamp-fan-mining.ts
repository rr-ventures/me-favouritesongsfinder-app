import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getSeeds } from '../../db/queries/seed-inputs.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'

export class BandcampFanMiningStep extends BaseStep {
  name = 'bandcamp-fan-mining'
  displayName = 'Bandcamp Fan Mining'
  category = 'scraped' as const
  description = 'Finds seed artists on Bandcamp and mines fan collections for discovery via Playwright.'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const seeds = getSeeds(db, 'artist').slice(0, 3)

    if (seeds.length === 0) {
      yield this.warning('No seed artists. Add seeds in Settings.')
      return
    }

    let playwright: typeof import('playwright') | null = null
    let browser: import('playwright').Browser | null = null

    try {
      playwright = await import('playwright')
      browser = await playwright.chromium.launch({ headless: true })
    } catch (e) {
      yield this.error(`Failed to launch Playwright: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    yield this.log('info', `Mining Bandcamp fans for ${seeds.length} seed artists...`)
    let discovered = 0

    for (let i = 0; i < seeds.length; i++) {
      if (this.cancelled) break
      const seed = seeds[i]
      const page = await browser.newPage()

      try {
        // Search for artist on Bandcamp
        await page.goto(`https://bandcamp.com/search?q=${encodeURIComponent(seed.input_value)}&item_type=b`, {
          waitUntil: 'networkidle', timeout: 30000,
        })
        await page.waitForTimeout(2000)

        // Get first artist result
        const artistUrl = await page.$eval('.result-info a', (el) => (el as HTMLAnchorElement).href).catch(() => null)
        if (!artistUrl) {
          yield this.log('info', `No Bandcamp page found for ${seed.input_value}`)
          continue
        }

        await page.goto(artistUrl, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(3000)

        // Find fan pages from "fans also like" section
        const relatedArtists = await page.$$eval(
          '.deets .genre a, .fan-also-bought a[href*="bandcamp.com"]',
          (links) => links.map((l) => (l as HTMLAnchorElement).textContent?.trim() ?? '').filter(Boolean).slice(0, 15),
        )

        for (const artistName of relatedArtists) {
          if (!options.dryRun) {
            upsertArtist(db, { name: artistName, bandcamp_url: '' })
          }
          discovered++
        }

        yield this.itemProcessed(`${seed.input_value}: ${relatedArtists.length} related artists on Bandcamp`)
        yield this.progress(((i + 1) / seeds.length) * 100)
        await page.waitForTimeout(3000)
      } catch (e) {
        yield this.error(`Bandcamp mining failed for ${seed.input_value}: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        await page.close()
      }
    }

    await browser.close()
    yield this.complete(`Bandcamp: discovered ${discovered} related artists`)
  }
}
