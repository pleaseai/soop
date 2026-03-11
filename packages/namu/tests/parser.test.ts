import type { SupportedLanguage } from '@pleaseai/soop-namu'

import { describe, expect, it } from 'vitest'

import { createParser, getLanguage, initNamu, isAvailable, resolveWasmPath } from '../src/index'

describe('namu: WASM tree-sitter', () => {
  it('isAvailable() always returns true', () => {
    expect(isAvailable()).toBe(true)
  })

  it('resolveWasmPath returns a string path for each supported language', () => {
    const langs: SupportedLanguage[] = [
      'typescript',
      'javascript',
      'python',
      'rust',
      'go',
      'java',
      'csharp',
      'c',
      'cpp',
      'ruby',
      'kotlin',
    ]
    for (const lang of langs) {
      const wasmPath = resolveWasmPath(lang)
      expect(typeof wasmPath).toBe('string')
      expect(wasmPath).toContain('.wasm')
    }
  })

  it('resolveWasmPath points to existing WASM files', async () => {
    const fs = await import('node:fs/promises')
    const langs: SupportedLanguage[] = [
      'typescript',
      'javascript',
      'python',
      'rust',
      'go',
      'java',
      'csharp',
      'c',
      'cpp',
      'ruby',
      'kotlin',
    ]
    for (const lang of langs) {
      const wasmPath = resolveWasmPath(lang)
      await expect(fs.access(wasmPath)).resolves.toBeUndefined()
    }
  })

  describe('Parser initialization', () => {
    it('initNamu() initializes the WASM runtime', async () => {
      await expect(initNamu()).resolves.toBeUndefined()
    })

    it('initNamu() is idempotent', async () => {
      await initNamu()
      await expect(initNamu()).resolves.toBeUndefined()
    })

    it('createParser() returns a Parser instance', async () => {
      const parser = await createParser()
      expect(parser).toBeDefined()
    })
  })

  describe('Language loading', () => {
    it.each<SupportedLanguage>([
      'typescript',
      'javascript',
      'python',
      'rust',
      'go',
      'java',
      'csharp',
      'c',
      'cpp',
      'ruby',
      'kotlin',
    ])('getLanguage(%s) loads the grammar', async (lang) => {
      const language = await getLanguage(lang)
      expect(language).toBeDefined()
    })
  })

  describe('Parsing code', () => {
    it('parses TypeScript code and returns a syntax tree', async () => {
      const parser = await createParser()
      const lang = await getLanguage('typescript')
      parser.setLanguage(lang)
      const tree = parser.parse('function hello(name: string): string { return name }')
      expect(tree).toBeDefined()
      expect(tree.rootNode).toBeDefined()
      expect(tree.rootNode.type).toBe('program')
      expect(tree.rootNode.hasError).toBe(false)
    })

    it('parses JavaScript code', async () => {
      const parser = await createParser()
      const lang = await getLanguage('javascript')
      parser.setLanguage(lang)
      const tree = parser.parse('const x = 42')
      expect(tree.rootNode.type).toBe('program')
      expect(tree.rootNode.hasError).toBe(false)
    })

    it('parses Python code', async () => {
      const parser = await createParser()
      const lang = await getLanguage('python')
      parser.setLanguage(lang)
      const tree = parser.parse('def greet(name):\n  return f"Hello, {name}"')
      expect(tree.rootNode.type).toBe('module')
      expect(tree.rootNode.hasError).toBe(false)
    })

    it('parses Rust code', async () => {
      const parser = await createParser()
      const lang = await getLanguage('rust')
      parser.setLanguage(lang)
      const tree = parser.parse('fn main() { println!("Hello"); }')
      expect(tree.rootNode.type).toBe('source_file')
      expect(tree.rootNode.hasError).toBe(false)
    })

    it('parses Go code', async () => {
      const parser = await createParser()
      const lang = await getLanguage('go')
      parser.setLanguage(lang)
      const tree = parser.parse('package main\nfunc main() {}')
      expect(tree.rootNode.type).toBe('source_file')
      expect(tree.rootNode.hasError).toBe(false)
    })

    it('exposes SyntaxNode API (type, text, children, startPosition, endPosition)', async () => {
      const parser = await createParser()
      const lang = await getLanguage('typescript')
      parser.setLanguage(lang)
      const tree = parser.parse('const x = 1')
      const root = tree.rootNode
      expect(typeof root.type).toBe('string')
      expect(typeof root.text).toBe('string')
      expect(Array.isArray(root.children)).toBe(true)
      expect(typeof root.startPosition.row).toBe('number')
      expect(typeof root.endPosition.column).toBe('number')
    })
  })
})
