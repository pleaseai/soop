import { ASTParser } from '@pleaseai/rpg-utils/ast'
import { beforeEach, describe, expect, it } from 'vitest'

describe('ASTParser - C#', () => {
  let parser: ASTParser

  beforeEach(() => {
    parser = new ASTParser()
  })

  it('supports csharp language', () => {
    expect(parser.isLanguageSupported('csharp')).toBe(true)
  })

  it('detects .cs extension as csharp', () => {
    expect(parser.detectLanguage('MyClass.cs')).toBe('csharp')
  })

  describe('parse - C# entities', () => {
    it('extracts class_declaration', async () => {
      const source = `public class User {
    private string name;
}`
      const result = await parser.parse(source, 'csharp')

      const classEntity = result.entities.find(e => e.type === 'class' && e.name === 'User')
      expect(classEntity).toBeDefined()
    })

    it('extracts method_declaration', async () => {
      const source = `public class Service {
    public string Greet(string name) {
        return "Hello, " + name;
    }
}`
      const result = await parser.parse(source, 'csharp')

      const methodEntity = result.entities.find(e => e.type === 'method' && e.name === 'Greet')
      expect(methodEntity).toBeDefined()
    })

    it('extracts interface_declaration', async () => {
      const source = `public interface IGreeter {
    string Greet(string name);
}`
      const result = await parser.parse(source, 'csharp')

      const ifaceEntity = result.entities.find(e => e.name === 'IGreeter')
      expect(ifaceEntity).toBeDefined()
      expect(ifaceEntity!.type).toBe('class')
    })

    it('extracts struct_declaration', async () => {
      const source = `public struct Point {
    public int X;
    public int Y;
}`
      const result = await parser.parse(source, 'csharp')

      const structEntity = result.entities.find(e => e.name === 'Point')
      expect(structEntity).toBeDefined()
      expect(structEntity!.type).toBe('class')
    })

    it('extracts constructor_declaration', async () => {
      const source = `public class User {
    public User(string name) {
        this.name = name;
    }
    private string name;
}`
      const result = await parser.parse(source, 'csharp')

      const ctorEntity = result.entities.find(e => e.name === 'User' && e.type === 'method')
      expect(ctorEntity).toBeDefined()
    })
  })

  describe('parse - C# imports', () => {
    it('extracts using directive', async () => {
      const source = `using System.IO;`
      const result = await parser.parse(source, 'csharp')

      expect(result.imports.length).toBeGreaterThanOrEqual(1)
      const imp = result.imports.find(i => i.module === 'System.IO')
      expect(imp).toBeDefined()
    })

    it('extracts multiple using directives', async () => {
      const source = `using System;
using System.Collections.Generic;
using System.Linq;`
      const result = await parser.parse(source, 'csharp')

      expect(result.imports.length).toBeGreaterThanOrEqual(3)
      const modules = result.imports.map(i => i.module)
      expect(modules).toContain('System')
      expect(modules).toContain('System.Collections.Generic')
      expect(modules).toContain('System.Linq')
    })

    it('handles empty source', async () => {
      const result = await parser.parse('', 'csharp')
      expect(result.entities).toEqual([])
      expect(result.imports).toEqual([])
      expect(result.errors).toEqual([])
    })
  })
})
