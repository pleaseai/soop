import type { CodeEntity, LanguageConfig } from '../types'

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
export const typescriptConfig: LanguageConfig = {
  entityTypes: TS_JS_ENTITY_TYPES,
  importTypes: TYPESCRIPT_IMPORT_TYPES,
}

/**
 * Language configuration for JavaScript
 */
export const javascriptConfig: LanguageConfig = {
  entityTypes: TS_JS_ENTITY_TYPES,
  importTypes: TYPESCRIPT_IMPORT_TYPES,
}
