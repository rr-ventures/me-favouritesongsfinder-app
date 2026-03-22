/**
 * Normalize a track title or artist name for deduplication and fuzzy matching.
 * Strips featured artists, removes annotations, normalizes whitespace and punctuation.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(feat\.?.*?\)/gi, '')
    .replace(/\(ft\.?.*?\)/gi, '')
    .replace(/\(featuring.*?\)/gi, '')
    .replace(/\(remix\)/gi, ' remix')
    .replace(/\(live\)/gi, ' live')
    .replace(/\(official.*?\)/gi, '')
    .replace(/\[official.*?\]/gi, '')
    .replace(/\(music video\)/gi, '')
    .replace(/[''`]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/&/g, 'and')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalize a tag string (lowercase, trim, collapse whitespace).
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract the main artist name from a "Artist - Title" formatted string.
 */
export function parseArtistTitle(str: string): { artist: string; title: string } | null {
  const match = str.match(/^(.+?)\s*[-–—]\s*(.+)$/)
  if (!match) return null
  return { artist: match[1].trim(), title: match[2].trim() }
}
