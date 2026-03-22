import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { normalizeTag as normalizeTagUtil } from '../../utils/name-normalizer.js'

// Map common variants to canonical forms
const TAG_ALIASES: Record<string, string> = {
  'lo-fi': 'lo-fi hip hop',
  'lofi': 'lo-fi hip hop',
  'lo fi': 'lo-fi hip hop',
  'lofi hip hop': 'lo-fi hip hop',
  'trip hop': 'trip-hop',
  'triphop': 'trip-hop',
  'downtempo electronic': 'downtempo',
  'down tempo': 'downtempo',
  'nu-jazz': 'nu jazz',
  'nu_jazz': 'nu jazz',
  'chillout': 'chill out',
  'chill-out': 'chill out',
  'abstract hiphop': 'abstract hip hop',
  'hip-hop': 'hip hop',
  'hiphop': 'hip hop',
  'r&b': 'r&b',
  'rnb': 'r&b',
  'jazz-hop': 'jazz hop',
  'jazzytrippy': 'jazzy',
  'electronic music': 'electronic',
  'electronica': 'electronic',
}

export class TagNormalizationStep extends BaseStep {
  name = 'tag-normalization'
  displayName = 'Tag Normalization'
  category = 'processing' as const
  description = 'Normalizes and deduplicates tags across all artists and tracks. Collapses aliases to canonical forms.'
  dependsOn = ['lastfm-track-discovery', 'musicbrainz-metadata', 'discogs-enrichment']
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()

    if (options.dryRun) {
      const count = (db.prepare('SELECT COUNT(*) as c FROM tags').get() as { c: number }).c
      yield this.log('info', `[DRY RUN] Would normalize ${count} tags`)
      yield this.complete(`Dry run: ${count} tags would be normalized`)
      return
    }

    yield this.log('info', 'Normalizing tags...')

    // Fix normalized tags
    const tags = db.prepare('SELECT id, tag, tag_normalized FROM tags').all() as Array<{ id: number; tag: string; tag_normalized: string }>
    let normalized = 0
    let aliased = 0

    for (let i = 0; i < tags.length; i++) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }

      const tag = tags[i]
      const normalizedTag = normalizeTagUtil(tag.tag)
      const canonical = TAG_ALIASES[normalizedTag] ?? normalizedTag

      if (canonical !== tag.tag_normalized || normalizedTag !== tag.tag_normalized) {
        db.prepare('UPDATE tags SET tag_normalized = ? WHERE id = ?').run(canonical, tag.id)
        normalized++
        if (canonical !== normalizedTag) aliased++
      }

      if (i % 100 === 0) yield this.progress((i / tags.length) * 100)
    }

    // Remove exact duplicate tags (same entity, same normalized tag, keep highest weight)
    const deleted = db.prepare(`
      DELETE FROM tags WHERE id NOT IN (
        SELECT MIN(id) FROM tags
        GROUP BY entity_type, entity_id, tag_normalized, source
      )
    `).run()

    yield this.progress(100)
    yield this.complete(`Tag normalization: ${normalized} updated, ${aliased} aliased, ${deleted.changes} duplicates removed`)
  }
}

