import type Database from 'better-sqlite3'
import { normalizeName } from '../../utils/name-normalizer.js'

export type TagEntityType = 'artist' | 'track'
export type TagSource = 'lastfm' | 'musicbrainz' | 'discogs' | 'listenbrainz' | 'manual' | 'reddit' | 'editorial'

export interface Tag {
  id: number
  entity_type: TagEntityType
  entity_id: number
  tag: string
  tag_normalized: string
  source: TagSource
  weight: number
}

export function upsertTag(
  db: Database.Database,
  entityType: TagEntityType,
  entityId: number,
  tag: string,
  source: TagSource,
  weight = 1.0,
): void {
  const tagNormalized = normalizeName(tag)
  db.prepare(`
    INSERT OR REPLACE INTO tags (entity_type, entity_id, tag, tag_normalized, source, weight)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, tag, tagNormalized, source, weight)
}

export function getTagsForEntity(db: Database.Database, entityType: TagEntityType, entityId: number): Tag[] {
  return db.prepare(`
    SELECT * FROM tags WHERE entity_type = ? AND entity_id = ?
    ORDER BY weight DESC
  `).all(entityType, entityId) as Tag[]
}

export function searchByTag(db: Database.Database, tagQuery: string, entityType?: TagEntityType, limit = 50): Tag[] {
  const normalized = normalizeName(tagQuery)
  if (entityType) {
    return db.prepare(`
      SELECT * FROM tags WHERE entity_type = ? AND tag_normalized LIKE ? LIMIT ?
    `).all(entityType, `%${normalized}%`, limit) as Tag[]
  }
  return db.prepare('SELECT * FROM tags WHERE tag_normalized LIKE ? LIMIT ?').all(`%${normalized}%`, limit) as Tag[]
}

export function getTopTagsForEntity(db: Database.Database, entityType: TagEntityType, entityId: number, limit = 5): string[] {
  const rows = db.prepare(`
    SELECT tag FROM tags WHERE entity_type = ? AND entity_id = ?
    ORDER BY weight DESC LIMIT ?
  `).all(entityType, entityId, limit) as { tag: string }[]
  return rows.map((r) => r.tag)
}
