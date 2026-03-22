import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'

export class PoolHealthCheckStep extends BaseStep {
  name = 'pool-health-check'
  displayName = 'Pool Health Check'
  category = 'processing' as const
  description = 'Reports stats on the discovery pool: total tracks, scored tracks, score distribution, and data quality metrics.'
  dependsOn = ['score-calculation']
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()

    const artistCount = (db.prepare('SELECT COUNT(*) as c FROM artists').get() as { c: number }).c
    const trackCount = (db.prepare('SELECT COUNT(*) as c FROM tracks').get() as { c: number }).c
    const scoredCount = (db.prepare('SELECT COUNT(*) as c FROM composite_scores').get() as { c: number }).c
    const avgScore = (db.prepare('SELECT AVG(final_score) as a FROM composite_scores').get() as { a: number | null }).a ?? 0
    const topScore = (db.prepare('SELECT MAX(final_score) as m FROM composite_scores').get() as { m: number | null }).m ?? 0
    const seedArtistCount = (db.prepare('SELECT COUNT(*) as c FROM artists WHERE is_seed = 1').get() as { c: number }).c
    const withYouTube = (db.prepare("SELECT COUNT(*) as c FROM tracks WHERE youtube_video_id IS NOT NULL").get() as { c: number }).c
    const mixCount = (db.prepare('SELECT COUNT(*) as c FROM mix_sources').get() as { c: number }).c

    const readiness = scoredCount > 0 ? 'ready' : trackCount > 0 ? 'needs scoring' : 'no data'

    yield this.log('info', '=== Pool Health Report ===')
    yield this.log('info', `Artists: ${artistCount} (${seedArtistCount} seeds)`)
    yield this.log('info', `Tracks: ${trackCount} total, ${scoredCount} scored`)
    yield this.log('info', `Mix sources: ${mixCount}`)
    yield this.log('info', `Playback-ready: ${withYouTube} tracks with YouTube IDs`)
    yield this.log('info', `Scores: avg=${avgScore.toFixed(3)}, top=${topScore.toFixed(3)}`)
    yield this.log('info', `Pool status: ${readiness}`)

    yield this.complete('Health check complete', {
      artistCount,
      trackCount,
      scoredCount,
      avgScore,
      topScore,
      seedArtistCount,
      withYouTube,
      mixCount,
      readiness,
    })
  }
}
