import type { SupportedLanguage } from './types'

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Maps SupportedLanguage → WASM filename in packages/namu/wasm/
const WASM_MAP: Record<SupportedLanguage, string> = {
  typescript: 'tree-sitter-typescript.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
  rust: 'tree-sitter-rust.wasm',
  go: 'tree-sitter-go.wasm',
  java: 'tree-sitter-java.wasm',
  csharp: 'tree-sitter-c_sharp.wasm',
  c: 'tree-sitter-c.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  ruby: 'tree-sitter-ruby.wasm',
  kotlin: 'tree-sitter-kotlin.wasm',
}

function findWasmDir(): string {
  const MAX_UPWARD_SEARCH = 10
  let dir = path.dirname(fileURLToPath(import.meta.url))
  const startDir = dir
  for (let i = 0; i < MAX_UPWARD_SEARCH; i++) {
    const candidate = path.join(dir, 'wasm')
    if (existsSync(path.join(candidate, 'tree-sitter-typescript.wasm'))) {
      return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }
  throw new Error(`Could not find tree-sitter WASM directory. Searched ${MAX_UPWARD_SEARCH} levels up from ${startDir}.`)
}

const wasmDir = findWasmDir()

/**
 * Resolve the absolute path to a language's WASM grammar file.
 * WASMs are built by `bun run build:wasm` and stored in packages/namu/wasm/.
 */
export function resolveWasmPath(lang: SupportedLanguage): string {
  return path.join(wasmDir, WASM_MAP[lang])
}

export { WASM_MAP }
