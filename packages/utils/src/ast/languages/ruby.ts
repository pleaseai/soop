import type { CodeEntity, LanguageConfig } from '../types'

let Ruby: unknown
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Ruby = require('tree-sitter-ruby')
}
catch (err) {
  const code = (err as NodeJS.ErrnoException).code
  if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
    throw err
  }
}

const RUBY_ENTITY_TYPES: Record<string, CodeEntity['type']> = {
  method: 'method',
  singleton_method: 'method',
  class: 'class',
  module: 'class',
}

// Ruby imports are 'call' nodes filtered to require/require_relative in extractor
const RUBY_IMPORT_TYPES = ['call']

export const rubyConfig: LanguageConfig | undefined = Ruby
  ? {
      parser: Ruby as LanguageConfig['parser'],
      entityTypes: RUBY_ENTITY_TYPES,
      importTypes: RUBY_IMPORT_TYPES,
    }
  : undefined
