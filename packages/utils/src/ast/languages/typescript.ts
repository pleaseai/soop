import type { CodeEntity, LanguageConfig } from '../types'

// Tree-sitter language parser (optional — not available in compiled Bun binary)
let TypeScript: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TypeScript = require('tree-sitter-typescript').typescript
}
catch (err) {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
    throw err
  }
}

/**
 * Entity node types for TypeScript and JavaScript
 */
const TS_JS_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_declaration: 'function',
  arrow_function: 'function',
  class_declaration: 'class',
  method_definition: 'method',
}

/**
 * Import node types for TypeScript and JavaScript
 */
const TYPESCRIPT_IMPORT_TYPES = ['import_statement']

/**
 * Language configuration for TypeScript
 */
export const typescriptConfig: LanguageConfig | undefined = TypeScript
  ? {
      parser: TypeScript as LanguageConfig['parser'],
      entityTypes: TS_JS_ENTITY_TYPES,
      importTypes: TYPESCRIPT_IMPORT_TYPES,
    }
  : undefined

/**
 * Language configuration for JavaScript
 * Uses the same TypeScript parser as JavaScript is a subset of TypeScript
 */
export const javascriptConfig: LanguageConfig | undefined = TypeScript
  ? {
      parser: TypeScript as LanguageConfig['parser'],
      entityTypes: TS_JS_ENTITY_TYPES,
      importTypes: TYPESCRIPT_IMPORT_TYPES,
    }
  : undefined
