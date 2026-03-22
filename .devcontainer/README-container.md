# Dev Container Setup — SoundScope

## What's inside

- Node.js 20 LTS (Debian Bookworm)
- Build tools for `better-sqlite3` native compilation (gcc, python3)
- X11 display libraries for running Electron inside the container
- Xvfb virtual framebuffer (run Electron without a physical display)
- Playwright Chromium dependencies (for scraping steps)

---

## Opening in a container

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install the VS Code extension: **Dev Containers** (`ms-vscode-remote.remote-containers`)
3. Open this folder in VS Code, then: `Ctrl+Shift+P` → **Dev Containers: Reopen in Container**

`npm install` runs automatically on first open.

---

## Display / Electron (important)

### Default (Docker Desktop on Windows & macOS)

The devcontainer **does not** mount `/tmp/.X11-unix` from the host. On Windows that path does not exist and **Docker fails to start the container** if you try to bind it.

Instead, `DISPLAY=:99` and **`postStart` starts Xvfb** inside the container. Electron runs against that virtual display.

- You typically **won’t see a window** on your Windows desktop — the app is running inside the container’s framebuffer. Use this for builds, tests, and headless pipeline work.
- To watch the UI, use **Option B** below or run the app on the host after syncing the repo.

### Option A — One-off: `xvfb-run`

```bash
xvfb-run --auto-servernum npm run dev
```

### Option B — Show Electron on your machine (Linux host or advanced)

Create **`.devcontainer/devcontainer.local.json`** (gitignored) next to `devcontainer.json` and override, for example on **Linux** with a local X server:

```json
{
  "containerEnv": {
    "DISPLAY": "${localEnv:DISPLAY}"
  },
  "mounts": [
    "source=/tmp/.X11-unix,target=/tmp/.X11-unix,type=bind"
  ],
  "runArgs": ["--network=host"]
}
```

On **Windows** with VcXsrv / X410, forwarding X from the container to the host is more involved (often WSL2 + `DISPLAY` to the Windows host IP). Prefer the default Xvfb workflow unless you specifically need a visible window.

### Troubleshooting: “Error setting up the container” / `docker run` failed

If logs show a **bind mount** to `/tmp/.X11-unix`, that was the old config. Pull the latest `.devcontainer/devcontainer.json` (no `mounts`), then **Rebuild Container**: `Ctrl+Shift+P` → **Dev Containers: Rebuild Container**.

---

## First run checklist

```bash
# Verify Node version
node --version   # should be v20.x

# Install deps (already done by postCreateCommand, but if needed)
npm install

# Check better-sqlite3 built correctly
node -e "require('better-sqlite3'); console.log('SQLite OK')"

# Start the app
npm run dev
```

---

## If better-sqlite3 fails to build

```bash
npx electron-rebuild -f -w better-sqlite3
```

This recompiles the native module against the exact Electron version in use.

---

## Notes

- `ELECTRON_DISABLE_SANDBOX=1` is set in the container environment. This is safe for a local dev-only container.
- `--cap-add=SYS_PTRACE` and `--security-opt seccomp=unconfined` are set in `runArgs` — required for Electron's renderer process to start inside Docker.
- The Playwright Chromium browser is **not** pre-installed in the image. Run `npx playwright install chromium` inside the container when you reach Phase F of the build plan.
