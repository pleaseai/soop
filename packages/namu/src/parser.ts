import type { NamuLanguage, NamuParser, SupportedLanguage } from './types'

import { Language, Parser } from 'web-tree-sitter'
import { resolveWasmPath } from './languages'

let initialized = false
const languageCache = new Map<string, NamuLanguage>()

/**
 * One-time WASM runtime init (lazy, idempotent).
 */
export async function initNamu(): Promise<void> {
  if (initialized)
    return
  await Parser.init()
  initialized = true
}

/**
 * Create a new Parser instance. Auto-initializes the WASM runtime if needed.
 */
export async function createParser(): Promise<NamuParser> {
  await initNamu()
  return new Parser() as unknown as NamuParser
}

/**
 * Load a language grammar by SupportedLanguage name.
 * Caches loaded grammars to avoid redundant disk reads.
 * Auto-initializes the WASM runtime if needed.
 */
export async function getLanguage(lang: SupportedLanguage): Promise<NamuLanguage> {
  await initNamu()
  const cached = languageCache.get(lang)
  if (cached)
    return cached
  const wasmPath = resolveWasmPath(lang)
  const language = await Language.load(wasmPath) as unknown as NamuLanguage
  languageCache.set(lang, language)
  return language
}

/**
 * Check whether namu (WASM tree-sitter) can be initialized.
 * Always returns true — WASM has no native compilation requirements.
 */
export function isAvailable(): boolean {
  return true
}
