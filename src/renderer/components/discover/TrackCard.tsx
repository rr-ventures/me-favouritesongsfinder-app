import React, { useState } from 'react'
import type { QueueTrack } from '../../hooks/usePlayback'

interface Props {
  track: QueueTrack & {
    score?: number | null
    reason?: string | null
    isLiked?: boolean
  }
  isPlaying?: boolean
  isActive?: boolean
  onPlay: (trackId: number) => void
  onLike: (trackId: number) => void
  onSkip: (trackId: number, reason?: string) => void
  onAddToPlaylist?: (trackId: number) => void
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  )
}

function EqBars() {
  return (
    <div className="flex items-end gap-0.5" style={{ height: 14 }}>
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
    </div>
  )
}

function MusicDisc({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill="var(--bg-surface)" />
      <circle cx="20" cy="20" r="8" fill="var(--bg-hover)" />
      <circle cx="20" cy="20" r="3" fill="var(--bg-elevated)" />
      <path d="M20 4 A16 16 0 0 1 36 20" stroke="var(--border-light)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ScorePill({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'var(--status-success)' : pct >= 50 ? 'var(--accent-light)' : pct >= 30 ? 'var(--status-warning)' : 'var(--text-muted)'
  return (
    <span
      className="text-2xs font-bold tabular-nums px-1.5 py-0.5 rounded-full"
      style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${color}22`, color }}
    >
      {pct}
    </span>
  )
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TrackCard({ track, isPlaying, isActive, onPlay, onLike, onSkip, onAddToPlaylist }: Props) {
  const [imgError, setImgError] = useState(false)

  const bg = isActive
    ? 'rgba(124,106,247,0.08)'
    : 'transparent'

  const borderLeft = isActive
    ? '3px solid var(--accent)'
    : '3px solid transparent'

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg group relative transition-colors cursor-default"
      style={{
        background: bg,
        borderLeft,
        paddingLeft: isActive ? 'calc(0.75rem - 3px)' : '0.75rem',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = bg
      }}
    >
      {/* Album art / play button */}
      <div className="relative shrink-0" style={{ width: 48, height: 48 }}>
        <div
          className="w-full h-full rounded-md overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)' }}
        >
          {track.albumArtUrl && !imgError ? (
            <img
              src={track.albumArtUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <MusicDisc size={48} />
          )}
        </div>

        {/* Eq bars when active, play/pause on hover */}
        {isActive && !isPlaying ? null : isActive && isPlaying ? (
          <div
            className="absolute inset-0 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => onPlay(track.id)}
          >
            <PauseIcon />
          </div>
        ) : (
          <div
            className="absolute inset-0 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => onPlay(track.id)}
          >
            <PlayIcon />
          </div>
        )}

        {/* Eq indicator — bottom-right when playing */}
        {isActive && isPlaying && (
          <div
            className="absolute bottom-1 right-1 flex items-end gap-px"
            style={{ pointerEvents: 'none' }}
          >
            <EqBars />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium truncate"
            style={{ color: isActive ? 'var(--accent-light)' : 'var(--text-primary)' }}
          >
            {track.title}
          </span>
          {track.youtubeVideoId && (
            <span
              className="text-2xs px-1 rounded shrink-0 font-semibold"
              style={{ background: 'rgba(255,0,0,0.12)', color: '#ff4d4d' }}
            >
              YT
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
          {track.artistName ?? 'Unknown artist'}
        </div>
        {track.reason && (
          <div className="text-2xs mt-0.5 truncate italic" style={{ color: 'var(--text-muted)' }}>
            {track.reason}
          </div>
        )}
      </div>

      {/* Score pill */}
      {track.score != null && (
        <div className="shrink-0">
          <ScorePill score={track.score} />
        </div>
      )}

      {/* Duration */}
      {track.duration && (
        <span className="text-xs shrink-0 tabular-nums" style={{ color: 'var(--text-muted)', minWidth: 34, textAlign: 'right' }}>
          {formatDuration(track.duration)}
        </span>
      )}

      {/* Action buttons — always visible, not opacity-0 */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onLike(track.id) }}
          title={track.isLiked ? 'Unlike' : 'Like'}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: track.isLiked ? '#e5534b' : 'var(--text-muted)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={track.isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onSkip(track.id) }}
          title="Not interested"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {onAddToPlaylist && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(track.id) }}
            title="Add to playlist"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
