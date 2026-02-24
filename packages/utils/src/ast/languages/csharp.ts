import type { CodeEntity, LanguageConfig } from '../types'

const CSharp = require('tree-sitter-c-sharp')

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

export const csharpConfig: LanguageConfig = {
  parser: CSharp,
  entityTypes: CSHARP_ENTITY_TYPES,
  importTypes: CSHARP_IMPORT_TYPES,
}
