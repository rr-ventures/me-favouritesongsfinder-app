import type Database from 'better-sqlite3'
import type { SignalType } from '../db/queries/scores.js'

interface SignalScore {
  signal_type: string
  normalized_score: number
  evidence_json: string | null
}

interface CompositeScore {
  final_score: number
  source_count: number
}

export function generateReason(db: Database.Database, trackId: number): string {
  const composite = db.prepare('SELECT final_score, source_count FROM composite_scores WHERE track_id = ?').get(trackId) as CompositeScore | undefined
  const signals = db.prepare('SELECT signal_type, normalized_score, evidence_json FROM signal_scores WHERE track_id = ? AND normalized_score > 0.1 ORDER BY normalized_score DESC').all(trackId) as SignalScore[]

  if (signals.length === 0) return 'Added to discovery pool.'

  const parts: string[] = []

  for (const signal of signals.slice(0, 4)) {
    const evidence = signal.evidence_json ? (() => { try { return JSON.parse(signal.evidence_json) } catch { return null } })() : null
    const part = buildSignalPhrase(signal.signal_type as SignalType, signal.normalized_score, evidence)
    if (part) parts.push(part)
  }

  const scoreStr = composite ? ` Score: ${Math.round(composite.final_score * 100)}/100.` : ''
  const sourcesStr = composite && composite.source_count >= 3
    ? ` Endorsed by ${composite.source_count} data sources.`
    : ''

  return parts.join(' ') + scoreStr + sourcesStr || 'Discovered via pipeline.'
}

function buildSignalPhrase(signalType: SignalType, score: number, evidence: unknown): string | null {
  const scoreLabel = score > 0.8 ? 'very high' : score > 0.6 ? 'high' : score > 0.4 ? 'good' : 'moderate'

  switch (signalType) {
    case 'artist_similarity': {
      const ev = evidence as { evidence?: Array<{ seed: string; score: number }> } | null
      const topSeed = ev?.evidence?.[0]
      if (topSeed) return `Similar to ${topSeed.seed} (${Math.round(topSeed.score * 100)}% match on Last.fm).`
      return `Artist has ${scoreLabel} similarity to your seeds.`
    }
    case 'tag_match': {
      const ev = evidence as { matchedTags?: string[] } | null
      const tags = ev?.matchedTags?.slice(0, 3)
      if (tags?.length) return `Tagged: ${tags.join(', ')}.`
      return `Tags align with your taste descriptors.`
    }
    case 'mix_cooccurrence': {
      const ev = evidence as { mixCount?: number; seedCooccurrences?: number } | null
      if (ev?.mixCount) return `Appears in ${ev.mixCount} mix${ev.mixCount !== 1 ? 'es' : ''}${ev.seedCooccurrences ? `, including ${ev.seedCooccurrences} with seed tracks` : ''}.`
      return 'Found in multiple DJ mixes.'
    }
    case 'label_credit': {
      const ev = evidence as { sharedLabels?: string[] } | null
      const labels = ev?.sharedLabels?.slice(0, 2)
      if (labels?.length) return `On ${labels.join(', ')} — shared label with your seed artists.`
      return 'Released on a label shared with seed artists.'
    }
    case 'collector_overlap': {
      const ev = evidence as { sharedMixesWithSeeds?: number } | null
      if (ev?.sharedMixesWithSeeds) return `Curated alongside seed tracks in ${ev.sharedMixesWithSeeds} mix${ev.sharedMixesWithSeeds !== 1 ? 'es' : ''}.`
      return 'Co-curated with your seed tracks.'
    }
    case 'community_mention': {
      return 'Mentioned in community recommendations.'
    }
    case 'source_agreement': {
      const ev = evidence as { totalSources?: number } | null
      if (ev?.totalSources) return `Endorsed by ${ev.totalSources} independent data sources.`
      return 'Multiple sources agree on this recommendation.'
    }
    default:
      return null
  }
}
