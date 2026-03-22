import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { callLlm, parseJsonFromLlm } from '../../utils/llm-client.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import fs from 'node:fs'
import path from 'node:path'

const SUBREDDITS = ['triphop', 'chillhop', 'downtempo', 'electronicmusic']
const limiter = new RateLimiter({ perSecond: 1 })

interface RedditRec {
  artist: string
  title: string | null
  context: string
  confidence: number
}

export class RedditMiningStep extends BaseStep {
  name = 'reddit-mining'
  displayName = 'Reddit Mining'
  category = 'scraped' as const
  description = 'Mines music recommendation threads from key subreddits using Reddit JSON API + Claude/Gemini extraction.'
  dependsOn: string[] = []
  estimatedCostUsd = 0.6

  private loadPrompt(): string {
    const candidates = [
      path.join(process.env.APP_ROOT ?? '', 'src/main/lib/pipeline/scraped/_prompts/reddit-extract-recs.txt'),
      path.join(__dirname, '_prompts/reddit-extract-recs.txt'),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8')
    }
    return 'Extract music recommendations as JSON array {artist, title, context, confidence} from: {{THREAD_TEXT}}'
  }

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const promptTemplate = this.loadPrompt()
    let totalCost = 0
    let totalRecs = 0

    for (let i = 0; i < SUBREDDITS.length; i++) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }

      const subreddit = SUBREDDITS[i]
      yield this.log('info', `Mining r/${subreddit}...`)

      try {
        await limiter.wait()
        const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=recommendation+suggest&sort=relevance&t=year&limit=25`
        const res = await fetch(searchUrl, {
          headers: { 'User-Agent': 'MixingSongFinder/1.0.0 (music discovery app)' },
        })

        if (res.status === 429) {
          yield this.warning(`Reddit rate limited on r/${subreddit} — skipping`)
          await new Promise((r) => setTimeout(r, 10000))
          continue
        }

        if (!res.ok) {
          yield this.warning(`Reddit: ${res.status} for r/${subreddit}`)
          continue
        }

        const json = await res.json() as {
          data?: { children?: Array<{ data: { id: string; title: string; selftext?: string; permalink?: string } }> }
        }

        const posts = json.data?.children ?? []
        yield this.log('info', `r/${subreddit}: ${posts.length} recommendation threads found`)

        for (const post of posts.slice(0, 5)) {
          if (this.cancelled) break
          await limiter.wait()

          try {
            // Fetch thread with comments
            const threadRes = await fetch(`https://www.reddit.com${post.data.permalink}.json?limit=50`, {
              headers: { 'User-Agent': 'MixingSongFinder/1.0.0' },
            })
            if (!threadRes.ok) continue

            const threadData = await threadRes.json() as Array<{
              data?: { children?: Array<{ data: { body?: string; score?: number } }> }
            }>

            const comments = threadData[1]?.data?.children ?? []
            const threadText = [
              post.data.title,
              post.data.selftext ?? '',
              ...comments
                .filter((c) => (c.data.score ?? 0) > 1)
                .map((c) => c.data.body ?? '')
                .slice(0, 20),
            ].join('\n\n').slice(0, 6000)

            const recs: RedditRec[] = []

            if (!options.dryRun) {
              const prompt = promptTemplate.replace('{{THREAD_TEXT}}', threadText)
              const result = await callLlm(prompt, { stepName: this.name })
              if (result) {
                totalCost += result.costUsd
                yield this.costUpdate(result.model, result.inputTokens, result.outputTokens, result.costUsd)
                const parsed = parseJsonFromLlm<RedditRec[]>(result.text)
                if (parsed) recs.push(...parsed.filter((r) => r.confidence > 0.5))
              }

              for (const rec of recs) {
                const artist = upsertArtist(db, { name: rec.artist })
                if (rec.title) upsertTrack(db, { title: rec.title, artist_id: artist.id })
                totalRecs++
              }
            }

            yield this.itemProcessed(`r/${subreddit} / "${post.data.title}": ${recs.length} recs`)
          } catch (e) {
            yield this.warning(`Thread parsing failed: ${e instanceof Error ? e.message : String(e)}`)
          }
        }
      } catch (e) {
        yield this.error(`Reddit mining failed for r/${subreddit}: ${e instanceof Error ? e.message : String(e)}`)
      }

      yield this.progress(((i + 1) / SUBREDDITS.length) * 100)
    }

    yield this.complete(`Reddit: extracted ${totalRecs} recommendations. Cost: $${totalCost.toFixed(3)}`)
  }
}
