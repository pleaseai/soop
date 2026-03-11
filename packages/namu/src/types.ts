/**
 * Minimal type declarations for web-tree-sitter@0.24.x
 *
 * web-tree-sitter@0.24.x uses `export = Parser` (CJS namespace style).
 * The monorepo root may have a different version visible to the TypeScript
 * language server, so we declare the required types locally.
 */

/**
 * Languages supported by the WASM tree-sitter grammars in soop-namu.
 */
export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java' | 'csharp' | 'c' | 'cpp' | 'ruby' | 'kotlin'
export interface NamuPoint {
  row: number
  column: number
}

export interface NamuNode {
  type: string
  text: string
  children: NamuNode[]
  namedChildren: NamuNode[]
  childCount: number
  namedChildCount: number
  startPosition: NamuPoint
  endPosition: NamuPoint
  startIndex: number
  endIndex: number
  parent: NamuNode | null
  hasError: boolean
  isNamed: boolean
  isMissing: boolean
  childForFieldName: (fieldName: string) => NamuNode | null
  child: (index: number) => NamuNode | null
  namedChild: (index: number) => NamuNode | null
  nextSibling: NamuNode | null
  previousSibling: NamuNode | null
  toString: () => string
}

export interface NamuTree {
  rootNode: NamuNode
  copy: () => NamuTree
  delete: () => void
}

export interface NamuLanguage {
  readonly version: number
}

export interface NamuParser {
  setLanguage: (language: NamuLanguage | null) => void
  parse: (input: string) => NamuTree
  delete: () => void
}
