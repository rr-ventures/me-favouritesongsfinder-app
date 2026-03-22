# SoundScope — Quick Start + Homework Sheet

## How to launch the app

```bash
# In the project root:
npm run dev
```

This starts Vite + Electron together. The app window opens automatically.

**First run:** The setup wizard will guide you through adding API keys and seed artists.

**Giving feedback on tracks:**
1. Go to **Pipeline** tab → click **Run All** (or just run "Last.fm Artist Expansion" + "Last.fm Track Discovery" for a free quick pass)
2. Run **Score Calculation** (Processing section) to rank tracks
3. Go to **Discover** tab — tracks are ranked by taste match
4. Click ▶ to play (auto-finds YouTube), ❤ to like, ✗ to skip
5. Liked tracks appear in **Library → Liked Songs**
6. Re-run Score Calculation after giving feedback to update rankings

---

## Homework Sheet

Fill in this file with your personal music taste data. Once complete, the Settings page will have an "Import from Homework Sheet" button (coming in Phase I).

---

## 1. Seed Artists
Artists you already know and love — the starting point for everything.

```
# Format: one per line, exactly as you'd type it
Bonobo
Nujabes
Four Tet
# Add yours here:

```

## 2. Genre / Mood Descriptors
Words that describe the music you want. Used to guide LLM extraction and tag matching.

```
# Examples: downtempo, trip-hop, lo-fi jazz, late night, instrumental, mellow beats
# Add yours:

```

## 3. Trusted Labels
Record labels whose releases you tend to like. Boosts score for artists on these labels.

```
# Examples: Ninja Tune, Tru Thoughts, Stones Throw, Brainfeeder, Warp
# Add yours:

```

## 4. YouTube Channels to Mine
Channels that post good mixes or track compilations in your genre.

```
# Format: channel name | channel URL
# Example:
# Majestic Casual | https://www.youtube.com/@MajesticCasual
# Add yours:

```

## 5. Mixcloud Creators
Mixcloud artists / DJs whose tracklists you want to mine.

```
# Format: creator name | profile URL
# Example:
# Bonobo | https://www.mixcloud.com/bonobomusic/
# Add yours:

```

## 6. Subreddits to Mine
Reddit communities for music discussion and recommendations.

```
# Defaults already included: r/LofiHipHop, r/triphop, r/downtempo, r/electronicmusic
# Add more:

```

## 7. Radio Shows / Stations
Radio stations, shows, or programs with tracklist archives.

```
# Examples: NTS Radio, Worldwide FM, Rinse FM, Resident Advisor podcast
# Add yours (with tracklist URL if known):

```

## 8. Blogs / Editorial Sites
Music blogs or editorial sites that publish track recommendations.

```
# Example:
# Aquarium Drunkard | https://aquariumdrunkard.com
# The Wire | https://www.thewire.co.uk
# Add yours:

```

## 9. Artists to Exclude (Negative List)
Artists you definitely don't want recommended.

```
# One per line:

```

## 10. BPM Preference
If you have a BPM preference (leave blank to include all).

```
# Example: 70-100
# Your preference:

```

---

_This file is read by SoundScope to pre-populate your taste profile. It's optional — you can also configure everything through the Settings UI._
