import type { CodeEntity, LanguageConfig } from '../types'

const RUBY_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  method: 'method',
  singleton_method: 'method',
  class: 'class',
  module: 'class',
}

// Ruby imports are 'call' nodes filtered to require/require_relative in extractor
const RUBY_IMPORT_TYPES = ['call']

export const rubyConfig: LanguageConfig = {
  entityTypes: RUBY_ENTITY_TYPES,
  importTypes: RUBY_IMPORT_TYPES,
}
