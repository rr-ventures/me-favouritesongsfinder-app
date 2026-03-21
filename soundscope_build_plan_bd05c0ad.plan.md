---
name: SoundScope Build Plan
overview: A complete, phase-by-phase build plan for SoundScope — a personal desktop music discovery app built with Electron + React + SQLite. Covers architecture decisions, every file to create in order, mock data specs, risk register, and acceptance criteria.
todos:
  - id: phase-a
    content: "Phase A: Scaffold — clone template, configure Tailwind, build layout shell (Sidebar, PlayerBar placeholder, 4 page shells, EmptyState)"
    status: pending
  - id: phase-b
    content: "Phase B: Database + Settings — connect SQLite, apply schema, build Settings page with ApiKeyManager, SeedManager, electron-store IPC"
    status: pending
  - id: phase-c
    content: "Phase C: Pipeline Engine — PipelineStep types, orchestrator, step registry (all stubs), dependency graph, cost tracker, IPC"
    status: pending
  - id: phase-d
    content: "Phase D: Pipeline Dashboard UI — StepCard, StepLogViewer, RunAllPanel, all 6 status states, log export"
    status: pending
  - id: phase-e
    content: "Phase E: API Pipeline Steps — all 8 API steps with mock data files, rate limiters, resume state"
    status: pending
  - id: phase-f
    content: "Phase F: Scraping Steps — all 7 scraping/LLM steps, 403 handling, Playwright setup"
    status: pending
  - id: phase-g
    content: "Phase G: Processing + Scoring Engine — deduplication, tag normalization, 7 signals, composite scorer, reason generator"
    status: pending
  - id: phase-h
    content: "Phase H: Discovery UI + Playback — RecommendationFeed (paginated 50), TrackCard, NowPlaying, WebContentsView YouTube, manual URL correction"
    status: pending
  - id: phase-i
    content: "Phase I: Library + Polish — LikedSongs, playlists, history, first-run redirect, BACKLOG-homework.md"
    status: pending
isProject: false
---

# SoundScope — Complete Build Plan

---

## Research Verification Findings

- **electron-vite-react**: Clone from `github.com/electron-vite/electron-vite-react`, `npm install`, `npm run dev`. Last updated Nov 2024. Confirmed valid.
- **better-sqlite3 on win32-arm64**: NEEDS CARE. v11.1.1+ has prebuilts but win32-arm64 had C compiler errors through v11.0.0. We will use v12.8+ and pin the exact version. Fallback: rebuild from source with build tools if prebuilt fails.
- **electron-store**: Requires Electron 30+, native ESM only (no CommonJS). Must use `Store.initRenderer()` in main process. All access via IPC, not direct renderer import.
- **WebContentsView**: Confirmed current API. Use `new WebContentsView()` in main, set bounds, add to `win.contentView`. Load YouTube embed with `?autoplay=1&enablejsapi=1`. Send postMessage commands via `webContents.executeJavaScript`.
- **YouTube IFrame postMessage**: Works with `playVideo`, `pauseVideo`, `stopVideo`. `getCurrentTime` is unreliable — track time client-side with a timer instead.
- **playwright + Electron**: Use `playwright` (not `@playwright/test`) to avoid binary conflicts. Playwright is used for scraping only, not app testing in MVP.
- **Last.fm API**: `http://ws.audioscrobbler.com/2.0/` — GET requests with `&format=json`. No auth for read endpoints. Rate limit: undocumented, use 200ms between calls.
- **MusicBrainz**: Confirmed 1 req/sec hard limit. User-Agent header REQUIRED: `SoundScope/1.0.0 (your@email.com)`.
- **Discogs**: Personal access token in header `Authorization: Discogs token={token}`. 60 req/min authenticated.
- **YouTube Data API**: `playlistItems.list` = 1 quota unit. `search.list` = 100 units. Default daily quota: 10,000 units. We use channel upload playlist browsing only.
- **ListenBrainz**: Similar artists endpoint at `https://labs.api.listenbrainz.org/similar-artists?artist_mbids={mbid}`. CF recording recs at `GET /1/cf/recommendation/user/{mb_username}/recording`. NEEDS VERIFICATION at build time — endpoint is experimental and subject to change.

---

## Your Answers Summary

- **First open**: Settings page auto-opens if no seeds/keys configured
- **Feed**: Paginated, 50 per page, all tracks sorted by score descending
- **Auto-play**: Always auto-play next track (radio mode, no toggle)
- **Why recommended**: One-line summary always visible + click to expand full breakdown
- **Session restore**: Restore which track was playing, restart from 0:00
- **Click art/title**: Open full Now Playing view (does not auto-play)
- **Run All scope**: Configurable per-step toggles for inclusion in Run All
- **Partial completion**: Ask before resuming or restarting
- **Cost display**: Subtle per-step in small text, running total in Run All panel
- **Scrape blocked**: Log, skip source, continue — retry blocked sources at end of step
- **Dry Run**: Yes, per step and in Run All panel
- **Export logs**: Yes, export to .txt
- **Sources (YouTube channels, Mixcloud, blogs, subreddits, seed artists, genre descriptors, labels)**: All deferred — build a "Homework Sheet" (`BACKLOG-homework.md`) the user fills out, and a first-run prompt in Settings
- **Vocals**: Mix of both
- **Liked songs**: Auto-add to Liked Songs playlist
- **Window**: Resizable, minimum 1024x700
- **Art placeholder**: Generic music note icon on dark background
- **History**: Record every play (no threshold)
- **Keyboard shortcuts**: None in MVP
- **Running low signal**: Stats only via pool health check
- **Score threshold**: Show all tracks sorted by score, no cutoff
- **Manual add**: Yes — paste YouTube URL, auto-resolve metadata
- **Disliked artist**: Show with 'disliked artist' flag, scored penalty
- **Wrong YouTube video**: Right-click menu to paste corrected URL
- **Unplayable tracks**: Show greyed out with 'Not available' label

---

## Section 1: Architecture Decisions

### 1.1 Process Architecture

The app has two Electron processes:

- **Main process** (`electron/main.ts`): All Node.js, DB, file system, API calls, pipeline execution, WebContentsView management
- **Renderer process** (`src/renderer/`): React UI only. Zero Node imports. All data via IPC

IPC bridge defined in `electron/preload.ts` using `contextBridge.exposeInMainWorld`. Renderer calls `window.electron.ipc.`*.

### 1.2 Database Strategy

- Single SQLite file via `better-sqlite3`, WAL mode, one singleton connection
- All SQL in `src/main/lib/db/queries/` — never raw SQL in IPC handlers or pipeline steps
- Schema applied via `schema.sql` run on connection open (CREATE IF NOT EXISTS)
- Migrations: not needed for MVP (append-only schema changes)

### 1.3 Settings Storage

- `electron-store` initialized in main process only
- Renderer reads/writes via `settings` IPC channel
- Keys stored: all API keys + `preferences.autoPlayNext`, `preferences.historyMinSeconds`, `preferences.maxCostPerRunUsd`, `ui.lastTrackId` (session restore)

### 1.4 Mock Mode

- `src/main/lib/utils/mock-detector.ts` checks electron-store: if key is empty or `"PLACEHOLDER"` → mock mode for that API
- Every API client module calls `isMockMode(keyName)` before hitting network
- Mock data files live in `src/main/lib/pipeline/api-sourced/_mock-data/`
- `MockBanner` component in renderer shows yellow banner when any mock mode is active

### 1.5 Pipeline Architecture

- All 19 steps implement `PipelineStep` interface from `pipeline/types.ts`
- Orchestrator runs steps as async generators emitting `PipelineEvent` objects
- IPC handler streams events to renderer via `webContents.send('pipeline:event', event)`
- Renderer subscribes via `usePipeline` hook using `window.electron.ipc.on('pipeline:event', ...)`
- Checkpoints saved after every item via `pipeline-runs.ts` `saveCheckpoint()`
- Cost tracker accumulates per LLM call, emits `cost_update` events

### 1.6 Playback System

- `WebContentsView` created in main process, positioned at `{ x: 0, y: windowHeight - 90, width: windowWidth, height: 90 }`
- View loads YouTube embed URL. PlayerBar in renderer is positioned above it (z-index)
- Controls sent via `playback` IPC → main → `webContents.executeJavaScript('window.postMessage(...)')`
- YouTube time tracked with a renderer-side interval timer (not via IFrame API — unreliable)
- Session restore: `ui.lastTrackId` saved to electron-store on every track change

### 1.7 First Run / Onboarding

- On app launch, main process checks electron-store for any seed artists
- If none, sends IPC event `app:first-run` to renderer
- Renderer navigates to `/settings` with a `firstRun=true` query flag
- Settings page shows first-run onboarding prompt at top

### 1.8 Homework Sheet

- `BACKLOG-homework.md` file created in repo root
- Contains fill-in sections: seed artists, genre descriptors, trusted labels, YouTube channels, Mixcloud creators, subreddits, negative artists, BPM preference
- Settings page "Import from Homework Sheet" button (Phase I / polish)

### 1.9 Dependency Decisions

- `playwright` (not `@playwright/test`) to avoid binary conflict
- `better-sqlite3` pinned to `^12.8.0` — if prebuilt fails on win32-arm64, add `electron-rebuild` to postinstall
- `electron-store` v10 (ESM) used only in main process, never directly in renderer
- No Next.js, no localStorage, no sessionStorage

---

## Section 2: File-by-File Build Order

### Phase A — Scaffold and Shell

**Goal**: Running Electron window with React, Tailwind, routing, and the 4-page layout.

Files to create/modify:

- Clone `electron-vite/electron-vite-react` template into repo
- `package.json` — add all dependencies
- `tailwind.config.js` — configure colors, fonts from design system
- `src/renderer/styles/globals.css` — CSS custom properties, Tailwind directives, Google Fonts import
- `electron/main.ts` — window creation (1024x700 min), WebContentsView placeholder, IPC registration
- `electron/preload.ts` — contextBridge with `ipc.send`, `ipc.invoke`, `ipc.on` channels
- `src/renderer/App.tsx` — React Router layout: Sidebar + page content area + PlayerBar slot
- `src/renderer/pages/DiscoverPage.tsx` — empty shell with EmptyState
- `src/renderer/pages/PipelinePage.tsx` — empty shell
- `src/renderer/pages/LibraryPage.tsx` — empty shell
- `src/renderer/pages/SettingsPage.tsx` — empty shell with first-run detection
- `src/renderer/components/shared/Sidebar.tsx` — 240px fixed left, 4 nav items, app title
- `src/renderer/components/shared/MockBanner.tsx` — yellow banner
- `src/renderer/components/shared/LoadingSpinner.tsx`
- `src/renderer/components/shared/ErrorToast.tsx`
- `src/renderer/components/onboarding/EmptyState.tsx` — icon + message + action button
- `src/renderer/components/player/PlayerBar.tsx` — 90px fixed bottom placeholder
- `src/main/ipc/settings.ts` — IPC handlers (stub, returns mock)
- `src/main/lib/utils/logger.ts`
- `src/main/lib/utils/mock-detector.ts`
- `BACKLOG-homework.md` — homework sheet template

### Phase B — Database and Settings

**Goal**: SQLite connected, schema applied, electron-store working, Settings page fully functional.

Files to create/modify:

- `src/main/lib/db/connection.ts` — singleton, WAL mode, applies schema
- `src/main/lib/db/schema.sql` — full DDL from spec section 2
- `src/main/lib/db/queries/artists.ts`
- `src/main/lib/db/queries/tracks.ts`
- `src/main/lib/db/queries/feedback.ts`
- `src/main/lib/db/queries/playlists.ts`
- `src/main/lib/db/queries/scores.ts`
- `src/main/lib/db/queries/pipeline-runs.ts`
- `src/main/lib/db/queries/tags.ts`
- `src/main/lib/db/queries/mix-sources.ts`
- `src/main/lib/db/queries/seed-inputs.ts`
- `src/main/lib/settings/store.ts` — electron-store wrapper: `getApiKey`, `setApiKey`, `getPreference`, `setPreference`
- `src/main/ipc/settings.ts` — full implementation: get/set API keys, get/set preferences, test-key stubs
- `src/main/ipc/database.ts` — CRUD IPC handlers for all entities
- `src/renderer/hooks/useSettings.ts`
- `src/renderer/hooks/useDatabase.ts`
- `src/renderer/components/settings/ApiKeyManager.tsx` — key inputs, test buttons, status indicators
- `src/renderer/components/settings/SeedManager.tsx` — add/remove seed artists and tracks
- `src/renderer/components/settings/TasteDescriptors.tsx`
- `src/renderer/components/settings/ChannelManager.tsx`
- `src/renderer/pages/SettingsPage.tsx` — full implementation with first-run banner
- `src/main/lib/utils/name-normalizer.ts`
- `src/main/lib/utils/fuzzy-match.ts`
- `src/main/lib/utils/rate-limiter.ts`

### Phase C — Pipeline Engine (Orchestration)

**Goal**: Pipeline types, orchestrator, step registry, cost tracker. No real API steps yet — just the machinery.

Files to create/modify:

- `src/main/lib/pipeline/types.ts` — `PipelineStep`, `PipelineEvent`, `RunOptions`, `ResumeState` interfaces
- `src/main/lib/pipeline/orchestrator.ts` — `runStep()`, `runAll()`, `cancelStep()`, `resumeStep()`
- `src/main/lib/pipeline/step-registry.ts` — register all 19 steps (stubs for now)
- `src/main/lib/pipeline/dependency-graph.ts` — topological sort, prerequisite checking
- `src/main/lib/pipeline/cost-tracker.ts` — accumulate tokens + USD estimates
- `src/main/ipc/pipeline.ts` — IPC: run, cancel, resume, subscribe to events, get status
- `src/renderer/hooks/usePipeline.ts`

### Phase D — Pipeline Dashboard UI

**Goal**: Full pipeline dashboard UI with mock data. All states: idle, running, partial, completed, failed.

Files to create/modify:

- `src/renderer/pages/PipelinePage.tsx` — full implementation
- `src/renderer/components/pipeline/PipelineOverview.tsx` — 3 sections (API, Scraped, Processing)
- `src/renderer/components/pipeline/StepCard.tsx` — all status states, progress bar, action buttons
- `src/renderer/components/pipeline/StepLogViewer.tsx` — real-time scrolling, monospace, color-coded
- `src/renderer/components/pipeline/StepHistory.tsx` — past runs table
- `src/renderer/components/pipeline/RunAllPanel.tsx` — step toggles, dry run checkbox, run button, cost display
- `src/renderer/components/shared/ProgressBar.tsx`

### Phase E — Real API Pipeline Steps

**Goal**: All 8 API-sourced steps working with mock fallback.

Files to create/modify:

- `src/main/lib/pipeline/api-sourced/_mock-data/lastfm-artists.json` — 20 realistic artists
- `src/main/lib/pipeline/api-sourced/_mock-data/lastfm-tracks.json` — 50 realistic tracks
- `src/main/lib/pipeline/api-sourced/_mock-data/musicbrainz-artists.json`
- `src/main/lib/pipeline/api-sourced/_mock-data/discogs-labels.json`
- `src/main/lib/pipeline/api-sourced/_mock-data/youtube-videos.json`
- `src/main/lib/pipeline/api-sourced/lastfm-artist-expansion.ts`
- `src/main/lib/pipeline/api-sourced/lastfm-track-discovery.ts`
- `src/main/lib/pipeline/api-sourced/lastfm-track-similarity.ts`
- `src/main/lib/pipeline/api-sourced/listenbrainz-recs.ts`
- `src/main/lib/pipeline/api-sourced/musicbrainz-metadata.ts`
- `src/main/lib/pipeline/api-sourced/discogs-enrichment.ts`
- `src/main/lib/pipeline/api-sourced/youtube-channel-mining.ts`
- `src/main/lib/pipeline/api-sourced/spotify-related.ts`

### Phase F — Scraping Pipeline Steps

**Goal**: All 7 scraping/LLM steps working with mock fallback and graceful block handling.

Files to create/modify:

- `src/main/lib/pipeline/scraped/_prompts/extract-tracklist.txt`
- `src/main/lib/pipeline/scraped/_prompts/reddit-extract-recs.txt`
- `src/main/lib/pipeline/scraped/_prompts/editorial-extract-recs.txt`
- `src/main/lib/pipeline/scraped/youtube-tracklist-extract.ts`
- `src/main/lib/pipeline/scraped/mixcloud-scrape.ts`
- `src/main/lib/pipeline/scraped/tracklists-1001-scrape.ts`
- `src/main/lib/pipeline/scraped/reddit-mining.ts`
- `src/main/lib/pipeline/scraped/bandcamp-fan-mining.ts`
- `src/main/lib/pipeline/scraped/editorial-blog-mining.ts`
- `src/main/lib/pipeline/scraped/radio-tracklist-scrape.ts`

### Phase G — Processing Steps and Scoring Engine

**Goal**: Deduplication, tag normalization, score calculation, scoring signals, reason generator.

Files to create/modify:

- `src/main/lib/pipeline/processing/deduplication.ts`
- `src/main/lib/pipeline/processing/name-matching.ts`
- `src/main/lib/pipeline/processing/tag-normalization.ts`
- `src/main/lib/pipeline/processing/score-calculation.ts`
- `src/main/lib/pipeline/processing/pool-health-check.ts`
- `src/main/lib/scoring/engine.ts`
- `src/main/lib/scoring/weights.ts`
- `src/main/lib/scoring/reason-generator.ts`
- `src/main/lib/scoring/signals/artist-similarity.ts`
- `src/main/lib/scoring/signals/tag-match.ts`
- `src/main/lib/scoring/signals/mix-cooccurrence.ts`
- `src/main/lib/scoring/signals/label-credit.ts`
- `src/main/lib/scoring/signals/collector-overlap.ts`
- `src/main/lib/scoring/signals/community-mention.ts`
- `src/main/lib/scoring/signals/source-agreement.ts`
- `src/main/lib/scoring/signals/audio-similarity.ts` — stub returning null

### Phase H — Discovery UI and Playback

**Goal**: Full Discover page, Now Playing, player controls, YouTube playback via WebContentsView, manual YouTube URL correction.

Files to create/modify:

- `src/main/lib/playback/resolver.ts`
- `src/main/lib/playback/youtube-search.ts`
- `src/main/lib/playback/queue.ts`
- `src/main/ipc/playback.ts` — full implementation
- `src/renderer/hooks/usePlayback.ts`
- `src/renderer/pages/DiscoverPage.tsx` — full implementation with pagination
- `src/renderer/components/discovery/RecommendationFeed.tsx` — paginated, 50 per page
- `src/renderer/components/discovery/TrackCard.tsx` — full spec: art, title, artist, badges, score, hover actions, one-line reason + expand
- `src/renderer/components/discovery/SignalBadges.tsx`
- `src/renderer/components/discovery/WhyRecommended.tsx` — expandable breakdown
- `src/renderer/components/shared/AlbumArt.tsx` — with music-note placeholder fallback
- `src/renderer/components/player/PlayerBar.tsx` — full implementation
- `src/renderer/components/player/NowPlaying.tsx` — full Now Playing view
- `src/renderer/components/player/QueueView.tsx` — slide-out panel
- `src/renderer/components/player/PlaybackControls.tsx`
- Update `electron/main.ts` — WebContentsView full setup, bounds management on resize

### Phase I — Library and Polish

**Goal**: Library page, listening history, playlists, liked songs, log export, pool health display, error handling polish.

Files to create/modify:

- `src/renderer/pages/LibraryPage.tsx` — full implementation
- `src/renderer/components/library/LikedSongs.tsx`
- `src/renderer/components/library/PlaylistView.tsx`
- `src/renderer/components/library/ListeningHistory.tsx`
- Pool health check display in PipelinePage
- Log export functionality in StepLogViewer
- `BACKLOG.md` — updated feature backlog
- End-to-end: verify first-run Settings redirect, session restore of last track

---

## Section 3: Mock Data Spec

All mock data uses real artist/track names from the genre space, so the UI looks authentic.

### `lastfm-artists.json` (20 artists)

- Bonobo, Nujabes, Wun Two, Idealism, Mndsgn, Skinshape, Fakear, Tycho, Four Tet, Burial, J Dilla, Flying Lotus, Lone, Teebs, Knxwledge, Little Dragon, Stumbleine, Clams Casino, Rone, Zero 7
- Each with: `name`, `name_normalized`, `similarity_score` (0.6-0.95), `lastfm_url`, `is_seed: 1` for 3 anchors

### `lastfm-tracks.json` (50 tracks)

- Real tracks: "Bonobo - Kong", "Nujabes - Aruarian Dance", "Wun Two - Bonsai", "Idealism - Daydream", "Mndsgn - Camelblues", "Skinshape - Afar", "Four Tet - Lush", "Tycho - Awake", "J Dilla - Donuts (intro)", "Flying Lotus - Never Catch Me", "Lone - 2 Is 8", "Knxwledge - Hud Dreems", "Teebs - Tropical Stars", "Stumbleine - Snowflake", etc.
- Each with: `title`, `title_normalized`, `artist_name`, `album_name`, `duration_seconds` (180-360), `tags: ['trip-hop', 'downtempo', ...]`

### `musicbrainz-artists.json` (10 artists)

- Bonobo (MBID: 9a709693-b4f8-4da9-8cc1-038c911a61be), Four Tet, Burial — real MBIDs
- Each with: `mbid`, `labels: [{name: 'Ninja Tune'}]`, `tags`

### `discogs-labels.json` (5 labels)

- Ninja Tune, Tru Thoughts, Stones Throw, Brainfeeder, Warp
- Each with: `label_name`, `discogs_label_id`, `artists_on_label: [...]`

### `youtube-videos.json` (15 video descriptions)

- Realistic YouTube mix descriptions with tracklists embedded:
  - "Bonobo Mix 2023 \n1. Bonobo - Kong\n2. Four Tet - Baby\n3. Tycho - Awake..."
  - "Late Night Downtempo Vol.3 \n00:00 Nujabes - Aruarian Dance\n03:42 Wun Two - Bonsai..."

---

## Section 4: Risk Register


| Risk                                                             | Probability      | Impact | Mitigation                                                                                 |
| ---------------------------------------------------------------- | ---------------- | ------ | ------------------------------------------------------------------------------------------ |
| `better-sqlite3` win32-arm64 prebuilt fails                      | Medium           | High   | Pin v12.8.0. Add `electron-rebuild` script. Document manual build steps.                   |
| `electron-store` v10 ESM-only breaks existing build setup        | Medium           | Medium | Test ESM compatibility early in Phase A. If issues, use `electron-store@9` (CommonJS).     |
| YouTube embed CSP blocks playback in WebContentsView             | Medium           | High   | Add CSP override in `webContents.session.webRequest.onHeadersReceived`. Tested in Phase H. |
| YouTube postMessage `getCurrentTime` unreliable                  | High             | Low    | Track time with renderer-side `setInterval`. Only use postMessage for play/pause/stop.     |
| MusicBrainz 1 req/sec causing step to run for hours              | High             | Medium | Default limit to 100 artists per run. Show ETA in step card.                               |
| Playwright Chromium download fails on first run                  | Medium           | Medium | Catch install error, show user-facing message with manual install command.                 |
| ListenBrainz similar artists endpoint URL changes (experimental) | Medium           | Low    | Wrap in try/catch, log `NEEDS VERIFICATION` comment, graceful null return.                 |
| Reddit `.json` API returns rate limit (429)                      | Medium           | Low    | Exponential backoff per spec pattern. Step continues with next subreddit.                  |
| LLM extraction costs exceed $10/run unexpectedly                 | Low              | Medium | Cost tracker warns at $10. Dry run mode available. Batch limits configurable.              |
| Window resize breaks WebContentsView positioning                 | Medium           | Medium | Listen to `win.on('resize')`, recalculate and update view bounds.                          |
| Claude extraction returns invalid JSON                           | High (edge case) | Low    | Wrap in try/catch, fall back to regex extractor, flag as low-confidence.                   |


---

## Section 5: Acceptance Criteria

### Phase A — Done when:

- `npm run dev` launches Electron window with React content
- Sidebar shows 4 nav items: Discover, Library, Pipeline, Settings
- Navigation between pages works without white screens
- PlayerBar placeholder visible at bottom (90px)
- MockBanner renders in yellow
- All 4 pages show EmptyState with contextual message
- No TypeScript errors

### Phase B — Done when:

- `better-sqlite3` connects, WAL mode confirmed in DB file
- All 15 tables exist after fresh launch
- Settings page renders all 4 sections (API keys, seeds, descriptors, channels)
- Can type an API key and it persists after app restart (electron-store confirmed)
- `isMockMode('lastfm_key')` returns true when key is empty
- name-normalizer and fuzzy-match unit-testable with console.log

### Phase C — Done when:

- `PipelineStep` interface compiles with zero errors
- Orchestrator can run a stub step and emit progress events
- IPC: renderer can call `pipeline.run('lastfm-artist-expansion')` and receive events
- Dependency graph correctly identifies Level 1/2/3/4 steps
- Cost tracker correctly calculates USD from token counts

### Phase D — Done when:

- Pipeline page shows all 19 steps in 3 sections
- Step cards show all 6 status states visually (use mock status overrides)
- Log viewer shows real-time scrolling logs (with mock event emitter)
- Run All panel shows step toggles, dry run checkbox, cost display
- Log export button writes a `.txt` file to Downloads folder

### Phase E — Done when:

- Mock mode: `lastfm-artist-expansion` returns 20 mock artists and writes them to DB
- Mock mode: `youtube-channel-mining` returns 15 mock videos, writes to mix_sources
- Real mode: `lastfm-artist-expansion` with a valid key fetches real similar artists
- All 8 steps appear in step-registry, all implement PipelineStep interface
- Resume state saves and loads correctly (partial run, restart app, resume from correct index)
- Rate limiters confirmed: MusicBrainz ≤1 req/sec under test

### Phase F — Done when:

- Mock mode: `youtube-tracklist-extract` parses mock descriptions and writes tracks
- `tracklists-1001-scrape` handles 403 by logging, skipping, and continuing
- `reddit-mining` mock returns 10 candidate tracks/artists
- `mixcloud-scrape` launches Playwright without error (even if no mixes found in mock)
- All 7 scraping steps in step-registry

### Phase G — Done when:

- Deduplication merges two identical track names into one record
- Score calculation runs on all tracks and writes to signal_scores + composite_scores
- `reason-generator` produces human-readable text for a track with 3+ signals
- Pool health check reports total tracks, scored tracks, average score to pipeline dashboard
- `audio-similarity` signal returns null without error (confirmed stub)

### Phase H — Done when:

- Clicking play on a track in mock mode shows YouTube embed in WebContentsView
- PlayerBar shows track title, artist, progress bar
- Skip/next works: auto-plays next track in feed
- Now Playing view opens when clicking album art — shows large art + why recommended breakdown
- Queue panel shows upcoming tracks
- Manual YouTube URL correction: right-click track → paste URL → saves to DB → plays
- Session restore: close app, reopen, Settings shows last-played track name with "Resume?" prompt
- Unplayable tracks render greyed out with 'Not available'

### Phase I — Done when:

- Library page shows Liked Songs, playlists tab, listening history
- Like button on track card adds to Liked Songs playlist
- Disliked-artist tracks appear with visual 'disliked artist' flag in feed
- First-run: Settings auto-opens on fresh install with onboarding banner
- All empty states render correctly across all 4 pages
- `BACKLOG-homework.md` exists with fill-in template for seeds, genres, channels

---

## Section 6: Dependency Install Commands

Run in order after cloning the template:

```bash
# 1. Clone template and install base deps
git clone https://github.com/electron-vite/electron-vite-react.git .
npm install

# 2. Database
npm install better-sqlite3@^12.8.0
npm install --save-dev @types/better-sqlite3

# 3. Settings persistence
npm install electron-store@^10.0.0

# 4. Scraping: static HTML
npm install cheerio node-fetch
npm install --save-dev @types/node-fetch

# 5. Scraping: JS-rendered SPAs
npm install playwright
npx playwright install chromium

# 6. LLM clients
npm install @anthropic-ai/sdk @google/generative-ai

# 7. Fonts (via Google Fonts CDN in globals.css — no npm needed)

# 8. Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 9. React Router
npm install react-router-dom
npm install --save-dev @types/react-router-dom

# 10. Levenshtein distance (for fuzzy matching)
npm install fastest-levenshtein

# 11. Electron rebuild (if better-sqlite3 prebuilt fails on win32-arm64)
npm install --save-dev electron-rebuild
# Then: npx electron-rebuild -f -w better-sqlite3
```

**Note on electron-store v10**: It is native ESM. If the `electron-vite-react` template uses CommonJS for the main process, this will conflict. Mitigation: use dynamic `import()` or switch to `electron-store@9` (CommonJS). We will test this in Phase A and decide.

---

## Deferred to BACKLOG-homework.md

The following require your personal input and will be configured via Settings after MVP:

- Full seed artist list
- Genre/mood descriptors
- Trusted labels
- YouTube channels to mine
- Mixcloud creators
- Additional subreddits (beyond 4 defaults)
- NTS/Worldwide FM/Rinse FM shows
- Negative artist list
- BPM preference

