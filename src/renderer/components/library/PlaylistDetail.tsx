import React, { useState, useEffect } from 'react'
import TrackCard from '../discover/TrackCard'
import LoadingSpinner from '../shared/LoadingSpinner'
import type { QueueTrack } from '../../hooks/usePlayback'

interface PlaylistTrack {
  id: number
  title: string
  artist_name: string | null
  youtube_video_id: string | null
  playback_source: string | null
  duration_seconds: number | null
  added_at: string
}

interface Props {
  playlistId: number
  playlistName: string
  onPlay: (trackId: number) => void
  onRemove: (playlistId: number, trackId: number) => Promise<void>
  currentTrackId: number | null
  isPlaying: boolean
}

export default function PlaylistDetail({ playlistId, playlistName, onPlay, onRemove, currentTrackId, isPlaying }: Props) {
  const [tracks, setTracks] = useState<PlaylistTrack[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const data = await window.electron.ipc.invoke('db:getPlaylistTracks', playlistId) as PlaylistTrack[]
    setTracks(data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [playlistId])

  if (loading) {
    return <div className="flex items-center gap-2 p-4 text-text-muted text-sm"><LoadingSpinner size={16} /> Loading...</div>
  }

  if (tracks.length === 0) {
    return (
      <div className="py-12 text-center text-text-muted text-sm">
        <p className="mb-1 font-medium">{playlistName} is empty</p>
        <p>Like tracks on the Discover page to add them here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-text-muted mb-3">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</div>
      {tracks.map((track) => {
        const qTrack: QueueTrack = {
          id: track.id,
          title: track.title,
          artistName: track.artist_name,
          albumArtUrl: null,
          youtubeVideoId: track.youtube_video_id,
          playbackSource: track.playback_source,
          duration: track.duration_seconds,
          reason: null,
          score: null,
        }
        return (
          <TrackCard
            key={track.id}
            track={qTrack}
            isActive={track.id === currentTrackId}
            isPlaying={track.id === currentTrackId && isPlaying}
            onPlay={onPlay}
            onLike={() => {}}
            onSkip={() => onRemove(playlistId, track.id).then(refresh)}
          />
        )
      })}
    </div>
  )
}
