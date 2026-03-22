import { getApiKey, isMockMode } from '../settings/store.js'
import { RateLimiter } from '../utils/rate-limiter.js'

const limiter = new RateLimiter({ perSecond: 1 })

export async function searchYouTube(query: string): Promise<string | null> {
  if (await isMockMode('youtube_key')) {
    // In mock mode, return a placeholder video ID
    return null
  }

  const apiKey = await getApiKey('youtube_key')
  await limiter.wait()

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=id&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) return null

    const json = await res.json() as {
      items?: Array<{ id?: { videoId?: string } }>
    }
    return json.items?.[0]?.id?.videoId ?? null
  } catch {
    return null
  }
}
