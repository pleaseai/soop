import type { CodeEntity, LanguageConfig } from '../types'

const C = require('tree-sitter-c')
const Cpp = require('tree-sitter-cpp')

const C_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_definition: 'function',
  struct_specifier: 'class',
  enum_specifier: 'class',
}

const CPP_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_definition: 'function',
  class_specifier: 'class',
  struct_specifier: 'class',
  enum_specifier: 'class',
}

const C_CPP_IMPORT_TYPES = ['preproc_include']

export const cConfig: LanguageConfig = {
  parser: C,
  entityTypes: C_ENTITY_TYPES,
  importTypes: C_CPP_IMPORT_TYPES,
}

export const cppConfig: LanguageConfig = {
  parser: Cpp,
  entityTypes: CPP_ENTITY_TYPES,
  importTypes: C_CPP_IMPORT_TYPES,
}
