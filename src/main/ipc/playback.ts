import { ipcMain, BrowserWindow, WebContentsView } from 'electron'
import { resolvePlayback } from '../lib/playback/resolver.js'
import { globalQueue } from '../lib/playback/queue.js'
import { getDb } from '../lib/db/connection.js'
import { getTopRankedTracks } from '../lib/db/queries/tracks.js'
import { setPreference, getPreference } from '../lib/settings/store.js'
import { logger } from '../lib/utils/logger.js'

const PLAYERBAR_HEIGHT = 90

let playerView: WebContentsView | null = null
let currentEmbedUrl: string | null = null

export function setPlayerView(view: WebContentsView) {
  playerView = view
}

function sendToPlayer(js: string) {
  if (!playerView || !currentEmbedUrl) return
  playerView.webContents.executeJavaScript(js).catch(() => {})
}

function sendToRenderer(channel: string, data: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  })
}

export function registerPlaybackHandlers() {
  // Load top tracks into queue
  ipcMain.handle('playback:loadQueue', async (_event, limit = 50, offset = 0) => {
    const db = getDb()
    const tracks = getTopRankedTracks(db, limit, offset)

    const queueTracks = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artist_name ?? null,
      albumArtUrl: t.album_art_url ?? null,
      youtubeVideoId: t.youtube_video_id ?? null,
      playbackSource: t.playback_source ?? null,
      duration: t.duration_seconds ?? null,
      reason: null,
      score: null,
    }))

    globalQueue.load(queueTracks)
    return queueTracks
  })

  // Play a specific track
  ipcMain.handle('playback:play', async (_event, trackId: number) => {
    const resolution = await resolvePlayback(trackId)

    if (resolution.type === 'unavailable' || !resolution.embedUrl) {
      sendToRenderer('playback:unavailable', { trackId })
      return { success: false, reason: 'unavailable' }
    }

    currentEmbedUrl = resolution.embedUrl

    if (playerView) {
      await playerView.webContents.loadURL(resolution.embedUrl)
    }

    // Save last track for session restore
    await setPreference('lastTrackId', trackId)

    globalQueue.jumpTo(trackId)
    const current = globalQueue.getCurrent()
    sendToRenderer('playback:trackChanged', { track: current, resolution })

    return { success: true, resolution }
  })

  // Pause/resume via postMessage to YouTube IFrame
  ipcMain.handle('playback:pause', async () => {
    sendToPlayer(`window.postMessage(JSON.stringify({event: 'command', func: 'pauseVideo', args: []}), '*')`)
    sendToRenderer('playback:paused', {})
    return { success: true }
  })

  ipcMain.handle('playback:resume', async () => {
    sendToPlayer(`window.postMessage(JSON.stringify({event: 'command', func: 'playVideo', args: []}), '*')`)
    sendToRenderer('playback:resumed', {})
    return { success: true }
  })

  ipcMain.handle('playback:stop', async () => {
    sendToPlayer(`window.postMessage(JSON.stringify({event: 'command', func: 'stopVideo', args: []}), '*')`)
    currentEmbedUrl = null
    sendToRenderer('playback:stopped', {})
    return { success: true }
  })

  ipcMain.handle('playback:seek', async (_event, seconds: number) => {
    sendToPlayer(`window.postMessage(JSON.stringify({event: 'command', func: 'seekTo', args: [${seconds}, true]}), '*')`)
    return { success: true }
  })

  // Skip to next
  ipcMain.handle('playback:next', async () => {
    const next = globalQueue.advance()
    if (!next) return { success: false, reason: 'end of queue' }
    const resolution = await resolvePlayback(next.id)
    if (resolution.embedUrl && playerView) {
      currentEmbedUrl = resolution.embedUrl
      await playerView.webContents.loadURL(resolution.embedUrl)
    }
    sendToRenderer('playback:trackChanged', { track: next, resolution })
    return { success: true, track: next }
  })

  // Previous track
  ipcMain.handle('playback:prev', async () => {
    const prev = globalQueue.back()
    if (!prev) return { success: false, reason: 'start of queue' }
    const resolution = await resolvePlayback(prev.id)
    if (resolution.embedUrl && playerView) {
      currentEmbedUrl = resolution.embedUrl
      await playerView.webContents.loadURL(resolution.embedUrl)
    }
    sendToRenderer('playback:trackChanged', { track: prev, resolution })
    return { success: true, track: prev }
  })

  // Get current playback state
  ipcMain.handle('playback:getState', async () => {
    return {
      current: globalQueue.getCurrent(),
      upcoming: globalQueue.getUpcoming(5),
      hasNext: globalQueue.hasNext(),
      hasPrev: globalQueue.hasPrev(),
      queueLength: globalQueue.getAll().length,
      queueIndex: globalQueue.getIndex(),
    }
  })

  // Get queue
  ipcMain.handle('playback:getQueue', async () => {
    return {
      tracks: globalQueue.getAll(),
      currentIndex: globalQueue.getIndex(),
    }
  })

  // Resolve playback without playing (for preloading)
  ipcMain.handle('playback:resolve', async (_event, trackId: number) => {
    return resolvePlayback(trackId)
  })

  // Update YouTube video ID manually (right-click correction)
  ipcMain.handle('playback:setVideoId', async (_event, trackId: number, videoId: string) => {
    const db = getDb()
    db.prepare("UPDATE tracks SET youtube_video_id = ?, playback_source = 'youtube', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(videoId, trackId)
    return { success: true }
  })

  // Session restore
  ipcMain.handle('playback:getLastTrack', async () => {
    const lastTrackId = await getPreference('lastTrackId')
    if (!lastTrackId) return null

    const db = getDb()
    const track = db.prepare(`
      SELECT t.*, a.name as artist_name, cs.recommendation_reason as reason, cs.final_score as score
      FROM tracks t
      LEFT JOIN artists a ON a.id = t.artist_id
      LEFT JOIN composite_scores cs ON cs.track_id = t.id
      WHERE t.id = ?
    `).get(lastTrackId) as unknown | null

    return track
  })
}
