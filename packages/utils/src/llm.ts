import type { ModelMessage } from 'ai'
import type { ClaudeCodeSettings } from 'ai-sdk-provider-claude-code'
import type { CodexCliSettings } from 'ai-sdk-provider-codex-cli'
import type { ZodType } from 'zod/v4'
import type { Memory } from './memory'
import { spawn } from 'node:child_process'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
import { createClaudeCode } from 'ai-sdk-provider-claude-code'
import { createCodexCli } from 'ai-sdk-provider-codex-cli'
import { createLogger } from './logger'

const log = createLogger('LLMClient')

/**
 * LLM provider type
 */
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'claude-code' | 'codex'

/**
 * LLM client options
 */
export interface LLMOptions {
  /** Provider (openai, anthropic, google, or claude-code) */
  provider: LLMProvider
  /** API key (defaults to environment variable) */
  apiKey?: string
  /** Model name */
  model?: string
  /** Max tokens for response */
  maxTokens?: number
  /** Temperature for sampling */
  temperature?: number
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number
  /** Error callback */
  onError?: (error: Error, context: { model: string, promptLength: number }) => void
  /** Claude Code provider settings (only used when provider is 'claude-code') */
  claudeCodeSettings?: ClaudeCodeSettings
  /** Codex CLI provider settings (only used when provider is 'codex') */
  codexSettings?: CodexCliSettings
}

export type { ClaudeCodeSettings }
export type { CodexCliSettings }

/**
 * Options for multi-turn `generate()` calls.
 */
export interface GenerateOptions {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxRetries?: number
}

/**
 * LLM response
 */
export interface LLMResponse {
  /** Generated text */
  content: string
  /** Token usage */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** Model used */
  model: string
}

/**
 * Default models for each provider
 */
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  'openai': 'gpt-4o',
  'anthropic': 'claude-sonnet-4.5',
  'google': 'gemini-3-flash-preview',
  'claude-code': 'sonnet',
  'codex': 'gpt-5.3-codex',
}

/**
 * Pricing per million tokens (input, output) in USD
 */
const CLAUDE_SONNET_PRICING = { input: 3.00, output: 15.00 }
const CLAUDE_HAIKU_PRICING = { input: 1.00, output: 5.00 }
const CODEX_GPT5_PRICING = { input: 1.25, output: 10.00 }

const MODEL_PRICING: Record<string, { input: number, output: number }> = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-5': { input: 1.25, output: 10.00 },
  'gpt-5-mini': { input: 0.25, output: 2.00 },
  'claude-sonnet-4.5': CLAUDE_SONNET_PRICING,
  'claude-haiku-4.5': CLAUDE_HAIKU_PRICING,
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-3-pro-preview': { input: 2.00, output: 12.00 },
  'gemini-2.0-flash': { input: 0.30, output: 2.50 },
  // Claude Code provider uses model shortcuts (sonnet/opus/haiku).
  // Pricing reflects equivalent Claude API rates for cost estimation,
  // not actual charges (Claude Code uses subscription billing).
  'sonnet': CLAUDE_SONNET_PRICING,
  'opus': { input: 15.00, output: 75.00 },
  'haiku': CLAUDE_HAIKU_PRICING,
  // Codex CLI provider uses ChatGPT Plus/Pro subscription.
  // Pricing reflects equivalent OpenAI API rates for cost estimation,
  // not actual charges (Codex CLI uses subscription billing).
  'gpt-5.3-codex': CODEX_GPT5_PRICING,
  'gpt-5.2-codex': CODEX_GPT5_PRICING,
  'gpt-5.1-codex-max': CODEX_GPT5_PRICING,
}

/**
 * Create provider instance
 */
function createProvider(provider: LLMProvider, apiKey?: string, claudeCodeSettings?: ClaudeCodeSettings, codexSettings?: CodexCliSettings) {
  switch (provider) {
    case 'openai':
      return createOpenAI({
        apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      })
    case 'anthropic':
      return createAnthropic({
        apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
      })
    case 'google':
      return createGoogleGenerativeAI({
        apiKey: apiKey ?? process.env.GOOGLE_API_KEY,
      })
    case 'claude-code': {
      const settings: ClaudeCodeSettings = {
        // Defaults for automated/non-interactive use
        pathToClaudeCodeExecutable: process.env.CLAUDE_BIN ?? 'claude',
        persistSession: false,
        permissionMode: 'bypassPermissions',
        ...claudeCodeSettings,
        stderr: (data) => { log.debug('[claude stderr]', data.toString().trim()) },
        spawnClaudeCodeProcess: (options) => {
          // Remove CLAUDECODE and CLAUDE_CODE_SSE_PORT to allow running
          // inside an existing Claude Code session without being blocked.
          const { CLAUDECODE: _, CLAUDE_CODE_SSE_PORT: __, ...env } = options.env
          return spawn(options.command, options.args, {
            cwd: options.cwd,
            env,
            signal: options.signal,
            stdio: ['pipe', 'pipe', 'pipe'],
          })
        },
      }
      return createClaudeCode({ defaultSettings: settings })
    }
    case 'codex':
      return createCodexCli(codexSettings ? { defaultSettings: codexSettings } : undefined)
    default:
      throw new Error(`Unsupported LLM provider: ${String(provider satisfies never)}`)
  }
}

/**
 * Cumulative token usage statistics
 */
export interface TokenUsageStats {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  requestCount: number
}

const INITIAL_USAGE_STATS: TokenUsageStats = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  requestCount: 0,
}

/**
 * Parse a "provider/model" format string into provider and model components.
 *
 * @example
 * parseModelString('openai/gpt-5.2') // { provider: 'openai', model: 'gpt-5.2' }
 * parseModelString('claude-code/haiku') // { provider: 'claude-code', model: 'haiku' }
 * parseModelString('google') // { provider: 'google', model: undefined }
 */
export function parseModelString(modelString: string): { provider: LLMProvider, model?: string } {
  const slashIndex = modelString.indexOf('/')
  if (slashIndex === -1) {
    return { provider: validateProvider(modelString) }
  }
  const provider = validateProvider(modelString.substring(0, slashIndex))
  const model = modelString.substring(slashIndex + 1)
  return { provider, model: model || undefined }
}

function validateProvider(name: string): LLMProvider {
  const valid = Object.keys(DEFAULT_MODELS) as LLMProvider[]
  if (!valid.includes(name as LLMProvider)) {
    throw new Error(`Unknown LLM provider: "${name}". Valid providers: ${valid.join(', ')}`)
  }
  return name as LLMProvider
}

/**
 * Detect context-length errors from various LLM providers.
 */
function isContextLengthError(error: unknown): boolean {
  if (!(error instanceof Error))
    return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('context_length_exceeded')
    || msg.includes('context length')
    || msg.includes('too many tokens')
    || msg.includes('token limit')
    || msg.includes('maximum context')
  )
}

/**
 * LLM Client for semantic operations using Vercel AI SDK
 *
 * Used for:
 * - Semantic feature extraction
 * - Functional hierarchy construction
 * - Code generation
 *
 * Supports OpenAI, Anthropic, Google, Claude Code, and Codex CLI providers with unified interface.
 *
 * @example
 * ```typescript
 * // Use Gemini 3 Flash (recommended - free tier, best performance)
 * const client = new LLMClient({ provider: 'google', model: 'gemini-2.0-flash' })
 *
 * // Use Claude Haiku (fast, cost-effective)
 * const client = new LLMClient({ provider: 'anthropic', model: 'claude-3-5-haiku-latest' })
 *
 * // Use GPT-4o (paper baseline)
 * const client = new LLMClient({ provider: 'openai', model: 'gpt-4o' })
 *
 * // Use Claude Code (no API key needed, requires Claude Pro/Max subscription)
 * const client = new LLMClient({ provider: 'claude-code', model: 'sonnet' })
 *
 * // Use Codex CLI (no API key needed, requires ChatGPT Plus/Pro subscription)
 * const client = new LLMClient({ provider: 'codex', model: 'gpt-5.3-codex' })
 * ```
 */
export class LLMClient {
  private readonly options: LLMOptions
  private readonly providerInstance: ReturnType<typeof createProvider>
  private usageStats: TokenUsageStats = { ...INITIAL_USAGE_STATS }

  constructor(options: LLMOptions) {
    this.options = {
      model: DEFAULT_MODELS[options.provider],
      maxTokens: 4096,
      temperature: 0,
      ...options,
    }
    this.providerInstance = createProvider(options.provider, options.apiKey, options.claudeCodeSettings, options.codexSettings)
  }

  /**
   * Shared helper for generateText calls with error handling and usage tracking.
   */
  private async callGenerateText(
    prompt: string,
    systemPrompt?: string,
    output?: Parameters<typeof generateText>[0]['output'],
  ): Promise<Awaited<ReturnType<typeof generateText>>> {
    const modelId = this.options.model ?? DEFAULT_MODELS[this.options.provider]
    const model = this.providerInstance(modelId)
    const timeout = this.options.timeout ?? 120_000

    let result: Awaited<ReturnType<typeof generateText>>
    try {
      result = await generateText({
        model,
        output,
        system: systemPrompt,
        prompt,
        maxOutputTokens: this.options.maxTokens,
        temperature: this.options.temperature,
        abortSignal: AbortSignal.timeout(timeout),
      })
    }
    catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      log.error(`${modelId} error: ${err.message}`, err)
      this.options.onError?.(err, { model: modelId, promptLength: prompt.length })
      throw err
    }

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    this.usageStats.totalPromptTokens += inputTokens
    this.usageStats.totalCompletionTokens += outputTokens
    this.usageStats.totalTokens += inputTokens + outputTokens
    this.usageStats.requestCount++

    return result
  }

  /**
   * Generate a completion using Vercel AI SDK
   */
  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const result = await this.callGenerateText(prompt, systemPrompt)
    const modelId = this.options.model ?? DEFAULT_MODELS[this.options.provider]

    return {
      content: result.text,
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
      },
      model: modelId,
    }
  }

  /**
   * Generate structured JSON output.
   * When a Zod schema is provided, uses AI SDK's Output.object() for validated structured output.
   * Falls back to regex-based JSON extraction when no schema is given.
   */
  async completeJSON<T>(prompt: string, systemPrompt?: string, schema?: ZodType<T>): Promise<T> {
    if (schema) {
      const result = await this.callGenerateText(prompt, systemPrompt, Output.object({ schema }))

      if (result.output != null) {
        return result.output as T
      }

      // Structured output failed (non-'stop' finishReason from provider).
      // Try regex-based JSON extraction from result.text as fallback.
      const lastStep = result.steps?.[result.steps.length - 1]
      const finishReason = lastStep?.finishReason ?? 'unknown'
      log.debug(`Structured output unavailable (finishReason: ${finishReason}), trying text fallback`)

      if (result.text) {
        const jsonMatch
          = result.text.match(/```(?:json)?\n?([\s\S]*?)```/) || result.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0])
          return schema.parse(parsed) as T
        }
      }
      throw new Error(`No structured output from model (finishReason: ${finishReason})`)
    }

    // Fallback: regex-based JSON extraction for callers without schema
    const response = await this.complete(prompt, systemPrompt)
    const jsonMatch
      = response.content.match(/```(?:json)?\n?([\s\S]*?)```/)
        || response.content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    return JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as T
  }

  /**
   * Get the current provider
   */
  getProvider(): LLMProvider {
    return this.options.provider
  }

  /**
   * Get the current model
   */
  getModel(): string {
    return this.options.model ?? DEFAULT_MODELS[this.options.provider]
  }

  /**
   * Get cumulative token usage statistics
   */
  getUsageStats(): TokenUsageStats {
    return { ...this.usageStats }
  }

  /**
   * Estimate cost in USD based on token usage and model pricing
   */
  estimateCost(stats?: TokenUsageStats): { inputCost: number, outputCost: number, totalCost: number } {
    const s = stats ?? this.usageStats
    const modelId = this.getModel()
    const pricing = MODEL_PRICING[modelId]
    if (!pricing) {
      return { inputCost: 0, outputCost: 0, totalCost: 0 }
    }
    const inputCost = (s.totalPromptTokens / 1_000_000) * pricing.input
    const outputCost = (s.totalCompletionTokens / 1_000_000) * pricing.output
    return { inputCost, outputCost, totalCost: inputCost + outputCost }
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.usageStats = { ...INITIAL_USAGE_STATS }
  }

  /**
   * Shared helper for generateText calls using a messages array (multi-turn).
   * Mirrors `callGenerateText` but uses `{ messages }` instead of `{ prompt, system }`.
   */
  private async callGenerateTextWithMessages(
    messages: ModelMessage[],
    output?: Parameters<typeof generateText>[0]['output'],
  ): Promise<Awaited<ReturnType<typeof generateText>>> {
    const modelId = this.options.model ?? DEFAULT_MODELS[this.options.provider]
    const model = this.providerInstance(modelId)
    const timeout = this.options.timeout ?? 120_000

    let result: Awaited<ReturnType<typeof generateText>>
    try {
      result = await generateText({
        model,
        output,
        messages,
        maxOutputTokens: this.options.maxTokens,
        temperature: this.options.temperature,
        abortSignal: AbortSignal.timeout(timeout),
      })
    }
    catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      log.error(`${modelId} error: ${err.message}`, err)
      const totalLength = messages.reduce((sum, m) => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        return sum + content.length
      }, 0)
      this.options.onError?.(err, { model: modelId, promptLength: totalLength })
      throw err
    }

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    this.usageStats.totalPromptTokens += inputTokens
    this.usageStats.totalCompletionTokens += outputTokens
    this.usageStats.totalTokens += inputTokens + outputTokens
    this.usageStats.requestCount++

    return result
  }

  /**
   * Multi-turn completion using a `Memory` conversation history.
   *
   * Retries on transient errors (up to `maxRetries` total attempts).
   * On context-length errors, truncates the oldest user-assistant pair and
   * retries without consuming a retry count.
   */
  async generate(memory: Memory, options?: GenerateOptions): Promise<LLMResponse> {
    const maxRetries = options?.maxRetries ?? 3
    let messages = memory.toMessages()
    let retries = 0

    while (true) {
      try {
        const result = await this.callGenerateTextWithMessages(messages)
        const modelId = this.options.model ?? DEFAULT_MODELS[this.options.provider]
        return {
          content: result.text,
          usage: {
            promptTokens: result.usage?.inputTokens ?? 0,
            completionTokens: result.usage?.outputTokens ?? 0,
            totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
          },
          model: modelId,
        }
      }
      catch (error) {
        if (isContextLengthError(error)) {
          const truncated = this.truncateContext(messages)
          if (truncated !== null) {
            messages = truncated
            continue
          }
        }
        retries++
        if (retries >= maxRetries) {
          throw error
        }
      }
    }
  }

  /**
   * Multi-turn structured JSON output using a `Memory` conversation history.
   * When a Zod schema is provided, uses AI SDK's `Output.object()` for validated output.
   * Falls back to regex-based JSON extraction when no schema is given.
   */
  async generateJSON<T>(memory: Memory, schema?: ZodType<T>): Promise<T> {
    if (schema) {
      const messages = memory.toMessages()
      const result = await this.callGenerateTextWithMessages(messages, Output.object({ schema }))

      if (result.output == null) {
        throw new Error('No structured output returned from model')
      }

      return result.output as T
    }

    const response = await this.generate(memory)
    const jsonMatch
      = response.content.match(/```(?:json)?\n?([\s\S]*?)```/)
        || response.content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    return JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as T
  }

  /**
   * Remove the oldest user-assistant pair from the message list.
   * Returns the trimmed list, or `null` if there is nothing to remove.
   */
  private truncateContext(messages: ModelMessage[]): ModelMessage[] | null {
    const hasSystem = messages.length > 0 && messages[0]!.role === 'system'
    const startIndex = hasSystem ? 1 : 0

    for (let i = startIndex; i < messages.length - 1; i++) {
      if (messages[i]!.role === 'user' && messages[i + 1]!.role === 'assistant') {
        return [...messages.slice(0, i), ...messages.slice(i + 2)]
      }
    }

    return null
  }
}
