import React, { useState } from 'react'
import LoadingSpinner from '../shared/LoadingSpinner'

interface ImportCounts {
  seedArtists: number
  descriptors: number
  labels: number
  channels: number
  tracks: number
  excluded: number
  skipped: number
}

interface ImportResult {
  counts: ImportCounts
  warnings: string[]
  errors: string[]
}

type ImportMode = 'homework' | 'tracks' | 'paste'

export default function HomeworkImport() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pasteContent, setPasteContent] = useState('')
  const [activeMode, setActiveMode] = useState<ImportMode>('homework')

  async function handleHomeworkImport() {
    setImporting(true)
    setResult(null)
    try {
      const file = await window.electron.ipc.invoke('homework:pickFile', 'homework') as {
        filePath: string; content: string; filename: string
      } | null
      if (!file) { setImporting(false); return }
      const res = await window.electron.ipc.invoke('homework:importHomework', file.content) as ImportResult
      setResult(res)
    } catch (err) {
      setResult({
        counts: { seedArtists: 0, descriptors: 0, labels: 0, channels: 0, tracks: 0, excluded: 0, skipped: 0 },
        warnings: [],
        errors: [err instanceof Error ? err.message : 'Import failed'],
      })
    } finally {
      setImporting(false)
    }
  }

  async function handleTrackFileImport() {
    setImporting(true)
    setResult(null)
    try {
      const file = await window.electron.ipc.invoke('homework:pickFile', 'tracks') as {
        filePath: string; content: string; filename: string
      } | null
      if (!file) { setImporting(false); return }
      const res = await window.electron.ipc.invoke('homework:importTracks', file.content, file.filename) as ImportResult
      setResult(res)
    } catch (err) {
      setResult({
        counts: { seedArtists: 0, descriptors: 0, labels: 0, channels: 0, tracks: 0, excluded: 0, skipped: 0 },
        warnings: [],
        errors: [err instanceof Error ? err.message : 'Import failed'],
      })
    } finally {
      setImporting(false)
    }
  }

  async function handlePasteImport() {
    if (!pasteContent.trim()) return
    setImporting(true)
    setResult(null)
    try {
      const res = await window.electron.ipc.invoke('homework:importPastedTracks', pasteContent) as ImportResult
      setResult(res)
      if (res.errors.length === 0) setPasteContent('')
    } catch (err) {
      setResult({
        counts: { seedArtists: 0, descriptors: 0, labels: 0, channels: 0, tracks: 0, excluded: 0, skipped: 0 },
        warnings: [],
        errors: [err instanceof Error ? err.message : 'Import failed'],
      })
    } finally {
      setImporting(false)
    }
  }

  const totalImported = result
    ? result.counts.seedArtists + result.counts.descriptors + result.counts.labels +
      result.counts.channels + result.counts.tracks + result.counts.excluded
    : 0

  return (
    <div className="space-y-5">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
        {([
          { id: 'homework' as ImportMode, label: 'Homework Sheet' },
          { id: 'tracks' as ImportMode, label: 'Track List File' },
          { id: 'paste' as ImportMode, label: 'Paste Tracks' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveMode(tab.id); setResult(null) }}
            className={[
              'flex-1 px-3 py-1.5 rounded-md text-sm transition-colors',
              activeMode === tab.id
                ? 'bg-accent/15 text-accent-light font-medium'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Homework sheet mode */}
      {activeMode === 'homework' && (
        <div className="space-y-3">
          <p className="text-text-secondary text-sm leading-relaxed">
            Import your filled-out <code className="text-accent-light bg-bg-surface px-1 rounded">BACKLOG-homework.md</code> file.
            This imports seed artists, taste descriptors, trusted labels, source channels, and exclusions all at once.
          </p>
          <button
            onClick={handleHomeworkImport}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40"
          >
            {importing ? (
              <><LoadingSpinner size={14} /> Importing...</>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Import from Homework Sheet
              </>
            )}
          </button>
        </div>
      )}

      {/* Track list file mode */}
      {activeMode === 'tracks' && (
        <div className="space-y-3">
          <p className="text-text-secondary text-sm leading-relaxed">
            Import tracks from a CSV, JSON, or plain text file. Tracks are added as seeds and will be
            scored in the next pipeline run.
          </p>
          <div className="text-xs text-text-muted space-y-1">
            <div><strong>CSV:</strong> columns for artist and title (header row optional)</div>
            <div><strong>JSON:</strong> array of {`{ "artist": "...", "title": "..." }`} objects</div>
            <div><strong>Text:</strong> one track per line as <code className="bg-bg-surface px-1 rounded">Artist - Title</code></div>
          </div>
          <button
            onClick={handleTrackFileImport}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40"
          >
            {importing ? (
              <><LoadingSpinner size={14} /> Importing...</>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Choose File
              </>
            )}
          </button>
        </div>
      )}

      {/* Paste mode */}
      {activeMode === 'paste' && (
        <div className="space-y-3">
          <p className="text-text-secondary text-sm leading-relaxed">
            Paste tracks directly, one per line as <code className="text-accent-light bg-bg-surface px-1 rounded">Artist - Title</code>.
          </p>
          <textarea
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder={`Bonobo - Kerala\nNujabes - Aruarian Dance\nFour Tet - Baby\nTycho - Awake`}
            rows={6}
            className="w-full px-3 py-2 rounded-lg text-sm bg-bg-elevated border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono resize-y"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handlePasteImport}
              disabled={importing || !pasteContent.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40"
            >
              {importing ? (
                <><LoadingSpinner size={14} /> Importing...</>
              ) : (
                'Import Tracks'
              )}
            </button>
            {pasteContent.trim() && (
              <span className="text-xs text-text-muted">
                {pasteContent.trim().split('\n').filter(Boolean).length} lines
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div
          className="p-4 rounded-xl border space-y-3"
          style={{
            background: result.errors.length > 0
              ? 'rgba(239,68,68,0.08)'
              : 'rgba(34,197,94,0.08)',
            borderColor: result.errors.length > 0
              ? 'rgba(239,68,68,0.25)'
              : 'rgba(34,197,94,0.25)',
          }}
        >
          {/* Summary */}
          <div className="flex items-center gap-2">
            {result.errors.length > 0 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(239,68,68)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(34,197,94)" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            )}
            <span className="font-medium text-sm text-text-primary">
              {totalImported > 0
                ? `Imported ${totalImported} item${totalImported !== 1 ? 's' : ''}`
                : 'Nothing imported'}
              {result.counts.skipped > 0 && ` (${result.counts.skipped} duplicates skipped)`}
            </span>
          </div>

          {/* Breakdown */}
          {totalImported > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
              {result.counts.seedArtists > 0 && <span>{result.counts.seedArtists} seed artists</span>}
              {result.counts.tracks > 0 && <span>{result.counts.tracks} tracks</span>}
              {result.counts.descriptors > 0 && <span>{result.counts.descriptors} descriptors</span>}
              {result.counts.labels > 0 && <span>{result.counts.labels} labels</span>}
              {result.counts.channels > 0 && <span>{result.counts.channels} channels</span>}
              {result.counts.excluded > 0 && <span>{result.counts.excluded} exclusions</span>}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-yellow-400">Warnings</div>
              <div className="text-xs text-text-muted max-h-24 overflow-y-auto space-y-0.5">
                {result.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-red-400">Errors</div>
              <div className="text-xs text-text-muted max-h-24 overflow-y-auto space-y-0.5">
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
