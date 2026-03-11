import type { SupportedLanguage } from './types'

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

const wasmDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'wasm')

/**
 * Resolve the absolute path to a language's WASM grammar file.
 * WASMs are built by `bun run build:wasm` and stored in packages/namu/wasm/.
 */
export function resolveWasmPath(lang: SupportedLanguage): string {
  return path.join(wasmDir, WASM_MAP[lang])
}

export { WASM_MAP }
