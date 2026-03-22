import { useState, useEffect, useCallback, useRef } from 'react'
import type { PipelineEvent, StepStatus, RunOptions, RunPreset, RunScope } from '../../main/lib/pipeline/types'

export interface PipelineStepInfo {
  stepName: string
  displayName: string
  category: 'api' | 'scraped' | 'processing'
  description: string
  dependsOn: string[]
  estimatedCostUsd: number
  writes: string[]
  reads: string[]
  canRunAlone: boolean
  scopeLimits?: { quick: number; standard: number; full: number }
  status: string
  lastRun: unknown
  isRunning: boolean
  includeInRunAll: boolean
  elapsedMs?: number
  itemsDone?: number
  itemsTotal?: number
  progressPct?: number
}

export interface PipelineLog {
  stepName: string
  event: PipelineEvent
}

export interface DataCounts {
  artists: number
  tracks: number
  tags: number
  mixSources: number
  seeds: number
  scoredTracks: number
  pipelineRuns: number
}

export function usePipeline() {
  const [steps, setSteps] = useState<PipelineStepInfo[]>([])
  const [logs, setLogs] = useState<PipelineLog[]>([])
  const [loading, setLoading] = useState(true)
  const [runningSteps, setRunningSteps] = useState<Set<string>>(new Set())
  const [totalCostUsd, setTotalCostUsd] = useState(0)
  const [presets, setPresets] = useState<RunPreset[]>([])
  const [dataCounts, setDataCounts] = useState<DataCounts>({ artists: 0, tracks: 0, tags: 0, mixSources: 0, seeds: 0, scoredTracks: 0, pipelineRuns: 0 })
  const unsubRef = useRef<(() => void) | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [data, counts] = await Promise.all([
        window.electron.ipc.invoke('pipeline:getStatus') as Promise<PipelineStepInfo[]>,
        window.electron.ipc.invoke('pipeline:getDataCounts') as Promise<DataCounts>,
      ])
      setSteps(data)
      setDataCounts(counts)
      const running = new Set(data.filter((s) => s.isRunning).map((s) => s.stepName))
      setRunningSteps(running)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshDataCounts = useCallback(async () => {
    const counts = await window.electron.ipc.invoke('pipeline:getDataCounts') as DataCounts
    setDataCounts(counts)
  }, [])

  useEffect(() => {
    refresh()

    // Load presets
    window.electron.ipc.invoke('pipeline:getPresets').then((p) => {
      setPresets(p as RunPreset[])
    }).catch(() => {})

    // Subscribe to pipeline events
    const unsub = window.electron.ipc.on('pipeline:event', (...args: unknown[]) => {
      const event = args[0] as PipelineEvent & { stepName: string }

      setLogs((prev) => {
        const entry: PipelineLog = { stepName: event.stepName, event }
        const next = [...prev, entry]
        return next.length > 5000 ? next.slice(-5000) : next
      })

      if (event.type === 'complete' || event.type === 'error') {
        setRunningSteps((prev) => {
          const next = new Set(prev)
          next.delete(event.stepName)
          return next
        })
        // Refresh status and data counts after any completion
        refresh()
        refreshDataCounts()
      } else if (event.type === 'log' && event.message?.startsWith('▶')) {
        setRunningSteps((prev) => new Set([...prev, event.stepName]))
      }

      if (event.type === 'cost_update' && event.data) {
        const d = event.data as { totalUsd?: number; costUsd?: number }
        if (d.totalUsd !== undefined) setTotalCostUsd(d.totalUsd)
      }
    })

    unsubRef.current = unsub
    return () => unsub()
  }, [refresh, refreshDataCounts])

  const runStep = useCallback(async (stepName: string, options: RunOptions = {}) => {
    await window.electron.ipc.invoke('pipeline:run', stepName, options)
    setRunningSteps((prev) => new Set([...prev, stepName]))
  }, [])

  const cancelStep = useCallback(async (stepName: string) => {
    await window.electron.ipc.invoke('pipeline:cancel', stepName)
  }, [])

  const resumeStep = useCallback(async (stepName: string, runId: number, options: RunOptions = {}) => {
    await window.electron.ipc.invoke('pipeline:resume', stepName, runId, options)
  }, [])

  const runAll = useCallback(async (options: RunOptions = {}, stepNames?: string[]) => {
    await window.electron.ipc.invoke('pipeline:runAll', { ...options, stepNames })
  }, [])

  const runPreset = useCallback(async (presetId: string) => {
    await window.electron.ipc.invoke('pipeline:runPreset', presetId)
  }, [])

  const cancelAll = useCallback(async () => {
    await window.electron.ipc.invoke('pipeline:cancelAll')
    setRunningSteps(new Set())
  }, [])

  const getHistory = useCallback(async (stepName: string, limit = 10) => {
    return window.electron.ipc.invoke('pipeline:getHistory', stepName, limit)
  }, [])

  const getLogsForStep = useCallback((stepName: string) => {
    return logs.filter((l) => l.stepName === stepName).map((l) => l.event)
  }, [logs])

  const clearLogs = useCallback((stepName?: string) => {
    if (stepName) {
      setLogs((prev) => prev.filter((l) => l.stepName !== stepName))
    } else {
      setLogs([])
    }
  }, [])

  return {
    steps,
    logs,
    loading,
    runningSteps,
    totalCostUsd,
    presets,
    dataCounts,
    refresh,
    refreshDataCounts,
    runStep,
    cancelStep,
    resumeStep,
    runAll,
    runPreset,
    cancelAll,
    getHistory,
    getLogsForStep,
    clearLogs,
  }
}
