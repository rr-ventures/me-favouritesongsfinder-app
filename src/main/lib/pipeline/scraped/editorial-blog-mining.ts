import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { callLlm, parseJsonFromLlm } from '../../utils/llm-client.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import fs from 'node:fs'
import path from 'node:path'

const limiter = new RateLimiter({ perSecond: 0.2 })  // 5s between requests

interface EditorialRec {
  artist: string
  title: string | null
  type: 'track' | 'album' | 'artist'
  context: string
  confidence: number
}

export class EditorialBlogMiningStep extends BaseStep {
  name = 'editorial-blog-mining'
  displayName = 'Editorial Blog Mining'
  category = 'scraped' as const
  description = 'Scrapes editorial music blogs with Cheerio and extracts recommendations using Claude/Gemini.'
  dependsOn: string[] = []
  estimatedCostUsd = 0.8

  private loadPrompt(): string {
    const candidates = [
      path.join(process.env.APP_ROOT ?? '', 'src/main/lib/pipeline/scraped/_prompts/editorial-extract-recs.txt'),
      path.join(__dirname, '_prompts/editorial-extract-recs.txt'),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8')
    }
    return 'Extract music recommendations as JSON {artist, title, type, context, confidence} from: {{CONTENT}}'
  }

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

    const blogs = db.prepare("SELECT * FROM source_channels WHERE source_type = 'blog' AND enabled = 1").all() as Array<{ id: number; name: string; url: string }>

    if (blogs.length === 0) {
      yield this.warning('No editorial blogs configured. Add blogs in Settings > Source Channels.')
      return
    }

    const promptTemplate = this.loadPrompt()
    let totalCost = 0
    let totalRecs = 0

    yield this.log('info', `Mining ${blogs.length} editorial blogs...`)

    for (let i = 0; i < blogs.length; i++) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      const blog = blogs[i]

      await limiter.wait()

      try {
        const res = await fetch(blog.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MixingSongFinder/1.0 music research bot)' },
        })

        if (res.status === 403 || res.status === 429) {
          yield this.warning(`Blog ${blog.name} blocked (${res.status}) — skipping`)
          continue
        }
        if (!res.ok) { yield this.warning(`Blog ${blog.name}: HTTP ${res.status}`); continue }

        const html = await res.text()
        const $ = cheerio.load(html)

        // Remove nav, footer, sidebar to focus on content
        $('nav, footer, sidebar, [class*="sidebar"], [class*="widget"], script, style, [role="navigation"]').remove()

        const content = $('article, .post, main, [role="main"]').text().slice(0, 8000) || $('body').text().slice(0, 4000)

        const recs: EditorialRec[] = []

        if (!options.dryRun) {
          const prompt = promptTemplate.replace('{{CONTENT}}', content)
          const result = await callLlm(prompt, { stepName: this.name })
          if (result) {
            totalCost += result.costUsd
            yield this.costUpdate(result.model, result.inputTokens, result.outputTokens, result.costUsd)
            const parsed = parseJsonFromLlm<EditorialRec[]>(result.text)
            if (parsed) recs.push(...parsed.filter((r) => r.confidence > 0.5))
          }

          for (const rec of recs) {
            const artist = upsertArtist(db, { name: rec.artist })
            if (rec.title && rec.type === 'track') {
              upsertTrack(db, { title: rec.title, artist_id: artist.id })
            }
            totalRecs++
          }
        }

        yield this.itemProcessed(`${blog.name}: ${recs.length} recommendations`)
        yield this.progress(((i + 1) / blogs.length) * 100)
      } catch (e) {
        yield this.error(`Blog mining failed for ${blog.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete(`Editorial mining: ${totalRecs} recs from ${blogs.length} blogs. Cost: $${totalCost.toFixed(3)}`)
  }
}
