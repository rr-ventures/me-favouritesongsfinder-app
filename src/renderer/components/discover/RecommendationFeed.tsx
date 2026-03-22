import React, { useState, useEffect, useCallback, useRef } from 'react'
import TrackCard from './TrackCard'
import LoadingSpinner from '../shared/LoadingSpinner'
import EmptyState from '../onboarding/EmptyState'
import type { QueueTrack } from '../../hooks/usePlayback'

interface TrackWithScore extends QueueTrack {
  score: number | null
  reason: string | null
  isLiked?: boolean
}

interface Props {
  onPlay: (trackId: number) => void
  onLike: (trackId: number) => void
  onSkip: (trackId: number, reason?: string) => void
  currentTrackId: number | null
  isPlaying: boolean
  likedTrackIds: Set<number>
}

const PAGE_SIZE = 50

export default function RecommendationFeed({ onPlay, onLike, onSkip, currentTrackId, isPlaying, likedTrackIds }: Props) {
  const [tracks, setTracks] = useState<TrackWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  const loadTracks = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset
    if (!reset && loadingMore) return

    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      const data = await window.electron.ipc.invoke('db:getTopTracks', PAGE_SIZE, currentOffset) as Array<{
        id: number; title: string; artist_name?: string; album_art_url?: string;
        youtube_video_id?: string; playback_source?: string; duration_seconds?: number;
        recommendation_reason?: string; final_score?: number
      }>

      const newTracks: TrackWithScore[] = data.map((t) => ({
        id: t.id,
        title: t.title,
        artistName: t.artist_name ?? null,
        albumArtUrl: t.album_art_url ?? null,
        youtubeVideoId: t.youtube_video_id ?? null,
        playbackSource: t.playback_source ?? null,
        duration: t.duration_seconds ?? null,
        reason: t.recommendation_reason ?? null,
        score: t.final_score ?? null,
      }))

      if (reset) {
        setTracks(newTracks)
        setOffset(PAGE_SIZE)
      } else {
        setTracks((prev) => [...prev, ...newTracks])
        setOffset(currentOffset + PAGE_SIZE)
      }

      setHasMore(data.length === PAGE_SIZE)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tracks')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [offset, loadingMore])

  useEffect(() => { loadTracks(true) }, [])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadTracks(false)
      }
    })
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadTracks])

  // Reload when tracks are liked/skipped
  const handleLike = (trackId: number) => {
    onLike(trackId)
    setTracks((prev) => prev.map((t) => t.id === trackId ? { ...t, isLiked: !likedTrackIds.has(trackId) } : t))
  }

  const handleSkip = (trackId: number, reason?: string) => {
    onSkip(trackId, reason)
    setTracks((prev) => prev.filter((t) => t.id !== trackId))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-text-muted">
        <LoadingSpinner /> Loading recommendations...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8">
        <EmptyState title="Error loading tracks" description={error} />
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <EmptyState
        title="No tracks yet"
        description="Run the pipeline to start discovering music. Start with Last.fm Artist Expansion + Track Discovery in the Pipeline tab."
        actionLabel="Go to Pipeline"
        actionTo="/pipeline"
      />
    )
  }

  return (
    <div className="space-y-1.5">
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={{ ...track, isLiked: likedTrackIds.has(track.id) }}
          isActive={track.id === currentTrackId}
          isPlaying={track.id === currentTrackId && isPlaying}
          onPlay={onPlay}
          onLike={handleLike}
          onSkip={handleSkip}
        />
      ))}

      {/* Infinite scroll loader */}
      <div ref={loaderRef} className="py-4 flex items-center justify-center">
        {loadingMore && <LoadingSpinner />}
        {!hasMore && tracks.length > 0 && (
          <span className="text-xs text-text-muted">— End of discovery pool —</span>
        )}
      </div>
    </div>
  )
}
