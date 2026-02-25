import { ASTParser } from '@pleaseai/soop-utils/ast'
import { beforeEach, describe, expect, it } from 'vitest'

describe('ASTParser - C and C++', () => {
  let parser: ASTParser

  beforeEach(() => {
    parser = new ASTParser()
  })

  describe('language detection', () => {
    it('detects .c as c', () => {
      expect(parser.detectLanguage('main.c')).toBe('c')
    })

    it('detects .h as c', () => {
      expect(parser.detectLanguage('header.h')).toBe('c')
    })

    it('detects .cpp as cpp', () => {
      expect(parser.detectLanguage('main.cpp')).toBe('cpp')
    })

    it('detects .cc as cpp', () => {
      expect(parser.detectLanguage('file.cc')).toBe('cpp')
    })

    it('detects .cxx as cpp', () => {
      expect(parser.detectLanguage('file.cxx')).toBe('cpp')
    })

    it('detects .hpp as cpp', () => {
      expect(parser.detectLanguage('header.hpp')).toBe('cpp')
    })

    it('supports c language', () => {
      expect(parser.isLanguageSupported('c')).toBe(true)
    })

    it('supports cpp language', () => {
      expect(parser.isLanguageSupported('cpp')).toBe(true)
    })
  })

  describe('parse - C entities', () => {
    it('extracts function_definition', async () => {
      const source = `int add(int a, int b) {
    return a + b;
}`
      const result = await parser.parse(source, 'c')

      const funcEntity = result.entities.find(e => e.type === 'function' && e.name === 'add')
      expect(funcEntity).toBeDefined()
    })

    it('extracts struct_specifier', async () => {
      const source = `struct Point {
    int x;
    int y;
};`
      const result = await parser.parse(source, 'c')

      const structEntity = result.entities.find(e => e.name === 'Point')
      expect(structEntity).toBeDefined()
      expect(structEntity!.type).toBe('class')
    })

    it('handles empty source', async () => {
      const result = await parser.parse('', 'c')
      expect(result.entities).toEqual([])
      expect(result.imports).toEqual([])
      expect(result.errors).toEqual([])
    })
  })

  describe('parse - C imports', () => {
    it('extracts #include with angle brackets', async () => {
      const source = `#include <stdio.h>`
      const result = await parser.parse(source, 'c')

      expect(result.imports.length).toBeGreaterThanOrEqual(1)
      const imp = result.imports.find(i => i.module === 'stdio.h')
      expect(imp).toBeDefined()
    })

    it('extracts #include with quotes', async () => {
      const source = `#include "myheader.h"`
      const result = await parser.parse(source, 'c')

      expect(result.imports.length).toBeGreaterThanOrEqual(1)
      const imp = result.imports.find(i => i.module === 'myheader.h')
      expect(imp).toBeDefined()
    })
  })

  describe('parse - C++ entities', () => {
    it('extracts class_specifier', async () => {
      const source = `class Animal {
public:
    void speak();
};`
      const result = await parser.parse(source, 'cpp')

      const classEntity = result.entities.find(e => e.name === 'Animal')
      expect(classEntity).toBeDefined()
      expect(classEntity!.type).toBe('class')
    })

    it('extracts function_definition', async () => {
      const source = `int multiply(int a, int b) {
    return a * b;
}`
      const result = await parser.parse(source, 'cpp')

      const funcEntity = result.entities.find(e => e.type === 'function' && e.name === 'multiply')
      expect(funcEntity).toBeDefined()
    })

    it('handles empty source', async () => {
      const result = await parser.parse('', 'cpp')
      expect(result.entities).toEqual([])
      expect(result.imports).toEqual([])
      expect(result.errors).toEqual([])
    })
  })

  describe('parse - C++ imports', () => {
    it('extracts #include <iostream>', async () => {
      const source = `#include <iostream>`
      const result = await parser.parse(source, 'cpp')

      expect(result.imports.length).toBeGreaterThanOrEqual(1)
      const imp = result.imports.find(i => i.module === 'iostream')
      expect(imp).toBeDefined()
    })
  })
})
