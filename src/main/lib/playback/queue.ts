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

export class PlaybackQueue {
  private tracks: QueueTrack[] = []
  private currentIndex = -1

  load(tracks: QueueTrack[], startIndex = 0) {
    this.tracks = tracks
    this.currentIndex = startIndex
  }

  getCurrent(): QueueTrack | null {
    return this.tracks[this.currentIndex] ?? null
  }

  getNext(): QueueTrack | null {
    return this.tracks[this.currentIndex + 1] ?? null
  }

  getPrev(): QueueTrack | null {
    return this.tracks[this.currentIndex - 1] ?? null
  }

  advance(): QueueTrack | null {
    if (this.currentIndex < this.tracks.length - 1) {
      this.currentIndex++
      return this.getCurrent()
    }
    return null
  }

  back(): QueueTrack | null {
    if (this.currentIndex > 0) {
      this.currentIndex--
      return this.getCurrent()
    }
    return null
  }

  jumpTo(trackId: number): QueueTrack | null {
    const idx = this.tracks.findIndex((t) => t.id === trackId)
    if (idx === -1) return null
    this.currentIndex = idx
    return this.getCurrent()
  }

  getUpcoming(count = 5): QueueTrack[] {
    return this.tracks.slice(this.currentIndex + 1, this.currentIndex + 1 + count)
  }

  getAll(): QueueTrack[] {
    return this.tracks
  }

  getIndex(): number {
    return this.currentIndex
  }

  isEmpty(): boolean {
    return this.tracks.length === 0
  }

  hasNext(): boolean {
    return this.currentIndex < this.tracks.length - 1
  }

  hasPrev(): boolean {
    return this.currentIndex > 0
  }
}

export const globalQueue = new PlaybackQueue()
