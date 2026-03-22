import { app, BrowserWindow, shell, ipcMain, WebContentsView } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { registerSettingsHandlers } from '../../src/main/ipc/settings.js'
import { registerDatabaseHandlers } from '../../src/main/ipc/database.js'
import { registerPipelineHandlers } from '../../src/main/ipc/pipeline.js'
import { registerPlaybackHandlers, setPlayerView } from '../../src/main/ipc/playback.js'
import { getDb, closeDb } from '../../src/main/lib/db/connection.js'
import { registerAllSteps } from '../../src/main/lib/pipeline/step-registry.js'
import { orchestrator } from '../../src/main/lib/pipeline/orchestrator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const MIN_WIDTH = 1024
const MIN_HEIGHT = 700
const PLAYERBAR_HEIGHT = 90

let win: BrowserWindow | null = null
let playerView: WebContentsView | null = null

const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

function updatePlayerViewBounds() {
  if (!win || !playerView) return
  const [width, height] = win.getContentSize()
  playerView.setBounds({
    x: 0,
    y: height - PLAYERBAR_HEIGHT,
    width,
    height: PLAYERBAR_HEIGHT,
  })
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'SoundScope',
    icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
    width: 1280,
    height: 800,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: '#0f0f13',
    titleBarStyle: 'default',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // WebContentsView for YouTube playback — hidden until playing
  playerView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.contentView.addChildView(playerView)
  setPlayerView(playerView)
  updatePlayerViewBounds()

  win.on('resize', updatePlayerViewBounds)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => {
    win = null
    playerView = null
  })
}

// Register all IPC handlers
async function registerIpcHandlers() {
  registerSettingsHandlers()
  registerDatabaseHandlers()
  registerPlaybackHandlers()

  // Initialize pipeline steps, then register pipeline IPC
  try {
    await registerAllSteps()
    orchestrator.initialize()
    registerPipelineHandlers()
  } catch (e) {
    console.error('Pipeline init error:', e)
    // Provide stub handlers as fallback
    ipcMain.handle('pipeline:getStatus', async () => [])
    ipcMain.handle('pipeline:run', async () => ({ success: false }))
    ipcMain.handle('pipeline:cancel', async () => ({ success: true }))
    ipcMain.handle('pipeline:resume', async () => ({ success: false }))
    ipcMain.handle('pipeline:runAll', async () => ({ success: false }))
    ipcMain.handle('pipeline:cancelAll', async () => ({ success: true }))
    ipcMain.handle('pipeline:getHistory', async () => [])
    ipcMain.handle('pipeline:getRunLogs', async () => [])
    ipcMain.handle('pipeline:getCost', async () => ({ totalUsd: 0, entries: [] }))
  }

  // IPC for shell operations from renderer
  ipcMain.on('shell:openExternal', (_event, url: string) => {
    if (url.startsWith('https:') || url.startsWith('http:')) shell.openExternal(url)
  })
}

app.whenReady().then(async () => {
  // Open DB early so it's ready before any IPC calls
  try { getDb() } catch (e) { console.error('DB init error:', e) }
  await registerIpcHandlers()
  await createWindow()
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
