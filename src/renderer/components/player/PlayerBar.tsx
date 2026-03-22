import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePlayback } from '../../hooks/usePlayback'

function formatTime(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ---------- Icons ----------

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  )
}
function PrevIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="19,3 10,12 19,21" />
      <rect x="5" y="3" width="3" height="18" rx="1" />
    </svg>
  )
}
function NextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 14,12 5,21" />
      <rect x="16" y="3" width="3" height="18" rx="1" />
    </svg>
  )
}
function HeartIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#e5534b">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
function VolumeIcon({ level }: { level: number }) {
  if (level === 0) return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
      <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
  if (level < 0.5) return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}
function MusicNoteSmall() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

// Animated equalizer bars — shown when a track is playing
function EqBars() {
  return (
    <div className="flex items-end gap-0.5" style={{ height: 14 }}>
      <span className="eq-bar" style={{ height: 4 }} />
      <span className="eq-bar" style={{ height: 10 }} />
      <span className="eq-bar" style={{ height: 6 }} />
    </div>
  )
}

// Seek bar component
interface SeekBarProps {
  elapsed: number
  duration: number | null | undefined
  onSeek: (seconds: number) => void
}

function SeekBar({ elapsed, duration, onSeek }: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragValue, setDragValue] = useState(0)

  const total = duration ?? 0
  const progress = total > 0 ? Math.min((dragging ? dragValue : elapsed) / total, 1) : 0

  const calcValue = useCallback((clientX: number) => {
    const bar = barRef.current
    if (!bar || total === 0) return 0
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * total
  }, [total])

  function onMouseDown(e: React.MouseEvent) {
    if (total === 0) return
    setDragging(true)
    const v = calcValue(e.clientX)
    setDragValue(v)

    const onMove = (me: MouseEvent) => setDragValue(calcValue(me.clientX))
    const onUp = (me: MouseEvent) => {
      onSeek(calcValue(me.clientX))
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-2xs tabular-nums shrink-0" style={{ color: 'var(--text-muted)', minWidth: 32, textAlign: 'right' }}>
        {formatTime(elapsed)}
      </span>
      <div ref={barRef} className="seek-bar flex-1" onMouseDown={onMouseDown}>
        <div className="seek-bar-fill" style={{ width: `${progress * 100}%` }} />
        <div className="seek-bar-thumb" style={{ left: `${progress * 100}%` }} />
      </div>
      <span className="text-2xs tabular-nums shrink-0" style={{ color: 'var(--text-muted)', minWidth: 32 }}>
        {formatTime(duration)}
      </span>
    </div>
  )
}

// Volume slider
function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const barRef = useRef<HTMLDivElement>(null)

  function onMouseDown(e: React.MouseEvent) {
    const bar = barRef.current
    if (!bar) return
    const calc = (cx: number) => {
      const rect = bar.getBoundingClientRect()
      return Math.max(0, Math.min(1, (cx - rect.left) / rect.width))
    }
    onChange(calc(e.clientX))
    const onMove = (me: MouseEvent) => onChange(calc(me.clientX))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div ref={barRef} className="seek-bar w-24" onMouseDown={onMouseDown} style={{ cursor: 'pointer' }}>
      <div className="seek-bar-fill" style={{ width: `${value * 100}%` }} />
      <div className="seek-bar-thumb" style={{ left: `${value * 100}%` }} />
    </div>
  )
}

export default function PlayerBar() {
  const { current, isPlaying, hasNext, hasPrev, loading, togglePlay, next, prev } = usePlayback()

  const [elapsed, setElapsed] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Elapsed time ticker
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1)
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying])

  // Reset elapsed when track changes
  useEffect(() => {
    setElapsed(0)
    if (current?.id) {
      window.electron.ipc.invoke('db:getLikedTrackIds').then((ids) => {
        setIsLiked((ids as number[]).includes(current.id))
      }).catch(() => {})
    }
  }, [current?.id])

  async function handleSeek(seconds: number) {
    setElapsed(Math.floor(seconds))
    await window.electron.ipc.invoke('playback:seek', seconds)
  }

  async function handleLikeToggle() {
    if (!current) return
    if (isLiked) {
      await window.electron.ipc.invoke('db:unlikeTrack', current.id)
      setIsLiked(false)
    } else {
      await window.electron.ipc.invoke('db:likeTrack', current.id)
      setIsLiked(true)
    }
  }

  const hasTrack = !!current

  return (
    <div
      className="flex items-center h-full px-4"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      {/* ── Left: Track info (1/3) ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0" style={{ maxWidth: '30%' }}>
        {/* Album art / placeholder */}
        <div
          className="shrink-0 rounded flex items-center justify-center overflow-hidden"
          style={{
            width: 52,
            height: 52,
            background: hasTrack ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {current?.albumArtUrl ? (
            <img src={current.albumArtUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              {isPlaying ? <EqBars /> : <MusicNoteSmall />}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {current ? (
            <>
              <div className="text-sm font-semibold text-white truncate leading-tight">{current.title}</div>
              <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {current.artistName ?? 'Unknown artist'}
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing playing</div>
          )}
        </div>

        {/* Like button */}
        <button
          onClick={handleLikeToggle}
          disabled={!hasTrack}
          className="shrink-0 p-1.5 rounded transition-all disabled:opacity-30"
          style={{ color: isLiked ? '#e5534b' : 'var(--text-muted)' }}
          title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        >
          <HeartIcon filled={isLiked} />
        </button>
      </div>

      {/* ── Center: Controls + Scrubber (1/3) ── */}
      <div className="flex flex-col items-center gap-1.5 flex-1" style={{ maxWidth: '40%' }}>
        {/* Playback controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={prev}
            disabled={!hasPrev || loading}
            className="p-1.5 rounded-full transition-all disabled:opacity-30 hover:scale-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            <PrevIcon />
          </button>

          <button
            onClick={togglePlay}
            disabled={!hasTrack || loading}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
            style={{
              background: hasTrack ? 'white' : 'var(--bg-elevated)',
              color: hasTrack ? '#000' : 'var(--text-muted)',
              boxShadow: hasTrack ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            onClick={next}
            disabled={!hasNext || loading}
            className="p-1.5 rounded-full transition-all disabled:opacity-30 hover:scale-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            <NextIcon />
          </button>
        </div>

        {/* Seek bar */}
        <SeekBar
          elapsed={elapsed}
          duration={current?.duration}
          onSeek={handleSeek}
        />
      </div>

      {/* ── Right: Volume + extras (1/3) ── */}
      <div className="flex items-center justify-end gap-3 flex-1" style={{ maxWidth: '30%' }}>
        {/* YouTube badge */}
        {current?.youtubeVideoId && (
          <div
            className="text-2xs px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0"
            style={{ background: 'rgba(255,0,0,0.15)', color: '#ff4d4d', letterSpacing: '0.05em' }}
          >
            YT
          </div>
        )}

        {/* Reason */}
        {current?.reason && (
          <div className="text-2xs truncate hidden xl:block" style={{ color: 'var(--text-muted)', maxWidth: 180, fontStyle: 'italic' }}>
            {current.reason}
          </div>
        )}

        {/* Volume */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setVolume((v) => v === 0 ? 0.8 : 0)}
            className="transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <VolumeIcon level={volume} />
          </button>
          <VolumeSlider value={volume} onChange={setVolume} />
        </div>
      </div>
    </div>
  )
}
