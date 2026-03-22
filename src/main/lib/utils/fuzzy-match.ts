import { distance } from 'fastest-levenshtein'
import { normalizeName } from './name-normalizer.js'

export interface MatchResult {
  match: boolean
  confidence: number
}

/**
 * Fuzzy-match two names using Levenshtein distance and token overlap.
 * Confidence is a value from 0-1.
 */
export function isMatch(a: string, b: string): MatchResult {
  const normA = normalizeName(a)
  const normB = normalizeName(b)

  if (normA === normB) return { match: true, confidence: 1.0 }

  const dist = distance(normA, normB)
  const similarity = 1 - dist / Math.max(normA.length, normB.length)
  if (similarity > 0.9) return { match: true, confidence: similarity }

  const tokensA = new Set(normA.split(' ').filter(Boolean))
  const tokensB = new Set(normB.split(' ').filter(Boolean))
  const overlap = [...tokensA].filter((t) => tokensB.has(t)).length
  const tokenSim = overlap / Math.max(tokensA.size, tokensB.size)
  if (tokenSim > 0.8) return { match: true, confidence: tokenSim }

  return { match: false, confidence: Math.max(similarity, tokenSim) }
}

/**
 * Find the best match from a list of candidates.
 */
export function findBestMatch(
  query: string,
  candidates: string[],
  threshold = 0.85,
): { index: number; confidence: number } | null {
  let best = { index: -1, confidence: 0 }

  for (let i = 0; i < candidates.length; i++) {
    const result = isMatch(query, candidates[i])
    if (result.confidence > best.confidence) {
      best = { index: i, confidence: result.confidence }
    }
  }

  if (best.confidence >= threshold) return best
  return null
}
