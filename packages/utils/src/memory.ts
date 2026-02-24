import type { ModelMessage } from 'ai'

export interface MemoryOptions {
  /**
   * Number of user-assistant pairs to keep in active context.
   * 0 means unlimited (keep all messages). Default: 5.
   *
   * Note: Unlike the Python reference where 0 means "keep nothing",
   * here 0 means unlimited.
   */
  contextWindow?: number
}

/**
 * Manages multi-turn LLM conversation history with a sliding context window.
 *
 * Keeps a full internal history and exposes a context-trimmed view for
 * `generateText({ messages })` calls.
 *
 * @example
 * ```typescript
 * const memory = new Memory({ contextWindow: 3 })
 * memory.addSystem('You are a helpful assistant.')
 *       .addUser('Extract entities from: Alice went to London.')
 * const response = await llm.generate(memory)
 * memory.addAssistant(response.content)
 *       .addUser('You missed Bob. Please extract remaining entities.')
 * const followUp = await llm.generate(memory)
 * ```
 */
export class Memory {
  private _history: ModelMessage[] = []
  readonly contextWindow: number

  constructor(options: MemoryOptions = {}) {
    this.contextWindow = options.contextWindow ?? 5
  }

  /** Append a system message and return `this` for chaining. */
  addSystem(content: string): this {
    this._history.push({ role: 'system', content })
    return this
  }

  /** Append a user message and return `this` for chaining. */
  addUser(content: string): this {
    this._history.push({ role: 'user', content })
    return this
  }

  /** Append an assistant message and return `this` for chaining. */
  addAssistant(content: string): this {
    this._history.push({ role: 'assistant', content: [{ type: 'text', text: content }] })
    return this
  }

  /** Append a raw `ModelMessage` and return `this` for chaining. */
  addMessage(msg: ModelMessage): this {
    this._history.push(msg)
    return this
  }

  /**
   * Return the most recent message, optionally filtered by role.
   * Returns `undefined` if the history is empty or no match is found.
   */
  last(role?: ModelMessage['role']): ModelMessage | undefined {
    if (this._history.length === 0)
      return undefined
    if (!role)
      return this._history[this._history.length - 1]
    for (let i = this._history.length - 1; i >= 0; i--) {
      if (this._history[i]!.role === role)
        return this._history[i]
    }
    return undefined
  }

  /** Total number of messages in full history. */
  get length(): number {
    return this._history.length
  }

  /** Full untruncated history (copy). */
  get fullHistory(): ModelMessage[] {
    return [...this._history]
  }

  /** Context-trimmed history (same as `toMessages()`). */
  get history(): ModelMessage[] {
    return this._trimToWindow(this._history)
  }

  /**
   * Return context-trimmed `ModelMessage[]` suitable for
   * `generateText({ messages })`.
   *
   * Algorithm (port of Python `keep_message_window`):
   * - Always keep the first system message (if any).
   * - Always keep the last user message (if the last message is user).
   * - From the remaining "middle" messages, keep only the last `contextWindow * 2`.
   * - `contextWindow: 0` → keep all messages (unlike Python where 0 = keep nothing).
   */
  toMessages(): ModelMessage[] {
    return this._trimToWindow(this._history)
  }

  /** Clear all conversation history. */
  clear(): void {
    this._history = []
  }

  private _trimToWindow(messages: ModelMessage[]): ModelMessage[] {
    if (messages.length === 0)
      return []

    // contextWindow: 0 means unlimited — return a copy of everything
    if (this.contextWindow === 0)
      return [...messages]

    const firstMsg = messages[0]!
    const hasSystem = firstMsg.role === 'system'
    const contextLimit = 2 * this.contextWindow

    const lastMsg = messages[messages.length - 1]!
    const lastIsUser = lastMsg.role === 'user'

    const startIndex = hasSystem ? 1 : 0
    const endIndex = lastIsUser ? messages.length - 1 : messages.length

    // Middle messages (excludes system and last-user)
    let middle = messages.slice(startIndex, endIndex)
    middle = middle.slice(-contextLimit)

    const result: ModelMessage[] = []
    if (hasSystem)
      result.push(firstMsg)
    result.push(...middle)
    if (lastIsUser)
      result.push(lastMsg)

    return result
  }
}
