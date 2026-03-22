import { useCallback } from 'react'

export function useDatabase() {
  const invoke = useCallback(<T>(channel: string, ...args: unknown[]): Promise<T> => {
    return window.electron.ipc.invoke(channel, ...args) as Promise<T>
  }, [])

  return {
    // Artists
    getArtists: () => invoke('db:getArtists'),
    getSeedArtists: () => invoke('db:getSeedArtists'),
    upsertArtist: (data: unknown) => invoke('db:upsertArtist', data),
    deleteArtist: (id: number) => invoke('db:deleteArtist', id),

    // Tracks
    getTracks: (limit?: number, offset?: number) => invoke('db:getTracks', limit, offset),
    getTopTracks: (limit?: number, offset?: number) => invoke('db:getTopTracks', limit, offset),
    searchTracks: (query: string) => invoke('db:searchTracks', query),
    updateYouTubeVideoId: (trackId: number, videoId: string) => invoke('db:updateYouTubeVideoId', trackId, videoId),

    // Feedback
    recordFeedback: (trackId: number, action: string, skipReason?: string) =>
      invoke('db:recordFeedback', trackId, action, skipReason),
    getLikedTrackIds: () => invoke<number[]>('db:getLikedTrackIds'),
    getDislikedArtistIds: () => invoke<number[]>('db:getDislikedArtistIds'),

    // Playlists
    getPlaylists: () => invoke('db:getPlaylists'),
    createPlaylist: (name: string, description?: string) => invoke('db:createPlaylist', name, description),
    deletePlaylist: (id: number) => invoke('db:deletePlaylist', id),
    getPlaylistTracks: (playlistId: number) => invoke('db:getPlaylistTracks', playlistId),
    likeTrack: (trackId: number) => invoke('db:likeTrack', trackId),
    unlikeTrack: (trackId: number) => invoke('db:unlikeTrack', trackId),
    addTrackToPlaylist: (playlistId: number, trackId: number) => invoke('db:addTrackToPlaylist', playlistId, trackId),
    removeTrackFromPlaylist: (playlistId: number, trackId: number) => invoke('db:removeTrackFromPlaylist', playlistId, trackId),

    // Scores
    getSignalScores: (trackId: number) => invoke('db:getSignalScores', trackId),
    getCompositeScore: (trackId: number) => invoke('db:getCompositeScore', trackId),
    getTopRanked: (limit?: number, offset?: number) => invoke('db:getTopRanked', limit, offset),
    getSignalWeights: () => invoke('db:getSignalWeights'),

    // Seeds
    getSeeds: (inputType?: string) => invoke('db:getSeeds', inputType),
    addSeed: (inputType: string, inputValue: string) => invoke('db:addSeed', inputType, inputValue),
    removeSeed: (id: number) => invoke('db:removeSeed', id),

    // Taste descriptors
    getTasteDescriptors: () => invoke('db:getTasteDescriptors'),
    addTasteDescriptor: (descriptor: string, weight?: number) => invoke('db:addTasteDescriptor', descriptor, weight),
    removeTasteDescriptor: (id: number) => invoke('db:removeTasteDescriptor', id),

    // Source channels
    getSourceChannels: (sourceType?: string) => invoke('db:getSourceChannels', sourceType),
    addSourceChannel: (data: { source_type: string; name: string; url: string; notes?: string }) =>
      invoke('db:addSourceChannel', data),
    removeSourceChannel: (id: number) => invoke('db:removeSourceChannel', id),
    toggleSourceChannel: (id: number, enabled: boolean) => invoke('db:toggleSourceChannel', id, enabled),

    // DB stats
    getStats: () => invoke<{ artistCount: number; trackCount: number; scoredCount: number; avgScore: number }>('db:getStats'),
  }
}
