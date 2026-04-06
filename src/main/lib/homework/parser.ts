/**
 * Parses the BACKLOG-homework.md format and CSV/JSON/text track lists.
 *
 * The homework markdown has numbered section headers (## 1. Seed Artists, etc.)
 * with fenced code blocks containing one entry per line. Lines starting with #
 * inside code blocks are comments.
 */

export interface HomeworkData {
  seedArtists: string[]
  descriptors: string[]
  trustedLabels: string[]
  youtubeChannels: { name: string; url: string }[]
  mixcloudCreators: { name: string; url: string }[]
  subreddits: string[]
  radioShows: { name: string; url?: string }[]
  blogs: { name: string; url: string }[]
  excludedArtists: string[]
  bpmRange: { min: number; max: number } | null
}

export interface TrackEntry {
  artist: string
  title: string
}

export interface HomeworkParseResult {
  data: HomeworkData
  trackEntries: TrackEntry[]
  warnings: string[]
}

const EMPTY_HOMEWORK: HomeworkData = {
  seedArtists: [],
  descriptors: [],
  trustedLabels: [],
  youtubeChannels: [],
  mixcloudCreators: [],
  subreddits: [],
  radioShows: [],
  blogs: [],
  excludedArtists: [],
  bpmRange: null,
}

function extractCodeBlockLines(sectionBody: string): string[] {
  const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/g
  const lines: string[] = []
  let match: RegExpExecArray | null
  while ((match = codeBlockRegex.exec(sectionBody)) !== null) {
    const blockContent = match[1]
    for (const line of blockContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        lines.push(trimmed)
      }
    }
  }
  return lines
}

function parseNameUrl(line: string): { name: string; url: string } | null {
  const pipeMatch = line.match(/^(.+?)\s*\|\s*(https?:\/\/.+)$/)
  if (pipeMatch) {
    return { name: pipeMatch[1].trim(), url: pipeMatch[2].trim() }
  }
  const urlMatch = line.match(/(https?:\/\/\S+)/)
  if (urlMatch) {
    const url = urlMatch[1]
    const name = line.replace(url, '').replace(/\|/g, '').trim() || url
    return { name, url }
  }
  return null
}

function parseBpmRange(lines: string[]): { min: number; max: number } | null {
  for (const line of lines) {
    const match = line.match(/(\d{2,3})\s*[-–—]\s*(\d{2,3})/)
    if (match) {
      const min = parseInt(match[1], 10)
      const max = parseInt(match[2], 10)
      if (min > 0 && max > 0 && max >= min) return { min, max }
    }
  }
  return null
}

/**
 * Parse a homework markdown string into structured data.
 */
export function parseHomeworkMarkdown(content: string): HomeworkParseResult {
  const data: HomeworkData = { ...EMPTY_HOMEWORK }
  const warnings: string[] = []

  const sectionRegex = /^##\s+\d+\.\s+(.+)$/gm
  const sectionHeaders: { title: string; start: number }[] = []
  let sectionMatch: RegExpExecArray | null
  while ((sectionMatch = sectionRegex.exec(content)) !== null) {
    sectionHeaders.push({ title: sectionMatch[1].trim().toLowerCase(), start: sectionMatch.index })
  }

  function getSectionBody(idx: number): string {
    const start = sectionHeaders[idx].start
    const end = idx + 1 < sectionHeaders.length ? sectionHeaders[idx + 1].start : content.length
    return content.slice(start, end)
  }

  for (let i = 0; i < sectionHeaders.length; i++) {
    const title = sectionHeaders[i].title
    const body = getSectionBody(i)
    const lines = extractCodeBlockLines(body)

    if (title.includes('seed artist')) {
      data.seedArtists = lines
    } else if (title.includes('descriptor') || title.includes('genre') || title.includes('mood')) {
      data.descriptors = lines.flatMap((l) => l.split(',').map((s) => s.trim()).filter(Boolean))
    } else if (title.includes('label')) {
      data.trustedLabels = lines.flatMap((l) => l.split(',').map((s) => s.trim()).filter(Boolean))
    } else if (title.includes('youtube')) {
      for (const line of lines) {
        const parsed = parseNameUrl(line)
        if (parsed) data.youtubeChannels.push(parsed)
        else warnings.push(`Could not parse YouTube channel: "${line}"`)
      }
    } else if (title.includes('mixcloud')) {
      for (const line of lines) {
        const parsed = parseNameUrl(line)
        if (parsed) data.mixcloudCreators.push(parsed)
        else warnings.push(`Could not parse Mixcloud creator: "${line}"`)
      }
    } else if (title.includes('subreddit')) {
      data.subreddits = lines.map((l) => l.startsWith('r/') ? l : `r/${l}`)
    } else if (title.includes('radio')) {
      for (const line of lines) {
        const parsed = parseNameUrl(line)
        if (parsed) {
          data.radioShows.push(parsed)
        } else {
          data.radioShows.push({ name: line })
        }
      }
    } else if (title.includes('blog') || title.includes('editorial')) {
      for (const line of lines) {
        const parsed = parseNameUrl(line)
        if (parsed) data.blogs.push(parsed)
        else warnings.push(`Could not parse blog entry: "${line}"`)
      }
    } else if (title.includes('exclude') || title.includes('negative')) {
      data.excludedArtists = lines
    } else if (title.includes('bpm')) {
      data.bpmRange = parseBpmRange(lines)
    }
  }

  return { data, trackEntries: [], warnings }
}

/**
 * Parse a plain text track list. Expects "Artist - Title" per line.
 */
export function parseTextTrackList(content: string): { tracks: TrackEntry[]; warnings: string[] } {
  const tracks: TrackEntry[] = []
  const warnings: string[] = []
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[-–—]\s+(.+)$/)
    if (match) {
      tracks.push({ artist: match[1].trim(), title: match[2].trim() })
    } else if (line.length > 0) {
      warnings.push(`Could not parse line (expected "Artist - Title"): "${line}"`)
    }
  }

  return { tracks, warnings }
}

/**
 * Parse a CSV track list. Expects header row with artist/title columns, or
 * two-column CSV without headers.
 */
export function parseCsvTrackList(content: string): { tracks: TrackEntry[]; warnings: string[] } {
  const tracks: TrackEntry[] = []
  const warnings: string[] = []
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)

  if (lines.length === 0) return { tracks, warnings }

  const firstLine = lines[0].toLowerCase()
  const hasHeader = firstLine.includes('artist') || firstLine.includes('title') || firstLine.includes('track')
  const dataLines = hasHeader ? lines.slice(1) : lines

  let artistCol = 0
  let titleCol = 1

  if (hasHeader) {
    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
    const ai = headers.findIndex((h) => h.includes('artist'))
    const ti = headers.findIndex((h) => h.includes('title') || h.includes('track') || h.includes('song'))
    if (ai >= 0) artistCol = ai
    if (ti >= 0) titleCol = ti
  }

  for (const line of dataLines) {
    const cols = parseCsvLine(line)
    if (cols.length >= 2) {
      const artist = cols[artistCol]?.trim()
      const title = cols[titleCol]?.trim()
      if (artist && title) {
        tracks.push({ artist, title })
      } else {
        warnings.push(`Missing artist or title in CSV row: "${line}"`)
      }
    } else if (cols.length === 1) {
      const match = cols[0].match(/^(.+?)\s*[-–—]\s+(.+)$/)
      if (match) {
        tracks.push({ artist: match[1].trim(), title: match[2].trim() })
      } else {
        warnings.push(`Single-column row, expected "Artist - Title": "${line}"`)
      }
    }
  }

  return { tracks, warnings }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

/**
 * Parse a JSON track list. Expects an array of {artist, title} objects,
 * or an object with a tracks/songs array.
 */
export function parseJsonTrackList(content: string): { tracks: TrackEntry[]; warnings: string[] } {
  const tracks: TrackEntry[] = []
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    warnings.push('Invalid JSON')
    return { tracks, warnings }
  }

  let items: unknown[]
  if (Array.isArray(parsed)) {
    items = parsed
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const arrayKey = Object.keys(obj).find((k) =>
      Array.isArray(obj[k]) && ['tracks', 'songs', 'items', 'data'].includes(k.toLowerCase()),
    )
    if (arrayKey && Array.isArray(obj[arrayKey])) {
      items = obj[arrayKey] as unknown[]
    } else {
      warnings.push('JSON must be an array or contain a tracks/songs/items/data array')
      return { tracks, warnings }
    }
  } else {
    warnings.push('JSON must be an array or object')
    return { tracks, warnings }
  }

  for (const item of items) {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const artist = (obj.artist ?? obj.artist_name ?? obj.artistName ?? '') as string
      const title = (obj.title ?? obj.track ?? obj.name ?? obj.song ?? obj.trackName ?? '') as string
      if (typeof artist === 'string' && typeof title === 'string' && artist.trim() && title.trim()) {
        tracks.push({ artist: artist.trim(), title: title.trim() })
      } else {
        warnings.push(`Missing artist/title in JSON entry: ${JSON.stringify(item).slice(0, 80)}`)
      }
    }
  }

  return { tracks, warnings }
}

/**
 * Auto-detect format and parse a track list from file content.
 */
export function autoParseTrackList(
  content: string,
  filename?: string,
): { tracks: TrackEntry[]; warnings: string[] } {
  const ext = filename?.split('.').pop()?.toLowerCase()

  if (ext === 'json' || content.trimStart().startsWith('[') || content.trimStart().startsWith('{')) {
    return parseJsonTrackList(content)
  }

  if (ext === 'csv' || content.includes(',') && content.split('\n')[0].split(',').length >= 2) {
    return parseCsvTrackList(content)
  }

  return parseTextTrackList(content)
}
