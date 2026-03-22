# MixingSongFinder — Complete Specification
# Reference document. Read relevant sections as needed, not all at once.

---

## Table of Contents
1. Project Structure
2. Database Schema
3. Pipeline Architecture
4. Pipeline Step Definitions (All 19 Steps)
5. Scraping Tools and Methods
6. LLM Prompt Templates
7. Name Matching and Deduplication
8. Scoring Engine
9. Playback System
10. UI Specifications
11. Settings and Configuration
12. Error Handling Patterns
13. Feature Backlog

---

## 1. Project Structure

```
mixingsongfinder/
├── electron/                          # Electron main process (electron-vite convention)
│   ├── main.ts                        # Entry: window creation, IPC registration
│   └── preload.ts                     # IPC bridge (contextBridge.exposeInMainWorld)
│
├── src/
│   ├── main/                          # Runs in Node.js (main process)
│   │   ├── ipc/
│   │   │   ├── pipeline.ts            # IPC: run/cancel/resume steps, subscribe to events
│   │   │   ├── database.ts            # IPC: CRUD for tracks, artists, feedback, playlists
│   │   │   ├── playback.ts            # IPC: WebContentsView control, YouTube resolution
│   │   │   └── settings.ts            # IPC: read/write electron-store
│   │   │
│   │   └── lib/
│   │       ├── db/
│   │       │   ├── connection.ts      # Singleton. WAL mode. Create tables if not exist.
│   │       │   ├── schema.sql         # Full DDL (section 2 of this doc)
│   │       │   └── queries/
│   │       │       ├── tracks.ts      # findByNormalizedName, upsert, search, getByScore
│   │       │       ├── artists.ts     # findByNormalizedName, upsert, getSeeds, getSimilar
│   │       │       ├── feedback.ts    # recordFeedback, getFeedbackForTrack, getLikedTracks
│   │       │       ├── playlists.ts   # CRUD playlists and playlist_tracks
│   │       │       ├── scores.ts      # getSignalScores, getCompositeScore, getTopRanked
│   │       │       ├── pipeline-runs.ts # recordRun, getLastRun, getHistory, saveCheckpoint
│   │       │       ├── tags.ts        # upsertTag, getTagsForEntity, searchByTag
│   │       │       ├── mix-sources.ts # upsertMix, getMixesContainingTrack
│   │       │       └── seed-inputs.ts # addSeed, getSeeds, removeSeed
│   │       │
│   │       ├── pipeline/
│   │       │   ├── orchestrator.ts    # Run single step or "Run All" in dependency order
│   │       │   ├── types.ts           # PipelineStep, PipelineEvent, RunOptions, ResumeState
│   │       │   ├── step-registry.ts   # Map<string, PipelineStep> of all 19 steps
│   │       │   ├── dependency-graph.ts # Topological sort, prerequisite checking
│   │       │   ├── cost-tracker.ts    # Accumulate LLM token usage → estimated USD
│   │       │   │
│   │       │   ├── api-sourced/
│   │       │   │   ├── _mock-data/
│   │       │   │   │   ├── lastfm-artists.json       # 20 realistic similar artists
│   │       │   │   │   ├── lastfm-tracks.json        # 50 realistic tracks with tags
│   │       │   │   │   ├── musicbrainz-artists.json   # 10 artists with MBIDs, labels
│   │       │   │   │   ├── discogs-labels.json        # 5 labels with rosters
│   │       │   │   │   └── youtube-videos.json        # 15 video descriptions
│   │       │   │   ├── lastfm-artist-expansion.ts
│   │       │   │   ├── lastfm-track-discovery.ts
│   │       │   │   ├── lastfm-track-similarity.ts
│   │       │   │   ├── listenbrainz-recs.ts
│   │       │   │   ├── musicbrainz-metadata.ts
│   │       │   │   ├── discogs-enrichment.ts
│   │       │   │   ├── youtube-channel-mining.ts
│   │       │   │   └── spotify-related.ts
│   │       │   │
│   │       │   ├── scraped/
│   │       │   │   ├── _prompts/
│   │       │   │   │   ├── extract-tracklist.txt
│   │       │   │   │   ├── reddit-extract-recs.txt
│   │       │   │   │   └── editorial-extract-recs.txt
│   │       │   │   ├── youtube-tracklist-extract.ts   # Tool: Claude API
│   │       │   │   ├── mixcloud-scrape.ts             # Tool: Playwright
│   │       │   │   ├── tracklists-1001-scrape.ts      # Tool: Cheerio
│   │       │   │   ├── reddit-mining.ts               # Tool: Claude API + fetch
│   │       │   │   ├── bandcamp-fan-mining.ts          # Tool: Playwright
│   │       │   │   ├── editorial-blog-mining.ts        # Tool: Cheerio + Claude API
│   │       │   │   └── radio-tracklist-scrape.ts       # Tool: Cheerio
│   │       │   │
│   │       │   └── processing/
│   │       │       ├── deduplication.ts
│   │       │       ├── name-matching.ts
│   │       │       ├── tag-normalization.ts
│   │       │       ├── score-calculation.ts
│   │       │       └── pool-health-check.ts
│   │       │
│   │       ├── scoring/
│   │       │   ├── engine.ts          # computeCompositeScore(trackId) → score + reason
│   │       │   ├── weights.ts         # getWeights(), updateWeight(), learnFromFeedback()
│   │       │   ├── reason-generator.ts # generateReason(trackId, signals[]) → human text
│   │       │   └── signals/
│   │       │       ├── artist-similarity.ts
│   │       │       ├── tag-match.ts
│   │       │       ├── mix-cooccurrence.ts
│   │       │       ├── label-credit.ts
│   │       │       ├── collector-overlap.ts
│   │       │       ├── community-mention.ts
│   │       │       ├── source-agreement.ts
│   │       │       └── audio-similarity.ts  # Returns null (backlog stub)
│   │       │
│   │       ├── playback/
│   │       │   ├── resolver.ts        # resolvePlayback(track) → {type, id/url}
│   │       │   ├── youtube-search.ts  # searchYouTube(query) → videoId (uses YouTube Data API)
│   │       │   └── queue.ts           # PlaybackQueue class
│   │       │
│   │       ├── settings/
│   │       │   └── store.ts           # electron-store wrapper: getApiKey(), setApiKey(), etc.
│   │       │
│   │       └── utils/
│   │           ├── rate-limiter.ts     # RateLimiter class: perSecond, perMinute, with backoff
│   │           ├── name-normalizer.ts  # normalizeName(str) → lowercase, strip feat, etc.
│   │           ├── fuzzy-match.ts      # isMatch(a, b) → {match, confidence}
│   │           ├── logger.ts           # log(level, message, data) → structured log entry
│   │           └── mock-detector.ts    # isMockMode(keyName) → checks electron-store
│   │
│   └── renderer/                      # Runs in Chromium (renderer process)
│       ├── App.tsx                    # Router + layout (sidebar + player bar + page content)
│       ├── pages/
│       │   ├── DiscoverPage.tsx       # Recommendation feed
│       │   ├── PipelinePage.tsx       # Pipeline dashboard
│       │   ├── LibraryPage.tsx        # Liked songs, playlists, history
│       │   └── SettingsPage.tsx       # API keys, seeds, descriptors, channels
│       │
│       ├── components/
│       │   ├── player/
│       │   │   ├── PlayerBar.tsx      # Fixed bottom: art, title, controls, progress, actions
│       │   │   ├── NowPlaying.tsx     # Expanded: album art + why recommended
│       │   │   ├── QueueView.tsx      # Slide-out panel: up next
│       │   │   └── PlaybackControls.tsx # Play/pause/skip buttons
│       │   ├── discovery/
│       │   │   ├── RecommendationFeed.tsx # Scrollable list of TrackCards sorted by score
│       │   │   ├── TrackCard.tsx      # Art + title + artist + badges + hover actions
│       │   │   ├── SignalBadges.tsx    # Colored pills showing which signals contributed
│       │   │   └── WhyRecommended.tsx # Expandable: full signal breakdown with evidence
│       │   ├── pipeline/
│       │   │   ├── PipelineOverview.tsx # 3 sections: API, Scraped, Processing
│       │   │   ├── StepCard.tsx       # Status, progress, actions, last run info
│       │   │   ├── StepLogViewer.tsx  # Real-time scrolling log, color-coded, monospace
│       │   │   ├── StepHistory.tsx    # Past runs table
│       │   │   └── RunAllPanel.tsx    # Execute all steps in dependency order
│       │   ├── library/
│       │   │   ├── PlaylistView.tsx
│       │   │   ├── LikedSongs.tsx
│       │   │   └── ListeningHistory.tsx
│       │   ├── settings/
│       │   │   ├── ApiKeyManager.tsx  # Key inputs + test buttons + status indicators
│       │   │   ├── SeedManager.tsx    # Add/remove seed artists and tracks
│       │   │   ├── TasteDescriptors.tsx # Add/remove genre/mood descriptors
│       │   │   └── ChannelManager.tsx # YouTube channels, Mixcloud, radio, blogs
│       │   ├── onboarding/
│       │   │   └── EmptyState.tsx     # Reusable component: icon + message + action button
│       │   └── shared/
│       │       ├── Sidebar.tsx        # Fixed left, 240px, 4 nav items + app title
│       │       ├── AlbumArt.tsx       # Image with fallback gradient
│       │       ├── ProgressBar.tsx    # Reusable progress bar component
│       │       ├── MockBanner.tsx     # Yellow warning banner when in mock mode
│       │       ├── LoadingSpinner.tsx
│       │       └── ErrorToast.tsx
│       │
│       ├── hooks/
│       │   ├── usePlayback.ts        # IPC-backed playback state
│       │   ├── usePipeline.ts        # IPC-backed pipeline events subscription
│       │   ├── useDatabase.ts        # IPC-backed DB queries
│       │   └── useSettings.ts        # IPC-backed electron-store access
│       │
│       └── styles/
│           └── globals.css            # Tailwind directives + CSS custom properties
│
├── .cursorrules
├── .mixingsongfinder-spec.md                # This file
├── .env.example
├── BACKLOG.md
├── package.json
└── tsconfig.json
```

---

## 2. Database Schema

```sql
-- ============================================================
-- CORE ENTITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    mbid TEXT,
    discogs_id INTEGER,
    spotify_id TEXT,
    lastfm_url TEXT,
    bandcamp_url TEXT,
    is_seed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_normalized TEXT NOT NULL,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    mbid TEXT,
    duration_seconds INTEGER,
    album_name TEXT,
    album_art_url TEXT,
    release_year INTEGER,
    spotify_id TEXT,
    youtube_video_id TEXT,
    soundcloud_url TEXT,
    bandcamp_url TEXT,
    is_seed INTEGER DEFAULT 0,
    playback_source TEXT CHECK(playback_source IN ('youtube','spotify','soundcloud','unavailable') OR playback_source IS NULL),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- METADATA AND RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('artist','track')),
    entity_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    tag_normalized TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('lastfm','musicbrainz','discogs','listenbrainz','manual','reddit','editorial')),
    weight REAL DEFAULT 1.0 CHECK(weight >= 0 AND weight <= 1),
    UNIQUE(entity_type, entity_id, tag_normalized, source)
);

CREATE TABLE IF NOT EXISTS artist_labels (
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    label_name TEXT NOT NULL,
    label_name_normalized TEXT NOT NULL,
    discogs_label_id INTEGER,
    PRIMARY KEY (artist_id, label_name_normalized)
);

CREATE TABLE IF NOT EXISTS artist_credits (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('primary','producer','remixer','vocalist','featured')),
    PRIMARY KEY (track_id, artist_id, role)
);

CREATE TABLE IF NOT EXISTS artist_similarity (
    artist_id_a INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    artist_id_b INTEGER REFERENCES artists(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK(source IN ('lastfm','listenbrainz','musicbrainz','discogs','spotify')),
    score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (artist_id_a, artist_id_b, source)
);

-- ============================================================
-- MIX / TRACKLIST CO-OCCURRENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS mix_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL CHECK(source_type IN ('youtube_mix','mixcloud','1001tracklists','nts','worldwide_fm','rinse_fm','other_radio')),
    source_url TEXT UNIQUE,
    title TEXT,
    creator_name TEXT,
    raw_description TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mix_tracks (
    mix_id INTEGER REFERENCES mix_sources(id) ON DELETE CASCADE,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER,
    PRIMARY KEY (mix_id, track_id)
);

-- ============================================================
-- SCORING
-- ============================================================

CREATE TABLE IF NOT EXISTS signal_scores (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL CHECK(signal_type IN ('artist_similarity','tag_match','mix_cooccurrence','label_credit','collector_overlap','community_mention','source_agreement','audio_similarity')),
    raw_score REAL NOT NULL,
    normalized_score REAL NOT NULL CHECK(normalized_score >= 0 AND normalized_score <= 1),
    evidence_json TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (track_id, signal_type)
);

CREATE TABLE IF NOT EXISTS composite_scores (
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE PRIMARY KEY,
    final_score REAL NOT NULL CHECK(final_score >= 0 AND final_score <= 1),
    source_count INTEGER DEFAULT 0,
    recommendation_reason TEXT,
    last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signal_weights (
    signal_type TEXT PRIMARY KEY,
    weight REAL NOT NULL DEFAULT 0.15 CHECK(weight >= 0 AND weight <= 1),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default weights
INSERT OR IGNORE INTO signal_weights (signal_type, weight) VALUES
    ('artist_similarity', 0.25),
    ('tag_match', 0.20),
    ('mix_cooccurrence', 0.20),
    ('label_credit', 0.15),
    ('collector_overlap', 0.10),
    ('community_mention', 0.10);

-- ============================================================
-- USER INTERACTION
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK(action IN ('like','skip','dislike','save')),
    skip_reason TEXT CHECK(skip_reason IN ('too_sleepy','too_electronic','too_vocal','wrong_energy','not_vibing') OR skip_reason IS NULL),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    is_auto INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Auto-create Liked Songs playlist
INSERT OR IGNORE INTO playlists (id, name, description, is_auto) VALUES (1, 'Liked Songs', 'Automatically added when you like a track', 1);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS listening_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_listened_seconds INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0
);

-- ============================================================
-- PIPELINE STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','partial','cancelled')),
    started_at DATETIME,
    completed_at DATETIME,
    items_processed INTEGER DEFAULT 0,
    items_total INTEGER,
    items_failed INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    error_message TEXT,
    log_json TEXT,
    resume_state_json TEXT,
    config_json TEXT,
    estimated_cost_usd REAL DEFAULT 0
);

-- ============================================================
-- CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS seed_inputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_type TEXT NOT NULL CHECK(input_type IN ('artist','track','spotify_url','youtube_url','freetext')),
    input_value TEXT NOT NULL,
    resolved_artist_id INTEGER REFERENCES artists(id),
    resolved_track_id INTEGER REFERENCES tracks(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taste_descriptors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descriptor TEXT NOT NULL UNIQUE,
    weight REAL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS source_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL CHECK(source_type IN ('youtube_channel','mixcloud_creator','radio_show','blog')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    notes TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_artists_norm ON artists(name_normalized);
CREATE INDEX IF NOT EXISTS idx_tracks_norm ON tracks(title_normalized, artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tags_entity ON tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag_normalized);
CREATE INDEX IF NOT EXISTS idx_scores_track ON signal_scores(track_id);
CREATE INDEX IF NOT EXISTS idx_composite_score ON composite_scores(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_track ON feedback(track_id);
CREATE INDEX IF NOT EXISTS idx_feedback_action ON feedback(action);
CREATE INDEX IF NOT EXISTS idx_mix_tracks_track ON mix_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_mix_tracks_mix ON mix_tracks(mix_id);
CREATE INDEX IF NOT EXISTS idx_similarity_a ON artist_similarity(artist_id_a);
CREATE INDEX IF NOT EXISTS idx_similarity_b ON artist_similarity(artist_id_b);
CREATE INDEX IF NOT EXISTS idx_history_track ON listening_history(track_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_step ON pipeline_runs(step_name);
CREATE INDEX IF NOT EXISTS idx_source_channels_type ON source_channels(source_type);
```

---

## 3. Pipeline Architecture

### PipelineStep Interface
```typescript
interface PipelineStep {
    name: string;                    // e.g. 'lastfm_artist_expansion'
    displayName: string;             // e.g. 'Last.fm Artist Expansion'
    category: 'api' | 'scraped' | 'processing';
    description: string;             // Shown in UI
    dependsOn: string[];             // Step names that must complete first
    estimatedCostUsd: number;        // 0 for free API steps

    run(options: RunOptions): AsyncGenerator<PipelineEvent>;
    resume(state: ResumeState): AsyncGenerator<PipelineEvent>;
    cancel(): void;
    getLastRun(): PipelineRunRecord | null;
}

interface PipelineEvent {
    type: 'log' | 'progress' | 'error' | 'warning' | 'complete' | 'item_processed' | 'cost_update';
    level?: 'debug' | 'info' | 'warn' | 'error';
    timestamp: Date;
    message: string;
    data?: any;
}

interface RunOptions {
    dryRun?: boolean;                 // Preview without executing
    limit?: number;                   // Process at most N items
    forceRefresh?: boolean;           // Re-process items already in DB
    skipProcessed?: boolean;          // DEFAULT TRUE
}

interface ResumeState {
    lastProcessedId?: number;
    lastProcessedIndex?: number;
    pendingItems?: any[];
    customState?: Record<string, any>;
}
```

### Dependency Graph
```
Level 1 (no dependencies):
  lastfm-artist-expansion, listenbrainz-recs, spotify-related,
  youtube-channel-mining, mixcloud-scrape, 1001tracklists-scrape,
  reddit-mining, bandcamp-fan-mining, editorial-blog-mining, radio-tracklist-scrape

Level 2 (depends on Level 1 candidate artists):
  lastfm-track-discovery, lastfm-track-similarity,
  musicbrainz-metadata, discogs-enrichment

Level 3 (depends on Level 2 tracks with metadata):
  youtube-tracklist-extract (needs youtube-channel-mining descriptions),
  deduplication, tag-normalization

Level 4 (depends on clean deduplicated data):
  score-calculation, pool-health-check
```

Orchestrator enforces order: if user clicks Run on Level 2 step without Level 1 done, show warning with option to run prerequisites first.

"Run All" executes levels 1→2→3→4 sequentially, within each level running steps one at a time (not parallel for simplicity).

### Cost Tracking
- `cost-tracker.ts` tracks tokens per LLM call and converts to USD
- Claude Sonnet: ~$3/M input tokens, ~$15/M output tokens
- Gemini Flash: ~$0.075/M input, ~$0.30/M output
- Pipeline dashboard shows running cost prominently
- Each pipeline_run record stores estimated_cost_usd
- First full run: $5-10. Subsequent runs (skipProcessed=true): $0.50-2.

---

## 4. Pipeline Step Definitions

### API-Sourced Steps

**lastfm-artist-expansion** | Category: api | Depends: none | Cost: $0
- Input: seed artists from seed_inputs table
- Action: `artist.getSimilar` for each seed → recurse 2-3 hops. GET `http://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist={name}&api_key={key}&format=json&limit=50`
- Output: artists + artist_similarity rows
- Rate: 200ms between calls
- Resume: track which artists have been expanded (store set of expanded artist IDs)

**lastfm-track-discovery** | Category: api | Depends: lastfm-artist-expansion | Cost: $0
- Input: candidate artists
- Action: `artist.getTopTracks` then `track.getTopTags` for top 10 tracks per artist
- Output: tracks + tags rows
- Rate: 200ms between calls
- Resume: track which artists' tracks have been fetched

**lastfm-track-similarity** | Category: api | Depends: none (uses seed tracks) | Cost: $0
- Input: seed tracks from seed_inputs
- Action: `track.getSimilar` for each seed track
- Output: new candidate tracks + similarity data
- Rate: 200ms between calls

**listenbrainz-recs** | Category: api | Depends: none | Cost: $0
- Input: seed artists
- Action: query ListenBrainz similar artist endpoints and CF recommendation API
- Output: additional candidate artists
- Rate: respect rate-limit headers

**musicbrainz-metadata** | Category: api | Depends: lastfm-artist-expansion | Cost: $0
- Input: all candidate artists and tracks
- Action: search by name → resolve MBIDs → fetch tags, labels, credits, relationships
- Output: enriched metadata (mbid, labels, credits, structured tags)
- Rate: STRICTLY 1 request per second. Set User-Agent header.
- Resume: track which entities have been resolved

**discogs-enrichment** | Category: api | Depends: lastfm-artist-expansion | Cost: $0
- Input: candidate artists
- Action: search Discogs → pull label rosters, style tags. For seed artist labels, find other artists on those labels.
- Output: artist_labels, tags, additional candidate artists from label expansion
- Rate: 60 requests/minute authenticated
- Resume: track which artists processed

**youtube-channel-mining** | Category: api | Depends: none | Cost: $0
- Input: source_channels table (youtube_channel type)
- Action: YouTube Data API → get channel's upload playlist → get video IDs and descriptions. Store raw descriptions in mix_sources.raw_description for later LLM extraction.
- Output: mix_sources rows with raw descriptions
- Rate: Be quota-conscious. playlistItems.list = 1 unit. Fetch max 50 videos per channel.
- IMPORTANT: Do NOT use search.list (100 units each) — use channel playlist browsing instead (1 unit each)

**spotify-related** | Category: api | Depends: none | Cost: $0
- Input: seed artists with spotify_id
- Action: Get Related Artists endpoint
- Output: additional candidate artists + artist_similarity

### Scraped/LLM Steps

**youtube-tracklist-extract** | Category: scraped | Depends: youtube-channel-mining | Cost: ~$0.50
- Tool: Claude API
- Input: raw_description from mix_sources (from youtube-channel-mining)
- Action: send each description to Claude with extract-tracklist.txt prompt
- Output: tracks + mix_tracks rows
- Fallback: if no Claude key, try regex `/(\d+[.:]\s*)?([\w\s]+)\s*[-–—]\s*([\w\s]+)/g`, flag results as low-confidence
- Cost: ~$0.01 per description

**mixcloud-scrape** | Category: scraped | Depends: none | Cost: $0
- Tool: Playwright (Mixcloud is a React SPA)
- Input: source_channels (mixcloud_creator type)
- Action: launch Playwright → navigate to creator page → find cloudcasts → open each → extract tracklist from DOM
- Output: tracks + mix_sources + mix_tracks
- Rate: 3-5s between page loads
- Fallback: skip mixes with no visible tracklist (many won't have one)

**tracklists-1001-scrape** | Category: scraped | Depends: none | Cost: $0
- Tool: Cheerio (static HTML)
- Input: search queries for genre-relevant DJs/shows
- Action: fetch search results → follow links to tracklist pages → extract track tables
- Output: tracks + mix_sources + mix_tracks
- Rate: 5-10s between requests. Random User-Agent from a rotation list.
- CRITICAL: stop immediately on 403 or 429. Do not retry aggressively. Log and move on.

**reddit-mining** | Category: scraped | Depends: none | Cost: ~$0.60
- Tool: Claude API + node-fetch
- Input: subreddits: r/triphop, r/chillhop, r/downtempo, r/electronicmusic
- Action: fetch `https://www.reddit.com/r/{sub}/search.json?q=recommendation+suggest&sort=relevance&t=year&limit=25` → for each thread, fetch `.json` → send text to Claude with reddit-extract-recs.txt prompt
- Output: candidate tracks and artists with community endorsement
- Fallback: Gemini Flash instead of Claude

**bandcamp-fan-mining** | Category: scraped | Depends: none | Cost: $0
- Tool: Playwright (Bandcamp has JS-rendered content)
- Input: seed artists' Bandcamp URLs (from artists table or manual search)
- Action: navigate to album pages → find "supported by" and "fans who also bought" sections → extract artist/album names
- Output: candidate tracks + artist_similarity based on purchase overlap
- Rate: 3s between pages

**editorial-blog-mining** | Category: scraped | Depends: none | Cost: ~$0.30
- Tool: Cheerio (fetch HTML) + Claude API (extract recommendations)
- Input: source_channels (blog type) — e.g. Bandcamp Daily, Stereofox, Chillhop blog
- Action: fetch blog page → cheerio extract article text → send to Claude with editorial-extract-recs.txt prompt
- Output: candidate tracks and artists

**radio-tracklist-scrape** | Category: scraped | Depends: none | Cost: $0
- Tool: Cheerio (NTS and Worldwide FM have static tracklist pages)
- Input: source_channels (radio_show type)
- Action: fetch show page → find episodes → extract tracklists
- Output: tracks + mix_sources + mix_tracks
- Rate: 2s between requests

### Processing Steps

**deduplication** | Category: processing | Depends: Level 2 steps | Cost: $0
- Action: run fuzzy name matching (section 7) across all tracks. Merge duplicates by keeping the record with more metadata. Preserve all source associations.

**tag-normalization** | Category: processing | Depends: Level 2 steps | Cost: $0
- Action: normalize tag strings: lowercase, "trip hop"→"trip-hop", "chillhop"→"chill-hop", collapse obvious synonyms. Build frequency counts.

**score-calculation** | Category: processing | Depends: deduplication, tag-normalization | Cost: $0
- Action: for each track, compute each signal score (section 8), apply weights, generate composite score and recommendation_reason text. Write to signal_scores and composite_scores.

**pool-health-check** | Category: processing | Depends: score-calculation | Cost: $0
- Action: report stats — total tracks, unheard tracks, tracks with scores, genre distribution, average score, source coverage, staleness. Display in pipeline dashboard.

---

## 5. Scraping Tools Summary

| Site | Rendering | Tool | Why |
|------|-----------|------|-----|
| Last.fm, MusicBrainz, Discogs | API | node-fetch | Proper REST APIs |
| YouTube | API | YouTube Data API | Proper REST API |
| 1001Tracklists | Static HTML | Cheerio | Server-rendered pages |
| NTS Radio | Static HTML | Cheerio | Server-rendered tracklists |
| Worldwide FM | Static HTML | Cheerio | Server-rendered tracklists |
| Reddit | JSON API | node-fetch + `.json` URLs | Reddit serves JSON natively |
| Editorial blogs | Static HTML | Cheerio (DOM) + Claude (NLU) | Text is in HTML but meaning needs LLM |
| Mixcloud | React SPA | Playwright | JS-rendered, no static content |
| Bandcamp | JS-rendered | Playwright | Dynamic content, "also bought" is JS |

Playwright setup: `npm install playwright && npx playwright install chromium`
Reuse single browser instance per pipeline run. Close when done.

---

## 6. LLM Prompt Templates

### extract-tracklist.txt
```
Extract a tracklist from this YouTube video description. Return ONLY a JSON array.
Each entry: {"artist": "...", "title": "...", "position": N}
Handle formats: "Artist - Title", "Title by Artist", timestamps, numbered lists.
If no tracklist, return [].
ONLY valid JSON, nothing else.

Description:
{description}
```

### reddit-extract-recs.txt
```
Extract music recommendations from this Reddit thread. Return ONLY a JSON array.
Each entry: {"artist": "...", "track": null or "...", "context": "why (max 50 words)", "confidence": "high"|"medium"|"low"}
high = clear recommendation. medium = positive mention. low = name-dropped.
Ignore sarcasm, negative mentions, OP's known artists.
ONLY valid JSON, nothing else.

Thread:
{thread_text}
```

### editorial-extract-recs.txt
```
Extract music recommendations from this blog article. Return ONLY a JSON array.
Each entry: {"artist": "...", "track": null or "...", "album": null or "...", "context": "why (max 30 words)"}
Only positive recommendations. Skip ads, passing mentions, negative reviews.
ONLY valid JSON, nothing else.

Article:
{article_text}
```

---

## 7. Name Matching and Deduplication

```typescript
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\(feat\.?.*?\)/gi, '')
        .replace(/\(ft\.?.*?\)/gi, '')
        .replace(/\(remix\)/gi, ' remix')
        .replace(/\(live\)/gi, ' live')
        .replace(/\(official.*?\)/gi, '')
        .replace(/\[official.*?\]/gi, '')
        .replace(/[''`]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function isMatch(a: string, b: string): { match: boolean; confidence: number } {
    const normA = normalizeName(a);
    const normB = normalizeName(b);
    if (normA === normB) return { match: true, confidence: 1.0 };

    const distance = levenshtein(normA, normB);
    const similarity = 1 - (distance / Math.max(normA.length, normB.length));
    if (similarity > 0.9) return { match: true, confidence: similarity };

    const tokensA = new Set(normA.split(' '));
    const tokensB = new Set(normB.split(' '));
    const overlap = [...tokensA].filter(t => tokensB.has(t)).length;
    const tokenSim = overlap / Math.max(tokensA.size, tokensB.size);
    if (tokenSim > 0.8) return { match: true, confidence: tokenSim };

    return { match: false, confidence: Math.max(similarity, tokenSim) };
}
```

When merging duplicates: keep the record with more populated fields. Transfer all mix_tracks, tags, and signal data to the surviving record. Log merges.

---

## 8. Scoring Engine

```
final_score = Σ(weight_i × normalized_score_i)
if source_count >= 3: final_score *= 1.15 (cap at 1.0)
```

Default weights from signal_weights table (see schema).

Each signal module: `computeScore(trackId) → { raw, normalized, evidence_json } | null`

Reason generator example output:
"Similar to Skinshape (0.87 on Last.fm), tagged trip-hop + analog warmth + psychedelic soul, found in 8 downtempo mixes on YouTube, released on Tru Thoughts (shared with 3 seed artists). Endorsed by 4 of 6 signal sources."

---

## 9. Playback System

YouTube IDs resolve ON DEMAND. Resolver cascade:
1. If track.youtube_video_id exists → use it
2. Search YouTube Data API for "Artist - Title" → cache result in tracks table
3. If track.spotify_id exists → Spotify embed
4. If track.soundcloud_url exists → SoundCloud embed
5. Otherwise → mark unavailable

Use Electron WebContentsView (NOT BrowserView, NOT IFrame):
- Create WebContentsView, position at bottom behind PlayerBar
- Load YouTube embed URL: `https://www.youtube.com/embed/{videoId}?autoplay=1&enablejsapi=1`
- Control via YouTube IFrame API postMessage injected into the view
- App's PlayerBar controls send commands via IPC → main process → postMessage to view

---

## 10. UI Specifications

### CSS Custom Properties
```css
:root {
    --bg-base: #121212; --bg-surface: #1a1a1a; --bg-elevated: #242424; --bg-hover: #2a2a2a;
    --text-primary: #ffffff; --text-secondary: #b3b3b3; --text-muted: #727272;
    --accent-primary: #1DB954; --accent-secondary: #E8A838; --accent-danger: #E84855; --accent-info: #4A9FD9;
    --border-subtle: #2a2a2a; --border-visible: #404040;
    --font-body: 'DM Sans', sans-serif; --font-heading: 'Outfit', sans-serif; --font-mono: 'JetBrains Mono', monospace;
    --sidebar-width: 240px; --player-height: 90px;
}
```

### Main Layout
Sidebar (fixed left, 240px) + Page Content (fills remaining) + Player Bar (fixed bottom, 90px full width).

### Empty States
- Discover: "No recommendations yet. Add seed artists in Settings, then run the pipeline."
- Library / Liked Songs: "No liked songs yet. Discover and like tracks to build your library."
- Library / Playlists: "No playlists yet. Create one to start organizing your discoveries."
- Pipeline: each step shows "Never run" — no special empty state needed.

### TrackCard Spec
80px height. Left: album art 56×56 (8px radius). Center: title (white, DM Sans 500), artist (secondary), signal badges row. Right: score badge. Hover: bg-hover, reveal play/like/dislike/save action buttons. Click signal badges to expand WhyRecommended.

### StepCard Spec
Status icons: ✅ completed, ⏸️ idle/never-run, 🔄 running (animated spin), ⚠️ partial, ❌ failed. Progress bar when running. Action buttons: [Run], [Logs], and conditionally [Resume], [Retry Failed], [Reset]. Last run summary: "3h ago — 347 artists, 0 errors" or "2d ago — 89/120 videos, 31 errors". Expandable log viewer with monospace font, auto-scroll, color-coded by level.

---

## 11. Settings and Configuration

All settings stored in electron-store (persists in app data folder). NOT .env at runtime.

electron-store schema:
```typescript
{
    apiKeys: {
        lastfm_key: string,
        lastfm_secret: string,
        musicbrainz_email: string,
        listenbrainz_token: string,
        discogs_token: string,
        youtube_key: string,
        spotify_client_id: string,
        spotify_client_secret: string,
        anthropic_key: string,
        gemini_key: string,
    },
    preferences: {
        autoPlayNext: boolean,         // Auto-play next track on skip
        historyMinSeconds: number,     // Min seconds before recording to history (default: 10)
        maxCostPerRunUsd: number,      // Cost warning threshold (default: 10)
    }
}
```

Settings page has a "Test All API Keys" button that makes one lightweight call to each API and shows green/red status per key.

---

## 12. Error Handling Patterns

```typescript
// Pattern for every API call
async function fetchWithRetry<T>(
    fn: () => Promise<T>,
    options: { maxRetries: number; backoffMs: number; stepName: string }
): Promise<T | null> {
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === options.maxRetries) {
                logger.error(`${options.stepName}: Failed after ${options.maxRetries} retries`, error);
                return null;
            }
            if (isRateLimitError(error)) {
                const waitMs = options.backoffMs * Math.pow(2, attempt);
                logger.warn(`${options.stepName}: Rate limited, waiting ${waitMs}ms`);
                await sleep(waitMs);
            } else {
                throw error; // Non-retryable errors bubble up
            }
        }
    }
    return null;
}
```

Pipeline steps: catch errors per-item, log them, continue to next item. Only stop the entire step on: unrecoverable errors (invalid API key, network down) or user cancel.

---

## 13. Feature Backlog

1. Freshness decay scoring — skipped tracks decay, unheard get bonus
2. Mood dial / context selector — filter by energy/mood clusters
3. Auto candidate pool expansion — crawl when pool < threshold
4. Discovery radius slider — adventurousness control
5. Seed track injection — paste URL → mini-candidate pool
6. Per-source trust score learning — learn which sources work best
7. Skip reason tagging — optional tags on skip for negative model
8. Audio preview waveforms — 30sec snippets for fast triage
9. Genre-adjacent exploration — deliberate out-of-comfort recommendations
10. Collaborative taste matching — find similar LB/Last.fm users
11. Essentia audio analysis — audio embeddings (Python sidecar)
12. Keyboard shortcuts (j/k/s, spacebar)
13. Global media key support
14. Drag-and-drop playlist reordering
15. Export to Spotify/YouTube/text
