import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { usePlayback } from '../hooks/usePlayback'
import RecommendationFeed from '../components/discover/RecommendationFeed'
import ErrorToast from '../components/shared/ErrorToast'

interface DiscoverStats {
  trackCount: number
  scoredCount: number
  artistCount: number
  avgScore: number
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="1,4 1,10 7,10" />
      <polyline points="23,20 23,14 17,14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  )
}

export default function DiscoverPage() {
  const { current, isPlaying, play, loadQueue } = usePlayback()
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set())
  const [toastError, setToastError] = useState<string | null>(null)
  const [stats, setStats] = useState<DiscoverStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(() => {
    window.electron.ipc.invoke('db:getStats').then((s) => {
      setStats(s as DiscoverStats)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadStats()
    window.electron.ipc.invoke('db:getLikedTrackIds').then((ids) => {
      setLikedTrackIds(new Set(ids as number[]))
    })
    loadQueue()
  }, [loadQueue, loadStats])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadQueue()
    loadStats()
    setRefreshing(false)
  }, [loadQueue, loadStats])

  const handlePlay = useCallback(async (trackId: number) => {
    try {
      await play(trackId)
    } catch (e) {
      setToastError(e instanceof Error ? e.message : 'Playback error')
    }
  }, [play])

  const handleLike = useCallback(async (trackId: number) => {
    try {
      if (likedTrackIds.has(trackId)) {
        await window.electron.ipc.invoke('db:unlikeTrack', trackId)
        setLikedTrackIds((prev) => { const next = new Set(prev); next.delete(trackId); return next })
      } else {
        await window.electron.ipc.invoke('db:likeTrack', trackId)
        setLikedTrackIds((prev) => new Set([...prev, trackId]))
      }
    } catch {
      setToastError('Failed to update like')
    }
  }, [likedTrackIds])

  const handleSkip = useCallback(async (trackId: number, reason?: string) => {
    try {
      await window.electron.ipc.invoke('db:recordFeedback', trackId, 'skip', reason ?? 'user_skip')
    } catch {
      // Ignore
    }
  }, [])

  const hasTracks = stats && (stats.trackCount > 0 || stats.scoredCount > 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Hero gradient header ── */}
      <div
        className="shrink-0 relative overflow-hidden px-6 pt-10 pb-6"
        style={{
          background: 'linear-gradient(180deg, rgba(124,106,247,0.22) 0%, rgba(124,106,247,0.06) 60%, transparent 100%)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Ambient glow blob */}
        <div
          aria-hidden
          className="absolute top-0 left-1/4 w-64 h-32 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(124,106,247,0.20) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />

        <div className="relative">
          <div className="flex items-end justify-between">
            <div>
              <h1
                className="font-black leading-none"
                style={{ fontSize: 36, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}
              >
                Discover
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {stats?.scoredCount
                  ? `${stats.scoredCount.toLocaleString()} tracks ranked by taste`
                  : stats?.trackCount
                  ? `${stats.trackCount.toLocaleString()} tracks collected — run Score Calculation to rank`
                  : 'Run the pipeline to start discovering music'}
              </p>

              {/* Stats strip */}
              {stats && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {stats.artistCount > 0 && (
                    <StatChip label="Artists" value={stats.artistCount.toLocaleString()} />
                  )}
                  {stats.trackCount > 0 && (
                    <StatChip label="Tracks" value={stats.trackCount.toLocaleString()} />
                  )}
                  {stats.scoredCount > 0 && (
                    <StatChip label="Scored" value={stats.scoredCount.toLocaleString()} />
                  )}
                  {stats.avgScore > 0 && (
                    <StatChip label="Avg score" value={`${Math.round(stats.avgScore * 100)}`} />
                  )}
                </div>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className={refreshing ? 'animate-spin-slow' : ''}>
                <RefreshIcon />
              </span>
              Refresh
            </button>
          </div>

          {/* No-data CTA */}
          {!hasTracks && (
            <div
              className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(124,106,247,0.10)', border: '1px solid rgba(124,106,247,0.20)' }}
            >
              <PipelineIcon />
              <span style={{ color: 'var(--text-secondary)' }}>
                No tracks yet.{' '}
                <Link to="/pipeline" className="underline font-medium" style={{ color: 'var(--accent-light)' }}>
                  Run the pipeline
                </Link>{' '}
                to collect music, then come back here.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Track feed ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <RecommendationFeed
          onPlay={handlePlay}
          onLike={handleLike}
          onSkip={handleSkip}
          currentTrackId={current?.id ?? null}
          isPlaying={isPlaying}
          likedTrackIds={likedTrackIds}
        />
      </div>

      {toastError && (
        <ErrorToast message={toastError} onDismiss={() => setToastError(null)} />
      )}
    </div>
  )
}
