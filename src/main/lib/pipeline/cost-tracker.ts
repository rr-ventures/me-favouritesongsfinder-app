// Tracks LLM token usage and converts to USD estimates.

// Pricing per million tokens (as of 2025)
const PRICING = {
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
} as const

type ModelName = keyof typeof PRICING

export interface CostEntry {
  stepName: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  timestamp: Date
}

export class CostTracker {
  private entries: CostEntry[] = []
  private onUpdate?: (totalUsd: number) => void

  constructor(onUpdate?: (totalUsd: number) => void) {
    this.onUpdate = onUpdate
  }

  track(stepName: string, model: ModelName | string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model as ModelName] ?? { input: 3.0, output: 15.0 }
    const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000

    this.entries.push({ stepName, model, inputTokens, outputTokens, costUsd, timestamp: new Date() })
    this.onUpdate?.(this.getTotalUsd())
    return costUsd
  }

  getTotalUsd(): number {
    return this.entries.reduce((sum, e) => sum + e.costUsd, 0)
  }

  getStepUsd(stepName: string): number {
    return this.entries.filter((e) => e.stepName === stepName).reduce((sum, e) => sum + e.costUsd, 0)
  }

  getEntries(): CostEntry[] {
    return [...this.entries]
  }

  reset(): void {
    this.entries = []
  }

  static estimateUsd(model: ModelName | string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model as ModelName] ?? { input: 3.0, output: 15.0 }
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  }

  static formatUsd(amount: number): string {
    if (amount < 0.01) return `< $0.01`
    return `$${amount.toFixed(2)}`
  }
}
