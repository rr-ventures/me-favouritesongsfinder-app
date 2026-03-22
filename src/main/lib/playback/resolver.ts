import { getDb } from '../db/connection.js'
import { updateYouTubeVideoId } from '../db/queries/tracks.js'
import { searchYouTube } from './youtube-search.js'
import { logger } from '../utils/logger.js'

export interface PlaybackResolution {
  type: 'youtube' | 'spotify' | 'soundcloud' | 'unavailable'
  videoId?: string
  url?: string
  embedUrl: string | null
}

export async function resolvePlayback(trackId: number): Promise<PlaybackResolution> {
  const db = getDb()
  const track = db.prepare(`
    SELECT t.*, a.name as artist_name
    FROM tracks t
    LEFT JOIN artists a ON a.id = t.artist_id
    WHERE t.id = ?
  `).get(trackId) as {
    id: number; title: string; artist_name: string | null;
    youtube_video_id: string | null; spotify_id: string | null;
    soundcloud_url: string | null; playback_source: string | null
  } | undefined

  if (!track) return { type: 'unavailable', embedUrl: null }

  // 1. Existing YouTube ID
  if (track.youtube_video_id) {
    return {
      type: 'youtube',
      videoId: track.youtube_video_id,
      embedUrl: `https://www.youtube.com/embed/${track.youtube_video_id}?autoplay=1&enablejsapi=1`,
    }
  }

  // 2. Search YouTube
  const query = track.artist_name ? `${track.artist_name} - ${track.title}` : track.title
  logger.info(`Searching YouTube for: ${query}`)

  const videoId = await searchYouTube(query)
  if (videoId) {
    updateYouTubeVideoId(db, trackId, videoId)
    return {
      type: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
    }
  }

  // 3. Spotify embed
  if (track.spotify_id) {
    return {
      type: 'spotify',
      url: `https://open.spotify.com/track/${track.spotify_id}`,
      embedUrl: `https://open.spotify.com/embed/track/${track.spotify_id}`,
    }
  }

  // 4. SoundCloud
  if (track.soundcloud_url) {
    return {
      type: 'soundcloud',
      url: track.soundcloud_url,
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.soundcloud_url)}&auto_play=true`,
    }
  }

  // Mark as unavailable in DB
  db.prepare("UPDATE tracks SET playback_source = 'unavailable', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(trackId)

  return { type: 'unavailable', embedUrl: null }
}
