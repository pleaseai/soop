import type { CodeEntity, LanguageConfig } from '../types'

const Ruby = require('tree-sitter-ruby')

const RUBY_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  method: 'method',
  singleton_method: 'method',
  class: 'class',
  module: 'class',
}

// Ruby imports are 'call' nodes filtered to require/require_relative in extractor
const RUBY_IMPORT_TYPES = ['call']

export const rubyConfig: LanguageConfig = {
  parser: Ruby,
  entityTypes: RUBY_ENTITY_TYPES,
  importTypes: RUBY_IMPORT_TYPES,
}
