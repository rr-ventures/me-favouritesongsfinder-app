// Shared name matching utilities for processing steps.
// For the standalone utility, see src/main/lib/utils/fuzzy-match.ts

import { isMatch, findBestMatch } from '../../utils/fuzzy-match.js'
import type Database from 'better-sqlite3'

export { isMatch, findBestMatch }

export function findOrCreateArtistId(
  db: Database.Database,
  artistName: string,
  existingArtists: Array<{ id: number; name_normalized: string }>,
): number | null {
  const { normalizeName } = require('../../utils/name-normalizer.js')
  const normalized = normalizeName(artistName)

  // Exact match first
  const exact = existingArtists.find((a) => a.name_normalized === normalized)
  if (exact) return exact.id

  // Fuzzy match
  const names = existingArtists.map((a) => a.name_normalized)
  const best = findBestMatch(normalized, names, 0.9)
  if (best) return existingArtists[best.index].id

  return null
}
