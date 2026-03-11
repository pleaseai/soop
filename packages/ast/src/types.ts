import type { SupportedLanguage } from '@pleaseai/soop-namu'

// Re-export SupportedLanguage from namu (canonical definition)
export type { SupportedLanguage }

/**
 * Parsed code entity from AST
 */
export interface CodeEntity {
  /** Entity type */
  type: 'function' | 'class' | 'method'
  /** Entity name */
  name: string
  /** Start line (1-indexed) */
  startLine: number
  /** End line (1-indexed) */
  endLine: number
  /** Start column */
  startColumn: number
  /** End column */
  endColumn: number
  /** Docstring or comment */
  documentation?: string
  /** Parameters for functions/methods */
  parameters?: string[]
  /** Return type annotation */
  returnType?: string
  /** Parent entity (for methods) */
  parent?: string
}

/**
 * Result of parsing a file
 */
export interface ParseResult {
  /** Detected language */
  language: string
  /** Extracted entities */
  entities: CodeEntity[]
  /** Import statements */
  imports: Array<{ module: string, names: string[] }>
  /** Parsing errors */
  errors: string[]
}

/**
 * Language configurations with AST node type mappings
 */
export interface LanguageConfig {
  entityTypes: Record<string, CodeEntity['type']>
  importTypes: string[]
}
