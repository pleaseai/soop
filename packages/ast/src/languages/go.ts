import type { CodeEntity, LanguageConfig } from '../types'

const GO_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  function_declaration: 'function',
  method_declaration: 'method',
  type_spec: 'class',
}

const GO_IMPORT_TYPES = ['import_spec']

export const goConfig: LanguageConfig = {
  entityTypes: GO_ENTITY_TYPES,
  importTypes: GO_IMPORT_TYPES,
}
