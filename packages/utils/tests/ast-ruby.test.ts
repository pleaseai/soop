import { ASTParser } from '@pleaseai/repo-utils/ast'
import { beforeEach, describe, expect, it } from 'vitest'

describe('ASTParser - Ruby', () => {
  let parser: ASTParser

  beforeEach(() => {
    parser = new ASTParser()
  })

  it('supports ruby language', () => {
    expect(parser.isLanguageSupported('ruby')).toBe(true)
  })

  it('detects .rb extension as ruby', () => {
    expect(parser.detectLanguage('app.rb')).toBe('ruby')
  })

  describe('parse - Ruby entities', () => {
    it('extracts class', async () => {
      const source = `class Animal
  def speak
    puts "..."
  end
end`
      const result = await parser.parse(source, 'ruby')

      const classEntity = result.entities.find(e => e.type === 'class' && e.name === 'Animal')
      expect(classEntity).toBeDefined()
    })

    it('extracts method', async () => {
      const source = `class Greeter
  def greet(name)
    "Hello, #{name}"
  end
end`
      const result = await parser.parse(source, 'ruby')

      const methodEntity = result.entities.find(e => e.type === 'method' && e.name === 'greet')
      expect(methodEntity).toBeDefined()
    })

    it('extracts module', async () => {
      const source = `module Helpers
  def format(s)
    s.strip
  end
end`
      const result = await parser.parse(source, 'ruby')

      const modEntity = result.entities.find(e => e.name === 'Helpers')
      expect(modEntity).toBeDefined()
      expect(modEntity!.type).toBe('class')
    })

    it('handles empty source', async () => {
      const result = await parser.parse('', 'ruby')
      expect(result.entities).toEqual([])
      expect(result.imports).toEqual([])
      expect(result.errors).toEqual([])
    })
  })

  describe('parse - Ruby imports', () => {
    it('extracts require statement', async () => {
      const source = `require 'json'`
      const result = await parser.parse(source, 'ruby')

      const imp = result.imports.find(i => i.module === 'json')
      expect(imp).toBeDefined()
    })

    it('extracts require_relative statement', async () => {
      const source = `require_relative 'models/user'`
      const result = await parser.parse(source, 'ruby')

      const imp = result.imports.find(i => i.module === 'models/user')
      expect(imp).toBeDefined()
    })

    it('does not extract non-require calls as imports', async () => {
      const source = `puts "hello"`
      const result = await parser.parse(source, 'ruby')

      expect(result.imports).toHaveLength(0)
    })
  })
})
