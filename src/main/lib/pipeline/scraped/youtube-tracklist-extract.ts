import fs from 'node:fs'
import path from 'node:path'
import { BaseStep } from '../base-step.js'
import type { PipelineEvent, RunOptions } from '../types.js'
import { getDb } from '../../db/connection.js'
import { getMixSourcesWithDescriptions, linkTrackToMix } from '../../db/queries/mix-sources.js'
import { upsertArtist } from '../../db/queries/artists.js'
import { upsertTrack } from '../../db/queries/tracks.js'
import { callLlm, parseJsonFromLlm } from '../../utils/llm-client.js'
import { parseArtistTitle } from '../../utils/name-normalizer.js'

const TRACKLIST_REGEX = /(\d{1,3}[:.]?\s+)?([\w\s&'.,-]+?)\s*[-–—]\s*([\w\s&'.,!?]+?)(?:\s*\n|$)/gm

interface ExtractedTrack {
  artist: string
  title: string
  timestamp: string | null
  confidence: number
}

export class YoutubeTracklistExtractStep extends BaseStep {
  name = 'youtube-tracklist-extract'
  displayName = 'YouTube Tracklist Extract'
  category = 'scraped' as const
  description = 'Sends YouTube video descriptions to Claude/Gemini to extract tracklists. Fallback: regex extraction (low confidence).'
  dependsOn = ['youtube-channel-mining']
  estimatedCostUsd = 0.5

  private loadPrompt(): string {
    const candidates = [
      path.join(process.env.APP_ROOT ?? '', 'src/main/lib/pipeline/scraped/_prompts/extract-tracklist.txt'),
      path.join(__dirname, '_prompts/extract-tracklist.txt'),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8')
    }
    return 'Extract a JSON tracklist array with {artist, title, timestamp, confidence} from: {{DESCRIPTION}}'
  }

  async *run(options: RunOptions): AsyncGenerator<PipelineEvent> {
    this.cancelled = false
    const db = getDb()
    const mixes = getMixSourcesWithDescriptions(db)

    if (mixes.length === 0) {
      yield this.warning('No mix descriptions found. Run YouTube Channel Mining first.')
      return
    }

    yield this.log('info', `Extracting tracklists from ${mixes.length} YouTube descriptions...`)
    const promptTemplate = this.loadPrompt()
    let totalCost = 0
    let totalTracks = 0

    for (let i = 0; i < mixes.length; i++) {
      if (this.cancelled) { yield this.warning('Cancelled'); return }
      const mix = mixes[i]
      if (!mix.raw_description) continue

      const prompt = promptTemplate.replace('{{DESCRIPTION}}', mix.raw_description.slice(0, 3000))
      let tracks: ExtractedTrack[] = []
      let usedLlm = false

      if (!options.dryRun) {
        const result = await callLlm(prompt, { stepName: this.name })
        if (result) {
          usedLlm = true
          totalCost += result.costUsd
          yield this.costUpdate(result.model, result.inputTokens, result.outputTokens, result.costUsd)
          tracks = parseJsonFromLlm<ExtractedTrack[]>(result.text) ?? []
        }
      }

      // Regex fallback
      if (tracks.length === 0) {
        tracks = this.regexExtract(mix.raw_description)
        if (tracks.length > 0) {
          yield this.warning(`Used regex fallback for "${mix.title}" — ${tracks.length} tracks (low confidence)`)
        }
      }

      for (const track of tracks) {
        if (!track.artist || !track.title || track.confidence < 0.4) continue
        if (!options.dryRun) {
          const artist = upsertArtist(db, { name: track.artist })
          const trackRecord = upsertTrack(db, { title: track.title, artist_id: artist.id })
          linkTrackToMix(db, mix.id, trackRecord.id)
        }
        totalTracks++
      }

      yield this.itemProcessed(`"${mix.title}": ${tracks.length} tracks extracted (${usedLlm ? 'LLM' : 'regex'})`)
      yield this.progress(((i + 1) / mixes.length) * 100)
    }

    yield this.complete(`Extracted ${totalTracks} tracks from ${mixes.length} descriptions. Total cost: $${totalCost.toFixed(3)}`)
  }

  private regexExtract(description: string): ExtractedTrack[] {
    const tracks: ExtractedTrack[] = []
    const seen = new Set<string>()
    const lines = description.split('\n')

    for (const line of lines) {
      const parsed = parseArtistTitle(line.replace(/^\d+[.:\s]+/, '').trim())
      if (parsed && !seen.has(`${parsed.artist}|${parsed.title}`)) {
        seen.add(`${parsed.artist}|${parsed.title}`)
        tracks.push({ artist: parsed.artist, title: parsed.title, timestamp: null, confidence: 0.5 })
      }
    }

    return tracks
  }
}
