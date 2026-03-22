import { useState, useEffect, useCallback } from 'react'

export interface QueueTrack {
  id: number
  title: string
  artistName: string | null
  albumArtUrl: string | null
  youtubeVideoId: string | null
  playbackSource: string | null
  duration: number | null
  reason: string | null
  score: number | null
}

export interface PlaybackState {
  current: QueueTrack | null
  upcoming: QueueTrack[]
  hasNext: boolean
  hasPrev: boolean
  queueLength: number
  queueIndex: number
  isPlaying: boolean
  elapsedSeconds: number
}

export function usePlayback() {
  const [state, setState] = useState<PlaybackState>({
    current: null,
    upcoming: [],
    hasNext: false,
    hasPrev: false,
    queueLength: 0,
    queueIndex: -1,
    isPlaying: false,
    elapsedSeconds: 0,
  })
  const [loading, setLoading] = useState(false)

  const refreshState = useCallback(async () => {
    const data = await window.electron.ipc.invoke('playback:getState') as PlaybackState
    setState((prev) => ({ ...prev, ...data }))
  }, [])

  useEffect(() => {
    // Load initial queue state
    refreshState()

    // Listen for playback events
    const unsubTrack = window.electron.ipc.on('playback:trackChanged', (...args: unknown[]) => {
      const { track } = args[0] as { track: QueueTrack }
      setState((prev) => ({ ...prev, current: track, isPlaying: true }))
      refreshState()
    })
    const unsubPaused = window.electron.ipc.on('playback:paused', () => {
      setState((prev) => ({ ...prev, isPlaying: false }))
    })
    const unsubResumed = window.electron.ipc.on('playback:resumed', () => {
      setState((prev) => ({ ...prev, isPlaying: true }))
    })
    const unsubStopped = window.electron.ipc.on('playback:stopped', () => {
      setState((prev) => ({ ...prev, isPlaying: false }))
    })

    return () => {
      unsubTrack()
      unsubPaused()
      unsubResumed()
      unsubStopped()
    }
  }, [refreshState])

  const play = useCallback(async (trackId: number) => {
    setLoading(true)
    try {
      const result = await window.electron.ipc.invoke('playback:play', trackId) as { success: boolean }
      if (result.success) setState((prev) => ({ ...prev, isPlaying: true }))
    } finally {
      setLoading(false)
    }
  }, [])

  const pause = useCallback(async () => {
    await window.electron.ipc.invoke('playback:pause')
    setState((prev) => ({ ...prev, isPlaying: false }))
  }, [])

  const resume = useCallback(async () => {
    await window.electron.ipc.invoke('playback:resume')
    setState((prev) => ({ ...prev, isPlaying: true }))
  }, [])

  const togglePlay = useCallback(async () => {
    if (state.isPlaying) await pause()
    else if (state.current) await resume()
  }, [state.isPlaying, state.current, pause, resume])

  const next = useCallback(async () => {
    setLoading(true)
    try {
      await window.electron.ipc.invoke('playback:next')
      refreshState()
    } finally {
      setLoading(false)
    }
  }, [refreshState])

  const prev = useCallback(async () => {
    setLoading(true)
    try {
      await window.electron.ipc.invoke('playback:prev')
      refreshState()
    } finally {
      setLoading(false)
    }
  }, [refreshState])

  const loadQueue = useCallback(async (limit = 50) => {
    const tracks = await window.electron.ipc.invoke('playback:loadQueue', limit) as QueueTrack[]
    refreshState()
    return tracks
  }, [refreshState])

  return {
    ...state,
    loading,
    play,
    pause,
    resume,
    togglePlay,
    next,
    prev,
    loadQueue,
    refreshState,
  }
}
