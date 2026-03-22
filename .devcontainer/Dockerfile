# Base: Node.js 20 LTS on Debian Bookworm (slim)
# Bookworm has the ARM64 toolchain needed to build better-sqlite3 from source
# if prebuilts are unavailable.
FROM node:20-bookworm-slim

# ── System dependencies ──────────────────────────────────────────────────────

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools for native Node modules (better-sqlite3, etc.)
    build-essential \
    python3 \
    # Git for version control inside the container
    git \
    # X11 / display libs for Electron
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libgbm1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libasound2 \
    libnss3 \
    libdrm2 \
    # Needed by Playwright's Chromium for scraping steps
    libglib2.0-0 \
    libu2f-udev \
    fonts-liberation \
    xdg-utils \
    # Virtual framebuffer — run Electron headlessly in CI or without X host
    xvfb \
    # Useful dev tools
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── User setup ───────────────────────────────────────────────────────────────
# Use the built-in 'node' user (uid 1000) from the base image
# so file ownership matches a typical Linux host user.
USER node
WORKDIR /workspace

# ── Shell helper: run Electron with Xvfb when no DISPLAY is set ──────────────
# Add a convenience script that wraps `npm run dev` with a virtual display.
# Usage inside container: xvfb-run npm run dev
# Or just set DISPLAY from the host X server.

# The project files are bind-mounted at runtime by the devcontainer,
# so we don't COPY them here — keeping the image generic and rebuild-free.
