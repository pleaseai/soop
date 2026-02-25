import type { CodeEntity, LanguageConfig } from '../types'

let Java: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Java = require('tree-sitter-java')
}
catch {}

const JAVA_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  method_declaration: 'method',
  class_declaration: 'class',
  interface_declaration: 'class',
  enum_declaration: 'class',
  constructor_declaration: 'method',
}

const JAVA_IMPORT_TYPES = ['import_declaration']

export const javaConfig: LanguageConfig | undefined = Java
  ? {
      parser: Java as LanguageConfig['parser'],
      entityTypes: JAVA_ENTITY_TYPES,
      importTypes: JAVA_IMPORT_TYPES,
    }
  : undefined
