/**
 * Token-bucket style rate limiter.
 * Call `wait()` before each API request to enforce rate limits.
 */
export class RateLimiter {
  private lastCallTime = 0
  private readonly minIntervalMs: number

  constructor(options: { perSecond?: number; perMinute?: number }) {
    if (options.perSecond) {
      this.minIntervalMs = 1000 / options.perSecond
    } else if (options.perMinute) {
      this.minIntervalMs = 60_000 / options.perMinute
    } else {
      this.minIntervalMs = 0
    }
  }

  async wait(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastCallTime
    const remaining = this.minIntervalMs - elapsed

    if (remaining > 0) {
      await sleep(remaining)
    }

    this.lastCallTime = Date.now()
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exponential backoff helper for retry loops.
 */
export function backoffMs(attempt: number, baseMs = 1000, maxMs = 30_000): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs)
}

/**
 * Retry wrapper with exponential backoff.
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; backoffBaseMs?: number; stepName: string },
): Promise<T | null> {
  const base = options.backoffBaseMs ?? 1000

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      const err = error as { status?: number; statusCode?: number; message?: string }
      const isRateLimit = err.status === 429 || err.statusCode === 429

      if (attempt === options.maxRetries) {
        console.error(`[${options.stepName}] Failed after ${options.maxRetries} retries`, error)
        return null
      }

      const waitTime = isRateLimit
        ? backoffMs(attempt, base * 2)
        : backoffMs(attempt, base)

      console.warn(`[${options.stepName}] Attempt ${attempt + 1} failed, retrying in ${waitTime}ms`)
      await sleep(waitTime)
    }
  }

  return null
}
