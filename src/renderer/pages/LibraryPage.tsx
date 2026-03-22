import React, { useState, useEffect, useCallback } from 'react'
import PlaylistList from '../components/library/PlaylistList'
import PlaylistDetail from '../components/library/PlaylistDetail'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import { usePlayback } from '../hooks/usePlayback'

interface Playlist {
  id: number
  name: string
  description: string | null
  track_count?: number
  created_at: string
}

export default function LibraryPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(1)  // Default to Liked Songs
  const [loading, setLoading] = useState(true)
  const { current, isPlaying, play } = usePlayback()

  const refresh = useCallback(async () => {
    const data = await window.electron.ipc.invoke('db:getPlaylists') as Playlist[]
    setPlaylists(data)
    setLoading(false)
    // Auto-select Liked Songs if nothing selected
    if (!selectedId && data.length > 0) setSelectedId(data[0].id)
  }, [selectedId])

  useEffect(() => { refresh() }, [])

  const handleCreate = useCallback(async (name: string) => {
    await window.electron.ipc.invoke('db:createPlaylist', name)
    await refresh()
  }, [refresh])

  const handleDelete = useCallback(async (id: number) => {
    if (id === 1) return  // Protect Liked Songs
    await window.electron.ipc.invoke('db:deletePlaylist', id)
    if (selectedId === id) setSelectedId(playlists[0]?.id ?? null)
    await refresh()
  }, [selectedId, playlists, refresh])

  const handleRemoveTrack = useCallback(async (playlistId: number, trackId: number) => {
    if (playlistId === 1) {
      await window.electron.ipc.invoke('db:unlikeTrack', trackId)
    } else {
      await window.electron.ipc.invoke('db:removeTrackFromPlaylist', playlistId, trackId)
    }
  }, [])

  const selected = playlists.find((p) => p.id === selectedId)

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-text-muted">
        <LoadingSpinner /> Loading library...
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-border py-4 px-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider px-3 mb-3">Library</div>
        <PlaylistList
          playlists={playlists}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <>
            <div className="mb-5">
              <div className="flex items-center gap-3">
                {selected.id === 1 && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#f87171" stroke="none">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                )}
                <h1 className="text-2xl font-bold text-text-primary">{selected.name}</h1>
              </div>
              {selected.description && (
                <p className="text-text-secondary text-sm mt-1">{selected.description}</p>
              )}
            </div>
            <PlaylistDetail
              key={selected.id}
              playlistId={selected.id}
              playlistName={selected.name}
              onPlay={play}
              onRemove={handleRemoveTrack}
              currentTrackId={current?.id ?? null}
              isPlaying={isPlaying}
            />
          </>
        ) : (
          <div className="py-16 text-center text-text-muted">
            <p>Select a playlist to view its tracks.</p>
          </div>
        )}
      </main>
    </div>
  )
}
