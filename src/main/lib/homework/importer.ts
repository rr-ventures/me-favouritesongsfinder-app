import type Database from 'better-sqlite3'
import { upsertArtist } from '../db/queries/artists.js'
import { upsertTrack } from '../db/queries/tracks.js'
import { addSeed } from '../db/queries/seed-inputs.js'
import type { HomeworkData, TrackEntry } from './parser.js'
import { logger } from '../utils/logger.js'

export interface ImportCounts {
  seedArtists: number
  descriptors: number
  labels: number
  channels: number
  tracks: number
  excluded: number
  skipped: number
}

export interface ImportResult {
  counts: ImportCounts
  warnings: string[]
  errors: string[]
}

/**
 * Import parsed homework data into the database in a single transaction.
 */
export function importHomeworkData(db: Database.Database, data: HomeworkData): ImportResult {
  const counts: ImportCounts = {
    seedArtists: 0,
    descriptors: 0,
    labels: 0,
    channels: 0,
    tracks: 0,
    excluded: 0,
    skipped: 0,
  }
  const warnings: string[] = []
  const errors: string[] = []

  const importTx = db.transaction(() => {
    for (const name of data.seedArtists) {
      try {
        addSeed(db, 'artist', name)
        upsertArtist(db, { name, is_seed: 1 })
        counts.seedArtists++
      } catch (err) {
        errors.push(`Seed artist "${name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    for (const desc of data.descriptors) {
      try {
        db.prepare('INSERT OR IGNORE INTO taste_descriptors (descriptor, weight) VALUES (?, 1.0)').run(desc)
        const changes = db.prepare('SELECT changes() as c').get() as { c: number }
        if (changes.c > 0) counts.descriptors++
        else counts.skipped++
      } catch (err) {
        errors.push(`Descriptor "${desc}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    for (const label of data.trustedLabels) {
      try {
        addSeed(db, 'freetext', `label:${label}`)
        counts.labels++
      } catch (err) {
        errors.push(`Label "${label}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    for (const ch of data.youtubeChannels) {
      try {
        const exists = db.prepare('SELECT id FROM source_channels WHERE url = ?').get(ch.url)
        if (!exists) {
          db.prepare('INSERT INTO source_channels (source_type, name, url) VALUES (?, ?, ?)').run(
            'youtube_channel', ch.name, ch.url,
          )
          counts.channels++
        } else {
          counts.skipped++
        }
      } catch (err) {
        errors.push(`YouTube channel "${ch.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    for (const mc of data.mixcloudCreators) {
      try {
        const exists = db.prepare('SELECT id FROM source_channels WHERE url = ?').get(mc.url)
        if (!exists) {
          db.prepare('INSERT INTO source_channels (source_type, name, url) VALUES (?, ?, ?)').run(
            'mixcloud_creator', mc.name, mc.url,
          )
          counts.channels++
        } else {
          counts.skipped++
        }
      } catch (err) {
        errors.push(`Mixcloud creator "${mc.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    for (const show of data.radioShows) {
      try {
        if (show.url) {
          const exists = db.prepare('SELECT id FROM source_channels WHERE url = ?').get(show.url)
          if (!exists) {
            db.prepare('INSERT INTO source_channels (source_type, name, url) VALUES (?, ?, ?)').run(
              'radio_show', show.name, show.url,
            )
            counts.channels++
          } else {
            counts.skipped++
          }
        } else {
          addSeed(db, 'freetext', `radio:${show.name}`)
          counts.channels++
        }
      } catch (err) {
        errors.push(`Radio show "${show.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    for (const blog of data.blogs) {
      try {
        const exists = db.prepare('SELECT id FROM source_channels WHERE url = ?').get(blog.url)
        if (!exists) {
          db.prepare('INSERT INTO source_channels (source_type, name, url) VALUES (?, ?, ?)').run(
            'blog', blog.name, blog.url,
          )
          counts.channels++
        } else {
          counts.skipped++
        }
      } catch (err) {
        errors.push(`Blog "${blog.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    for (const name of data.excludedArtists) {
      try {
        const artist = upsertArtist(db, { name })
        const tracks = db.prepare('SELECT id FROM tracks WHERE artist_id = ?').all(artist.id) as { id: number }[]
        for (const t of tracks) {
          const existing = db.prepare(
            "SELECT id FROM feedback WHERE track_id = ? AND action = 'dislike'",
          ).get(t.id)
          if (!existing) {
            db.prepare("INSERT INTO feedback (track_id, action) VALUES (?, 'dislike')").run(t.id)
          }
        }
        counts.excluded++
      } catch (err) {
        errors.push(`Excluded artist "${name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })

  try {
    importTx()
  } catch (err) {
    errors.push(`Transaction failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  logger.info('Homework data imported', { counts, warningCount: warnings.length, errorCount: errors.length })
  return { counts, warnings, errors }
}

/**
 * Import a list of track entries (artist + title) into the database.
 * Creates artists as needed and marks tracks as seeds.
 */
export function importTrackEntries(db: Database.Database, entries: TrackEntry[]): ImportResult {
  const counts: ImportCounts = {
    seedArtists: 0,
    descriptors: 0,
    labels: 0,
    channels: 0,
    tracks: 0,
    excluded: 0,
    skipped: 0,
  }
  const warnings: string[] = []
  const errors: string[] = []

  const importTx = db.transaction(() => {
    for (const entry of entries) {
      try {
        const artist = upsertArtist(db, { name: entry.artist })
        upsertTrack(db, { title: entry.title, artist_id: artist.id, is_seed: 1 })
        addSeed(db, 'track', `${entry.artist} - ${entry.title}`)
        counts.tracks++
      } catch (err) {
        errors.push(`Track "${entry.artist} - ${entry.title}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })

  try {
    importTx()
  } catch (err) {
    errors.push(`Transaction failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  logger.info('Track entries imported', { count: counts.tracks, errorCount: errors.length })
  return { counts, warnings, errors }
}
