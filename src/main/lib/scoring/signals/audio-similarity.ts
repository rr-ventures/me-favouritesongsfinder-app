import type Database from 'better-sqlite3'
import type { SignalResult } from './artist-similarity.js'

// Audio similarity is a backlog stub — returns null without error.
// Future implementation: Essentia.js or AcousticBrainz integration.

export function computeAudioSimilarity(_db: Database.Database, _trackId: number): SignalResult | null {
  return null
}
