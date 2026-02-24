import type { LanguageConfig, SupportedLanguage } from '../types'
import { cConfig, cppConfig } from './c-cpp'
import { csharpConfig } from './csharp'
import { goConfig } from './go'
import { javaConfig } from './java'
import { kotlinConfig } from './kotlin'
import { pythonConfig } from './python'
import { rubyConfig } from './ruby'
import { rustConfig } from './rust'
import { javascriptConfig, typescriptConfig } from './typescript'

/**
 * Language configurations for all supported languages
 * Maps language names to their AST parsing configurations
 */
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  typescript: typescriptConfig,
  javascript: javascriptConfig,
  python: pythonConfig,
  rust: rustConfig,
  go: goConfig,
  java: javaConfig,
  csharp: csharpConfig,
  c: cConfig,
  cpp: cppConfig,
  ruby: rubyConfig,
  kotlin: kotlinConfig,
} as const

export { cConfig, cppConfig } from './c-cpp'
export { csharpConfig } from './csharp'
export { goConfig } from './go'
export { javaConfig } from './java'
export { kotlinConfig } from './kotlin'
export { pythonConfig } from './python'
export { rubyConfig } from './ruby'
export { rustConfig } from './rust'
export { javascriptConfig, typescriptConfig } from './typescript'
