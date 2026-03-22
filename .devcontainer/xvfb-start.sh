#!/usr/bin/env bash
# Start a virtual X server for Electron when no host X11 socket is available
# (required on Docker Desktop for Windows / macOS where we cannot bind /tmp/.X11-unix).
set -euo pipefail
if pgrep -x Xvfb >/dev/null 2>&1; then
  echo "Xvfb already running."
else
  nohup Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
  sleep 0.4
  echo "Started Xvfb on :99 (log: /tmp/xvfb.log)"
fi
echo "SoundScope dev container ready. DISPLAY=${DISPLAY:-unset} — run: npm run dev"
