# SoundScope

Personal desktop music discovery app. Finds new favourite tracks in trip-hop, chillhop, downtempo, and related genres. Learns from likes and skips. Scores tracks across multiple signals: mix co-occurrence, artist similarity, label trust, community mentions, and more.

## Build plan

See [`soundscope_build_plan_bd05c0ad.plan.md`](soundscope_build_plan_bd05c0ad.plan.md) for the full phased build plan (architecture decisions, file-by-file order, mock data spec, risk register, acceptance criteria).

## Dev container

This repo includes a devcontainer for building in a Linux environment (recommended — ensures `better-sqlite3` native module builds correctly).

See [`.devcontainer/README-container.md`](.devcontainer/README-container.md) for setup instructions.

**Quick start:**
1. Install Docker Desktop + VS Code Dev Containers extension
2. `Ctrl+Shift+P` → Dev Containers: Reopen in Container
3. `npm run dev` (after Phase A scaffold is complete)
