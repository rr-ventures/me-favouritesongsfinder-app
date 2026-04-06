import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { getDb } from '../lib/db/connection.js'
import { parseHomeworkMarkdown, autoParseTrackList } from '../lib/homework/parser.js'
import { importHomeworkData, importTrackEntries } from '../lib/homework/importer.js'
import type { ImportResult } from '../lib/homework/importer.js'
import { logger } from '../lib/utils/logger.js'

export function registerHomeworkHandlers() {
  ipcMain.handle('homework:pickFile', async (_event, mode: 'homework' | 'tracks') => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const filters =
      mode === 'homework'
        ? [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
        : [
            { name: 'Track Lists', extensions: ['csv', 'json', 'txt'] },
            { name: 'All Files', extensions: ['*'] },
          ]

    const result = await dialog.showOpenDialog(win, {
      title: mode === 'homework' ? 'Select Homework File' : 'Select Track List',
      filters,
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { filePath, content, filename: path.basename(filePath) }
  })

  ipcMain.handle('homework:importHomework', async (_event, content: string): Promise<ImportResult> => {
    logger.info('Starting homework markdown import')
    const db = getDb()
    const { data, warnings: parseWarnings } = parseHomeworkMarkdown(content)
    const result = importHomeworkData(db, data)
    result.warnings.push(...parseWarnings)
    return result
  })

  ipcMain.handle('homework:importTracks', async (
    _event,
    content: string,
    filename?: string,
  ): Promise<ImportResult> => {
    logger.info('Starting track list import', { filename })
    const db = getDb()
    const { tracks, warnings: parseWarnings } = autoParseTrackList(content, filename)

    if (tracks.length === 0) {
      return {
        counts: { seedArtists: 0, descriptors: 0, labels: 0, channels: 0, tracks: 0, excluded: 0, skipped: 0 },
        warnings: parseWarnings.length > 0 ? parseWarnings : ['No tracks found in file'],
        errors: [],
      }
    }

    const result = importTrackEntries(db, tracks)
    result.warnings.push(...parseWarnings)
    return result
  })

  ipcMain.handle('homework:importPastedTracks', async (
    _event,
    content: string,
  ): Promise<ImportResult> => {
    logger.info('Starting pasted track list import')
    const db = getDb()
    const { tracks, warnings: parseWarnings } = autoParseTrackList(content)

    if (tracks.length === 0) {
      return {
        counts: { seedArtists: 0, descriptors: 0, labels: 0, channels: 0, tracks: 0, excluded: 0, skipped: 0 },
        warnings: parseWarnings.length > 0 ? parseWarnings : ['No tracks found in pasted text'],
        errors: [],
      }
    }

    const result = importTrackEntries(db, tracks)
    result.warnings.push(...parseWarnings)
    return result
  })
}
