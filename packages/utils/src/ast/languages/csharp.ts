import type { CodeEntity, LanguageConfig } from '../types'

let CSharp: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  CSharp = require('tree-sitter-c-sharp')
}
catch (err) {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
    throw err
  }
}

const CSHARP_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  method_declaration: 'method',
  class_declaration: 'class',
  interface_declaration: 'class',
  enum_declaration: 'class',
  struct_declaration: 'class',
  record_declaration: 'class',
  constructor_declaration: 'method',
}

const CSHARP_IMPORT_TYPES = ['using_directive']

export const csharpConfig: LanguageConfig | undefined = CSharp
  ? {
      parser: CSharp as LanguageConfig['parser'],
      entityTypes: CSHARP_ENTITY_TYPES,
      importTypes: CSHARP_IMPORT_TYPES,
    }
  : undefined
