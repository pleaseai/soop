import type { CodeEntity, LanguageConfig } from '../types'

// Tree-sitter language parser (optional — not available in compiled Bun binary)
let Python: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Python = require('tree-sitter-python')
}
catch {}

/**
 * Entity node types for Python
 */
const PYTHON_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_definition: 'function',
  async_function_definition: 'function',
  class_definition: 'class',
}

/**
 * Import node types for Python
 */
const PYTHON_IMPORT_TYPES = ['import_statement', 'import_from_statement']

/**
 * Language configuration for Python
 */
export const pythonConfig: LanguageConfig | undefined = Python
  ? {
      parser: Python as LanguageConfig['parser'],
      entityTypes: PYTHON_ENTITY_TYPES,
      importTypes: PYTHON_IMPORT_TYPES,
    }
  : undefined
