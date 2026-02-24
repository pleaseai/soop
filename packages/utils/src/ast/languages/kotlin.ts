import type { CodeEntity, LanguageConfig } from '../types'

const Kotlin = require('tree-sitter-kotlin')

const KOTLIN_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_declaration: 'function',
  class_declaration: 'class',
  object_declaration: 'class',
  interface_declaration: 'class',
}

const KOTLIN_IMPORT_TYPES = ['import_header']

export const kotlinConfig: LanguageConfig = {
  parser: Kotlin,
  entityTypes: KOTLIN_ENTITY_TYPES,
  importTypes: KOTLIN_IMPORT_TYPES,
}
