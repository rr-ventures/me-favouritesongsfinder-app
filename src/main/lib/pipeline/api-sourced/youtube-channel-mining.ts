import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { upsertMixSource } from '../../db/queries/mix-sources.js'
import { getApiKey, isMockMode } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockData from './_mock-data/youtube-videos.json' assert { type: 'json' }

const YT_BASE = 'https://www.googleapis.com/youtube/v3'
// Be quota-conscious: each playlistItems.list = 1 unit
const limiter = new RateLimiter({ perSecond: 2 })

export class YoutubeChannelMiningStep extends BaseStep {
  name = 'youtube-channel-mining'
  displayName = 'YouTube Channel Mining'
  category = 'api' as const
  description = 'Mines YouTube channel upload playlists for video descriptions. Uses 1 quota unit per page (NOT search.list = 100 units).'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('youtube_key')

    if (mock) {
      yield this.log('warn', 'Mock mode — using built-in YouTube video descriptions')
      const data = mockData as Array<{ video_id: string; title: string; creator_name: string; channel_url: string; description: string }>

      for (let i = 0; i < data.length; i++) {
        if (this.cancelled) return
        const video = data[i]
        if (!options.dryRun) {
          upsertMixSource(db, {
            source_type: 'youtube_mix',
            source_url: `https://www.youtube.com/watch?v=${video.video_id}`,
            title: video.title,
            creator_name: video.creator_name,
            raw_description: video.description,
          })
        }
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}YouTube: "${video.title}"`)
        yield this.progress(((i + 1) / data.length) * 100)
      }
      yield this.complete(`Mock: stored ${data.length} video descriptions for LLM extraction`)
      return
    }

    const apiKey = await getApiKey('youtube_key')
    const channels = db.prepare("SELECT * FROM source_channels WHERE source_type = 'youtube_channel' AND enabled = 1").all() as Array<{ id: number; name: string; url: string }>

    if (channels.length === 0) {
      yield this.warning('No YouTube channels configured. Add channels in Settings > Source Channels.')
      return
    }

    yield this.log('info', `Mining ${channels.length} YouTube channels...`)

    let processed = 0
    for (const channel of channels) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }

      try {
        // Extract channel ID or username from URL
        const channelId = await this.resolveChannelId(channel.url, apiKey)
        if (!channelId) {
          yield this.warning(`Could not resolve channel ID for ${channel.name}`)
          continue
        }

        // Get uploads playlist ID (UC -> UU)
        const uploadsPlaylistId = channelId.startsWith('UC') ? 'UU' + channelId.slice(2) : channelId

        let pageToken: string | undefined
        let videoCount = 0

        do {
          await limiter.wait()
          const url = `${YT_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`
          const res = await fetch(url)
          if (!res.ok) {
            yield this.warning(`YouTube API ${res.status} for ${channel.name}`)
            break
          }

          const json = await res.json() as {
            items?: Array<{ snippet?: { title?: string; description?: string; resourceId?: { videoId: string } } }>
            nextPageToken?: string
          }

          for (const item of json.items ?? []) {
            const snippet = item.snippet
            if (!snippet?.resourceId?.videoId) continue
            if (!options.dryRun) {
              upsertMixSource(db, {
                source_type: 'youtube_mix',
                source_url: `https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`,
                title: snippet.title ?? '',
                creator_name: channel.name,
                raw_description: snippet.description ?? null,
              })
            }
            videoCount++
          }

          pageToken = json.nextPageToken
        } while (pageToken && videoCount < 50)  // Max 50 videos per channel

        processed++
        yield this.itemProcessed(`${channel.name}: ${videoCount} videos`)
        yield this.progress((processed / channels.length) * 100)
      } catch (e) {
        yield this.error(`YouTube mining failed for ${channel.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete(`YouTube: mined ${processed} channels`)
  }

  private async resolveChannelId(url: string, apiKey: string): Promise<string | null> {
    // Try to extract from URL directly
    const channelMatch = url.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/)
    if (channelMatch) return channelMatch[1]

    // Try @handle
    const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/)
    if (handleMatch) {
      try {
        const res = await fetch(`${YT_BASE}/channels?part=id&forHandle=@${handleMatch[1]}&key=${apiKey}`)
        const json = await res.json() as { items?: Array<{ id: string }> }
        return json.items?.[0]?.id ?? null
      } catch { return null }
    }

    return null
  }
}
