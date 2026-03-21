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

## Running Electron (GUI window)

Electron needs a display. You have two options:

### Option A — Forward display from WSL2 (recommended on Windows)

1. Install [VcXsrv](https://sourceforge.net/projects/vcxsrv/) or [X410](https://x410.app/) on Windows
2. Launch your X server with "Disable access control" checked
3. In WSL2 terminal, find your host IP:
   ```bash
   export DISPLAY=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):0
   ```
4. Set the same `DISPLAY` in your shell before opening VS Code, or add it to `~/.bashrc`
5. The devcontainer will pick it up via `${localEnv:DISPLAY}`

Then inside the container:
```bash
npm run dev
```

### Option B — Headless with Xvfb (no host display needed)

```bash
xvfb-run --auto-servernum npm run dev
```

This opens a virtual framebuffer — no window appears but the app runs. Useful for testing and pipeline runs that don't need the GUI.

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
