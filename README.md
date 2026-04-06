# MixingSongFinder

A desktop music discovery app that finds new tracks by scoring them across multiple signals rather than relying on a single recommendation algorithm. Built for DJs and deep listeners who want to find genuinely good music faster.

## What It Does

You give the app a handful of seed artists or tracks, and it builds a scored pool of recommendations by pulling from Last.fm, MusicBrainz, ListenBrainz, Discogs, Spotify, YouTube channels, Mixcloud, 1001Tracklists, Reddit, Bandcamp, editorial blogs, and radio stations like NTS and Rinse FM.

Each track is scored across eight signal types: artist similarity, tag match, mix co-occurrence, label trust, collector overlap, community mentions, source agreement, and audio similarity. You browse the ranked results, play tracks inline, like or skip them, and build playlists from what lands.

## Core Features

- **Discovery pipeline** with 19 steps across API, scraping, and LLM-based sources
- **Composite scoring engine** with configurable signal weights that normalize across partial data
- **Onboarding wizard** that walks through API key setup and seed artist selection
- **Library and playlists** with liked songs, custom playlists, and feedback tracking
- **Inline playback** via embedded YouTube with queue management, skip reasons, and session restore
- **Pipeline UI** with run/cancel controls, presets, cost tracking, and progress logs
- **Mock mode** that runs without API keys using built-in sample data

## Pipeline Presets

| Preset | Cost | What It Runs |
|--------|------|-------------|
| Quick Discovery | Free | API-only sources, no LLM steps |
| Standard | ~$0.50 | APIs + selected scraping |
| Full | ~$2–5 | All sources including LLM extraction |
| Re-score Only | Free | Recalculates scores from existing data |

## Stack

- Electron 33, React 18, TypeScript, Tailwind
- SQLite via better-sqlite3 for local persistence
- Anthropic and Google Generative AI SDKs for LLM-powered pipeline steps
- Playwright and Cheerio for scraping
- Vite for build tooling, electron-builder for packaging

## Quick Start

```bash
npm install
npm run dev
```

API keys are entered through the in-app wizard and stored locally via electron-store. The app runs in mock mode if keys are missing, so you can explore the UI without any external accounts.

## Playwright Chromium Setup

Several scraping pipeline steps (Mixcloud tracklists, Bandcamp fan mining) use Playwright with a headless Chromium browser. Install it after `npm install`:

```bash
npx playwright install chromium
```

On Linux (including the dev container), you also need system dependencies:

```bash
npx playwright install-deps chromium
```

The Playwright browser binary is **not** bundled with `npm install` — this is a separate download (~150 MB). If Chromium isn't installed, the affected pipeline steps will skip gracefully and return an error message in the pipeline UI.

## Dev Container

A devcontainer config is included for building in Linux, which is recommended for reliable `better-sqlite3` native module compilation. See `.devcontainer/README-container.md` for setup.

## Project Structure

```
electron/
  main/index.ts              Main process, window, embedded player
  preload/index.ts            IPC bridge
src/
  App.tsx                     Routes, sidebar, player bar
  main/
    ipc/                      IPC handlers (database, pipeline, playback, settings)
    lib/
      db/                     SQLite connection, schema, query modules
      pipeline/               Orchestrator, step registry, dependency graph
        api-sourced/           Last.fm, ListenBrainz, MusicBrainz, Discogs, YouTube, Spotify
        scraped/               Mixcloud, 1001Tracklists, Reddit, Bandcamp, blogs, radio
        processing/            Deduplication, tag normalization, scoring, pool health
      scoring/                Engine, weights, signals, reason generator
      playback/               YouTube resolver, queue, search
      settings/               electron-store wrapper
  renderer/
    components/               UI components for each page
    hooks/                    usePlayback, usePipeline, useSettings, useDatabase
    pages/                    Discover, Library, Pipeline, Settings, Wizard
```
