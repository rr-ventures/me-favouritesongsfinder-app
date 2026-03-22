import type Database from 'better-sqlite3'
import { getWeights } from './weights.js'
import { generateReason } from './reason-generator.js'
import { computeArtistSimilarity } from './signals/artist-similarity.js'
import { computeTagMatch } from './signals/tag-match.js'
import { computeMixCooccurrence } from './signals/mix-cooccurrence.js'
import { computeLabelCredit } from './signals/label-credit.js'
import { computeCollectorOverlap } from './signals/collector-overlap.js'
import { computeCommunityMention } from './signals/community-mention.js'
import { computeSourceAgreement } from './signals/source-agreement.js'
import { computeAudioSimilarity } from './signals/audio-similarity.js'
import { upsertSignalScore, upsertCompositeScore } from '../db/queries/scores.js'
import type { SignalType } from '../db/queries/scores.js'

interface ComputeResult {
  trackId: number
  finalScore: number
  sourceCount: number
  reason: string
}

const SIGNAL_COMPUTERS: Array<{ type: SignalType; compute: (db: Database.Database, trackId: number) => { raw: number; normalized: number; evidence: unknown } | null }> = [
  { type: 'artist_similarity', compute: computeArtistSimilarity },
  { type: 'tag_match', compute: computeTagMatch },
  { type: 'mix_cooccurrence', compute: computeMixCooccurrence },
  { type: 'label_credit', compute: computeLabelCredit },
  { type: 'collector_overlap', compute: computeCollectorOverlap },
  { type: 'community_mention', compute: computeCommunityMention },
  { type: 'source_agreement', compute: computeSourceAgreement },
  { type: 'audio_similarity', compute: computeAudioSimilarity },
]

export function computeCompositeScore(db: Database.Database, trackId: number, save = true): ComputeResult {
  const weights = getWeights(db)
  let weightedSum = 0
  let totalWeight = 0
  let sourceCount = 0

  // Collect only signals that returned non-null results (data is available)
  const activeSignals: Array<{ type: SignalType; score: number; weight: number; evidence: unknown }> = []

  for (const { type, compute } of SIGNAL_COMPUTERS) {
    const result = compute(db, trackId)
    if (!result) continue

    const weight = weights[type] ?? 0
    activeSignals.push({ type, score: result.normalized, weight, evidence: result.evidence })
    sourceCount++

    if (save) {
      upsertSignalScore(db, trackId, type, result.raw, result.normalized, result.evidence)
    }
  }

  // Key fix: normalise weights across ONLY the signals that produced data.
  // This means scoring works correctly even with just 1-2 pipeline stages run —
  // e.g. running only Last.fm artist expansion + track discovery produces useful
  // scores from artist_similarity + tag_match without the other signals zeroing everything out.
  for (const sig of activeSignals) {
    weightedSum += sig.score * sig.weight
    totalWeight += sig.weight
  }

  let finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0

  // Source count bonus: more independent signals → higher confidence
  if (sourceCount >= 4) finalScore = Math.min(finalScore * 1.20, 1.0)
  else if (sourceCount >= 2) finalScore = Math.min(finalScore * 1.10, 1.0)

  const reason = generateReason(db, trackId)

  if (save) {
    upsertCompositeScore(db, trackId, finalScore, sourceCount, reason)
  }

  return { trackId, finalScore, sourceCount, reason }
}

export function computeAllScores(db: Database.Database, onProgress?: (done: number, total: number) => void): void {
  const tracks = db.prepare('SELECT id FROM tracks').all() as Array<{ id: number }>
  let done = 0

  for (const track of tracks) {
    computeCompositeScore(db, track.id)
    done++
    onProgress?.(done, tracks.length)
  }
}
