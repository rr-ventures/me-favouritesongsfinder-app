import type { PipelineStep } from './types.js'

class StepRegistry {
  private steps = new Map<string, PipelineStep>()

  register(step: PipelineStep): void {
    this.steps.set(step.name, step)
  }

  get(name: string): PipelineStep | undefined {
    return this.steps.get(name)
  }

  getAll(): PipelineStep[] {
    return [...this.steps.values()]
  }

  has(name: string): boolean {
    return this.steps.has(name)
  }
}

export const stepRegistry = new StepRegistry()

// Steps are registered lazily when the orchestrator is initialized.
// This function is called from main process startup.
export async function registerAllSteps(): Promise<void> {
  // API-sourced steps
  const [
    { LastfmArtistExpansionStep },
    { LastfmTrackDiscoveryStep },
    { LastfmTrackSimilarityStep },
    { ListenbrainzRecsStep },
    { MusicbrainzMetadataStep },
    { DiscogsEnrichmentStep },
    { YoutubeChannelMiningStep },
    { SpotifyRelatedStep },
  ] = await Promise.all([
    import('./api-sourced/lastfm-artist-expansion.js'),
    import('./api-sourced/lastfm-track-discovery.js'),
    import('./api-sourced/lastfm-track-similarity.js'),
    import('./api-sourced/listenbrainz-recs.js'),
    import('./api-sourced/musicbrainz-metadata.js'),
    import('./api-sourced/discogs-enrichment.js'),
    import('./api-sourced/youtube-channel-mining.js'),
    import('./api-sourced/spotify-related.js'),
  ])

  // Scraped/LLM steps
  const [
    { YoutubeTracklistExtractStep },
    { MixcloudScrapeStep },
    { Tracklists1001ScrapeStep },
    { RedditMiningStep },
    { BandcampFanMiningStep },
    { EditorialBlogMiningStep },
    { RadioTracklistScrapeStep },
  ] = await Promise.all([
    import('./scraped/youtube-tracklist-extract.js'),
    import('./scraped/mixcloud-scrape.js'),
    import('./scraped/tracklists-1001-scrape.js'),
    import('./scraped/reddit-mining.js'),
    import('./scraped/bandcamp-fan-mining.js'),
    import('./scraped/editorial-blog-mining.js'),
    import('./scraped/radio-tracklist-scrape.js'),
  ])

  // Processing steps
  const [
    { DeduplicationStep },
    { TagNormalizationStep },
    { ScoreCalculationStep },
    { PoolHealthCheckStep },
  ] = await Promise.all([
    import('./processing/deduplication.js'),
    import('./processing/tag-normalization.js'),
    import('./processing/score-calculation.js'),
    import('./processing/pool-health-check.js'),
  ])

  const allSteps: PipelineStep[] = [
    new LastfmArtistExpansionStep(),
    new LastfmTrackDiscoveryStep(),
    new LastfmTrackSimilarityStep(),
    new ListenbrainzRecsStep(),
    new MusicbrainzMetadataStep(),
    new DiscogsEnrichmentStep(),
    new YoutubeChannelMiningStep(),
    new SpotifyRelatedStep(),
    new YoutubeTracklistExtractStep(),
    new MixcloudScrapeStep(),
    new Tracklists1001ScrapeStep(),
    new RedditMiningStep(),
    new BandcampFanMiningStep(),
    new EditorialBlogMiningStep(),
    new RadioTracklistScrapeStep(),
    new DeduplicationStep(),
    new TagNormalizationStep(),
    new ScoreCalculationStep(),
    new PoolHealthCheckStep(),
  ]

  for (const step of allSteps) {
    stepRegistry.register(step)
  }
}
