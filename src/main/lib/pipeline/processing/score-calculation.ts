import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { computeCompositeScore } from '../../scoring/engine.js'

const BATCH_SIZE = 50

export class ScoreCalculationStep extends BaseStep {
  name = 'score-calculation'
  displayName = 'Score Calculation'
  category = 'processing' as const
  description = 'Computes composite recommendation scores using all available signals. Works with any subset of pipeline data — partial data still produces useful results.'
  dependsOn = ['deduplication', 'tag-normalization']
  estimatedCostUsd = 0
  writes = ['composite_scores', 'signal_scores']
  canRunAlone = true

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()

    const trackCount = (db.prepare('SELECT COUNT(*) as c FROM tracks').get() as { c: number }).c
    const artistCount = (db.prepare('SELECT COUNT(*) as c FROM artists').get() as { c: number }).c
    const tagCount = (db.prepare('SELECT COUNT(*) as c FROM tags').get() as { c: number }).c
    const mixCount = (db.prepare('SELECT COUNT(*) as c FROM mix_sources').get() as { c: number }).c
    const seedCount = (db.prepare("SELECT COUNT(*) as c FROM seed_inputs WHERE type = 'artist'").get() as { c: number }).c

    if (trackCount === 0) {
      yield this.warning('No tracks in DB. Run at least Last.fm Artist Expansion + Track Discovery first, then re-run Score Calculation.')
      return
    }

    // Report data availability so users understand what will be scored
    yield this.log('info', `📊 Data snapshot before scoring:`)
    yield this.log('info', `   Artists: ${artistCount}  |  Tracks: ${trackCount}  |  Tags: ${tagCount}  |  Mixes: ${mixCount}  |  Seeds: ${seedCount}`)

    const activeSignals: string[] = []
    if (artistCount > 0 && seedCount > 0) activeSignals.push('artist_similarity')
    if (tagCount > 0) activeSignals.push('tag_match')
    if (mixCount > 0) activeSignals.push('mix_cooccurrence', 'collector_overlap')
    if (mixCount > 0 || tagCount > 0) activeSignals.push('community_mention', 'source_agreement')
    if (activeSignals.length === 0) activeSignals.push('(minimal — run more pipeline steps for better results)')

    yield this.log('info', `🎯 Signals with data: ${activeSignals.join(' · ')}`)
    yield this.log('info', `ℹ️  Weights normalised to active signals only — no penalisation for missing stages`)

    if (options.dryRun) {
      yield this.complete(`[DRY RUN] Would score ${trackCount} tracks using ${activeSignals.length} active signal(s)`)
      return
    }

    yield this.log('info', `Scoring ${trackCount} tracks in batches of ${BATCH_SIZE}...`)

    const tracks = db.prepare('SELECT id FROM tracks').all() as Array<{ id: number }>
    let done = 0

    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }

      const batch = tracks.slice(i, i + BATCH_SIZE)
      for (const t of batch) {
        computeCompositeScore(db, t.id, true)
        done++
      }

      yield this.progressItems(done, trackCount, 'Tracks scored')
      // Yield event loop between batches so IPC events can flush
      await new Promise<void>((r) => setImmediate(r))
    }

    const topScore = (db.prepare('SELECT MAX(final_score) as top FROM composite_scores').get() as { top: number | null }).top ?? 0
    const avgScore = (db.prepare('SELECT AVG(final_score) as avg FROM composite_scores').get() as { avg: number | null }).avg ?? 0
    const scoredCount = (db.prepare('SELECT COUNT(*) as c FROM composite_scores').get() as { c: number }).c

    yield this.log('info', `📈 Scoring results:`)
    yield this.log('info', `   Scored: ${scoredCount}  |  Top: ${(topScore * 100).toFixed(0)}/100  |  Avg: ${(avgScore * 100).toFixed(0)}/100`)
    yield this.complete(`Scored ${scoredCount} tracks — top ${(topScore * 100).toFixed(0)}/100, avg ${(avgScore * 100).toFixed(0)}/100`)
  }
}
