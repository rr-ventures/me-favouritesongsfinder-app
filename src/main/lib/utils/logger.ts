export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  data?: unknown
  timestamp: string
}

const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL

export function log(level: LogLevel, message: string, data?: unknown): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  }

  if (isDev || level === 'error' || level === 'warn') {
    const prefix = `[MixingSongFinder][${level.toUpperCase()}]`
    if (level === 'error') {
      console.error(prefix, message, data ?? '')
    } else if (level === 'warn') {
      console.warn(prefix, message, data ?? '')
    } else {
      console.log(prefix, message, data ?? '')
    }
  }

  return entry
}

export const logger = {
  debug: (message: string, data?: unknown) => log('debug', message, data),
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
}
