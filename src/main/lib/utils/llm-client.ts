import { getApiKey, isMockMode } from '../settings/store.js'
import { CostTracker } from '../pipeline/cost-tracker.js'
import { logger } from './logger.js'

export interface LlmResult {
  text: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  model: string
}

export async function callLlm(prompt: string, options: {
  preferClaude?: boolean
  maxOutputTokens?: number
  stepName?: string
} = {}): Promise<LlmResult | null> {
  const { preferClaude = true, maxOutputTokens = 2000 } = options

  const anthropicKey = await getApiKey('anthropic_key')
  const geminiKey = await getApiKey('gemini_key')

  if (preferClaude && anthropicKey && !(await isMockMode('anthropic_key'))) {
    return callClaude(prompt, anthropicKey, maxOutputTokens)
  }

  if (geminiKey && !(await isMockMode('gemini_key'))) {
    return callGemini(prompt, geminiKey, maxOutputTokens)
  }

  return null
}

async function callClaude(prompt: string, apiKey: string, maxTokens: number): Promise<LlmResult | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      logger.warn('Claude API error', { status: res.status })
      return null
    }

    const json = await res.json() as {
      content?: Array<{ type: string; text: string }>
      usage?: { input_tokens: number; output_tokens: number }
    }

    const text = json.content?.find((c) => c.type === 'text')?.text ?? ''
    const inputTokens = json.usage?.input_tokens ?? 0
    const outputTokens = json.usage?.output_tokens ?? 0
    const costUsd = CostTracker.estimateUsd('claude-3-haiku', inputTokens, outputTokens)

    return { text, inputTokens, outputTokens, costUsd, model: 'claude-3-haiku' }
  } catch (e) {
    logger.error('Claude call failed', e)
    return null
  }
}

async function callGemini(prompt: string, apiKey: string, maxTokens: number): Promise<LlmResult | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      },
    )

    if (!res.ok) return null

    const json = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const inputTokens = json.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0
    const costUsd = CostTracker.estimateUsd('gemini-1.5-flash', inputTokens, outputTokens)

    return { text, inputTokens, outputTokens, costUsd, model: 'gemini-1.5-flash' }
  } catch (e) {
    logger.error('Gemini call failed', e)
    return null
  }
}

export function parseJsonFromLlm<T>(text: string): T | null {
  try {
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    // Try to extract JSON array/object from text
    const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (match) {
      try { return JSON.parse(match[1]) as T } catch { /* fall through */ }
    }
    return null
  }
}
