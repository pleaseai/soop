import type { CodeEntity, LanguageConfig } from '../types'

let C: unknown
let Cpp: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  C = require('tree-sitter-c')
}
catch (err) {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
    throw err
  }
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Cpp = require('tree-sitter-cpp')
}
catch (err) {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
    throw err
  }
}

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

export const cConfig: LanguageConfig | undefined = C
  ? {
      parser: C as LanguageConfig['parser'],
      entityTypes: C_ENTITY_TYPES,
      importTypes: C_CPP_IMPORT_TYPES,
    }
  : undefined

export const cppConfig: LanguageConfig | undefined = Cpp
  ? {
      parser: Cpp as LanguageConfig['parser'],
      entityTypes: CPP_ENTITY_TYPES,
      importTypes: C_CPP_IMPORT_TYPES,
    }
  : undefined
