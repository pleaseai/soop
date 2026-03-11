import type { SupportedLanguage } from '@pleaseai/soop-utils/ast/types'

import type { NamuLanguage, NamuParser } from './types'

import { Language, Parser } from 'web-tree-sitter'
import { resolveWasmPath } from './languages'

let initialized = false

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
 * Auto-initializes the WASM runtime if needed.
 */
export async function getLanguage(lang: SupportedLanguage): Promise<NamuLanguage> {
  await initNamu()
  const wasmPath = resolveWasmPath(lang)
  return Language.load(wasmPath) as unknown as NamuLanguage
}

/**
 * Check whether namu (WASM tree-sitter) can be initialized.
 * Always returns true — WASM has no native compilation requirements.
 */
export function isAvailable(): boolean {
  return true
}
