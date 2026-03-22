---
name: Windows ARM64 Desktop Build
overview: Configure electron-builder to produce a proper Windows ARM64 installer, set the app identity, wire in your logo, and add a one-command build script.
todos:
  - id: icon-files
    content: Replace build/icon.ico and build/icon.png with provided logo (user supplies these)
    status: pending
  - id: electron-builder-config
    content: "Update electron-builder.json: add arm64 arch, fix appId/productName, explicit icon paths, remove publish URL"
    status: pending
  - id: package-scripts
    content: Add build:win script to package.json
    status: pending
  - id: app-user-model-id
    content: Verify setAppUserModelId string matches new appId in electron/main/index.ts
    status: pending
  - id: test-build
    content: Run npm run build:win and confirm ARM64 .exe is produced in release/ folder
    status: pending
isProject: false
---

# Windows ARM64 Desktop Build Plan

## Icon requirements

Provide your logo in these formats before we build:

- `**build/icon.ico**` — Windows taskbar / installer icon
  - Multi-resolution ICO: must contain sizes **16, 24, 32, 48, 64, 128, 256 px** — all in one `.ico` file
  - Tools to create it: [icoconvert.com](https://icoconvert.com) (paste a high-res PNG, select all sizes) or Photoshop / Affinity Photo "Export as ICO"
  - Source PNG should be at least **512x512 px**, square, ideally transparent background
- `**build/icon.png` — fallback / Linux (same square PNG, 512x512 minimum)
- `**build/icon.icns` — macOS only (not needed for your Surface, but nice to have)

The file at `build/icon.ico` is already the path electron-builder looks for by convention — just replace it with yours.

---

## Changes

### 1. `[electron-builder.json](electron-builder.json)`

Current `win` target only builds `x64`. Add `arm64` arch and fix app identity:

```json
{
  "appId": "com.soundscope.app",
  "productName": "SoundScope",
  "asar": true,
  "directories": { "output": "release/${version}" },
  "files": ["dist-electron", "dist"],
  "icon": "build/icon.ico",
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64", "arm64"] }],
    "artifactName": "${productName}_${version}_${arch}.${ext}",
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "deleteAppDataOnUninstall": false,
    "installerIcon": "build/icon.ico",
    "uninstallerIcon": "build/icon.ico"
  },
  "publish": null
}
```

Key changes:

- `"arch": ["x64", "arm64"]` — produces both; the ARM64 installer is what you run on Surface Laptop 7
- `"productName": "SoundScope"` — used as the display name in taskbar and Start menu
- `"appId": "com.soundscope.app"` — unique Windows App User Model ID (replaces placeholder `"YourAppID"`)
- `"publish": null` — removes the GitHub release URL that would cause build errors
- Explicit `"icon"` paths so builder doesn't have to guess

### 2. `[package.json](package.json)` — `scripts` section

Add a dedicated Windows build command:

```json
"build:win": "tsc && vite build && electron-builder --win --arm64"
```

So the full build flow is:

1. TypeScript compile
2. Vite bundles renderer + main/preload
3. electron-builder packages into a Windows ARM64 NSIS installer

### 3. `[electron/main/index.ts](electron/main/index.ts)` — App User Model ID

The file already has a Windows App User Model ID call. Just verify/update the string to match `appId`:

```ts
app.setAppUserModelId("com.soundscope.app");
```

---

## Build steps (after plan is confirmed + icon provided)

```bash
# 1. Drop your icon files into build/
#    build/icon.ico   (multi-res, required)
#    build/icon.png   (512x512 PNG, required)

# 2. Run the build
npm run build:win

# 3. Output appears at:
#    release/<version>/SoundScope_<version>_arm64.exe
```

Copy that `.exe` to your Surface Laptop 7, run it — it installs SoundScope with a Start menu shortcut and taskbar pinning.

---

## Notes

- The build runs **inside the dev container** (Linux/WSL2) and cross-compiles to Windows ARM64 — electron-builder handles this automatically
- Native modules (`better-sqlite3`) may need a rebuild step; if the install fails on the Surface, I'll add a `--config.extraMetadata` override or switch to a pre-built binary
- `asar: true` bundles all source into a protected archive — users cannot browse your code
