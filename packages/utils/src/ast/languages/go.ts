import type { CodeEntity, LanguageConfig } from '../types'

let Go: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Go = require('tree-sitter-go')
}
catch {}

const GO_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_declaration: 'function',
  method_declaration: 'method',
  type_spec: 'class',
}

const GO_IMPORT_TYPES = ['import_spec']

export const goConfig: LanguageConfig | undefined = Go
  ? {
      parser: Go as LanguageConfig['parser'],
      entityTypes: GO_ENTITY_TYPES,
      importTypes: GO_IMPORT_TYPES,
    }
  : undefined
