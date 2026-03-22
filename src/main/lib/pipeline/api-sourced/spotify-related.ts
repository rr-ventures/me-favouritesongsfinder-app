import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getSeeds } from '../../db/queries/seed-inputs.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { getApiKey, isMockMode } from '../../settings/store.js'
import { RateLimiter } from '../../utils/rate-limiter.js'
import mockArtists from './_mock-data/lastfm-artists.json' assert { type: 'json' }

const SPOTIFY_BASE = 'https://api.spotify.com/v1'
const limiter = new RateLimiter({ perSecond: 3 })

export class SpotifyRelatedStep extends BaseStep {
  name = 'spotify-related'
  displayName = 'Spotify Related Artists'
  category = 'api' as const
  description = 'Fetches related artists from Spotify for seed artists with spotify_id. Writes new candidate artists.'
  dependsOn: string[] = []
  estimatedCostUsd = 0

  private accessToken: string | null = null
  private tokenExpiry = 0

  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken

    const clientId = await getApiKey('spotify_client_id')
    const clientSecret = await getApiKey('spotify_client_secret')

    if (!clientId || !clientSecret) return null

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    })

    if (!res.ok) return null
    const json = await res.json() as { access_token: string; expires_in: number }
    this.accessToken = json.access_token
    this.tokenExpiry = Date.now() + (json.expires_in - 60) * 1000
    return this.accessToken
  }

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mock = await isMockMode('spotify_client_id')

    if (mock) {
      yield this.log('warn', 'Mock mode — using built-in artist suggestions (no Spotify credentials)')
      const data = (mockArtists as Array<{ name: string; lastfm_url: string; similarity_score: number }>).slice(5, 15)
      for (let i = 0; i < data.length; i++) {
        if (this.cancelled) return
        if (!options.dryRun) upsertArtist(db, { name: data[i].name, lastfm_url: data[i].lastfm_url })
        yield this.itemProcessed(`${options.dryRun ? '[DRY] ' : ''}Spotify suggestion: ${data[i].name}`)
        yield this.progress(((i + 1) / data.length) * 100)
      }
      yield this.complete(`Mock: ${data.length} related artists`)
      return
    }

    const token = await this.getAccessToken()
    if (!token) {
      yield this.warning('Could not get Spotify access token. Check client ID and secret in Settings.')
      return
    }

    const seeds = getSeeds(db, 'artist')
    yield this.log('info', `Finding Spotify related artists for ${seeds.length} seeds...`)

    let processed = 0
    for (const seed of seeds) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      await limiter.wait()

      try {
        // Search for artist first
        const searchRes = await fetch(`${SPOTIFY_BASE}/search?q=${encodeURIComponent(seed.input_value)}&type=artist&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!searchRes.ok) continue

        const searchJson = await searchRes.json() as { artists?: { items?: Array<{ id: string; name: string }> } }
        const spotifyArtist = searchJson.artists?.items?.[0]
        if (!spotifyArtist) continue

        await limiter.wait()
        const relatedRes = await fetch(`${SPOTIFY_BASE}/artists/${spotifyArtist.id}/related-artists`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!relatedRes.ok) continue

        const relatedJson = await relatedRes.json() as { artists?: Array<{ id: string; name: string }> }
        const related = relatedJson.artists ?? []

        for (const a of related) {
          if (!options.dryRun) upsertArtist(db, { name: a.name, spotify_id: a.id })
        }

        processed++
        yield this.itemProcessed(`${seed.input_value}: ${related.length} Spotify related artists`)
        yield this.progress((processed / seeds.length) * 100)
      } catch (e) {
        yield this.error(`Spotify failed for ${seed.input_value}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    yield this.complete(`Spotify: found related artists for ${processed} seeds`)
  }
}
