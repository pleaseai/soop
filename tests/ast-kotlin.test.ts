import { ASTParser } from '@pleaseai/rpg-utils/ast'
import { beforeEach, describe, expect, it } from 'vitest'

describe('ASTParser - Kotlin', () => {
  let parser: ASTParser

  beforeEach(() => {
    parser = new ASTParser()
  })

  it('supports kotlin language', () => {
    expect(parser.isLanguageSupported('kotlin')).toBe(true)
  })

  it('detects .kt extension as kotlin', () => {
    expect(parser.detectLanguage('Main.kt')).toBe('kotlin')
  })

  it('detects .kts extension as kotlin', () => {
    expect(parser.detectLanguage('build.gradle.kts')).toBe('kotlin')
  })

  describe('parse - Kotlin entities', () => {
    it('extracts class_declaration', async () => {
      const source = `class User(val name: String) {
    fun greet(): String = "Hello, $name"
}`
      const result = await parser.parse(source, 'kotlin')

      const classEntity = result.entities.find(e => e.type === 'class' && e.name === 'User')
      expect(classEntity).toBeDefined()
    })

    it('extracts function_declaration', async () => {
      const source = `fun add(a: Int, b: Int): Int {
    return a + b
}`
      const result = await parser.parse(source, 'kotlin')

      const funcEntity = result.entities.find(e => e.name === 'add')
      expect(funcEntity).toBeDefined()
      expect(funcEntity!.type).toBe('function')
    })

    it('extracts interface_declaration', async () => {
      const source = `interface Greeter {
    fun greet(name: String): String
}`
      const result = await parser.parse(source, 'kotlin')

      const ifaceEntity = result.entities.find(e => e.name === 'Greeter')
      expect(ifaceEntity).toBeDefined()
      expect(ifaceEntity!.type).toBe('class')
    })

    it('extracts object_declaration', async () => {
      const source = `object Singleton {
    fun getInstance() = this
}`
      const result = await parser.parse(source, 'kotlin')

      const objEntity = result.entities.find(e => e.name === 'Singleton')
      expect(objEntity).toBeDefined()
      expect(objEntity!.type).toBe('class')
    })

    it('handles empty source', async () => {
      const result = await parser.parse('', 'kotlin')
      expect(result.entities).toEqual([])
      expect(result.imports).toEqual([])
      expect(result.errors).toEqual([])
    })
  })

  describe('parse - Kotlin imports', () => {
    it('extracts import header', async () => {
      const source = `import com.example.User`
      const result = await parser.parse(source, 'kotlin')

      expect(result.imports.length).toBeGreaterThanOrEqual(1)
      const imp = result.imports.find(i => i.module === 'com.example.User')
      expect(imp).toBeDefined()
    })

    it('extracts multiple imports', async () => {
      const source = `import kotlin.collections.List
import kotlin.collections.Map`
      const result = await parser.parse(source, 'kotlin')

      expect(result.imports.length).toBeGreaterThanOrEqual(2)
      const modules = result.imports.map(i => i.module)
      expect(modules).toContain('kotlin.collections.List')
      expect(modules).toContain('kotlin.collections.Map')
    })
  })
})
