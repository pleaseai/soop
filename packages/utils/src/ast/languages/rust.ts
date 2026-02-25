import type { CodeEntity, LanguageConfig } from '../types'

let Rust: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Rust = require('tree-sitter-rust')
}
catch (err) {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
    throw err
  }
}

const RUST_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_item: 'function',
  struct_item: 'class',
  impl_item: 'class',
  trait_item: 'class',
  enum_item: 'class',
  mod_item: 'class',
}

const RUST_IMPORT_TYPES = ['use_declaration']

export const rustConfig: LanguageConfig | undefined = Rust
  ? {
      parser: Rust as LanguageConfig['parser'],
      entityTypes: RUST_ENTITY_TYPES,
      importTypes: RUST_IMPORT_TYPES,
    }
  : undefined
