import type { CodeEntity, LanguageConfig } from '../types'

let Kotlin: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Kotlin = require('tree-sitter-kotlin')
}
catch {}

const KOTLIN_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_declaration: 'function',
  class_declaration: 'class',
  object_declaration: 'class',
  interface_declaration: 'class',
}

const KOTLIN_IMPORT_TYPES = ['import_header']

export const kotlinConfig: LanguageConfig | undefined = Kotlin
  ? {
      parser: Kotlin as LanguageConfig['parser'],
      entityTypes: KOTLIN_ENTITY_TYPES,
      importTypes: KOTLIN_IMPORT_TYPES,
    }
  : undefined
