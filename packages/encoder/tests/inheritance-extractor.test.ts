import { InheritanceExtractor } from '@pleaseai/soop-encoder/inheritance-extractor'
import { describe, expect, it } from 'vitest'

describe('InheritanceExtractor', () => {
  describe('TypeScript/JavaScript', () => {
    it('extracts TypeScript class extends', async () => {
      const code = `class Dog extends Animal { bark() {} }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'typescript', 'test.ts')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('Dog')
      expect(relations[0].parentClass).toBe('Animal')
      expect(relations[0].kind).toBe('inherit')
      expect(relations[0].childFile).toBe('test.ts')
    })

    it('extracts TypeScript implements', async () => {
      const code = `class Service implements IService { handle() {} }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'typescript', 'test.ts')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('Service')
      expect(relations[0].parentClass).toBe('IService')
      expect(relations[0].kind).toBe('implement')
    })

    it('extracts TypeScript multiple implements', async () => {
      const code = `class Foo implements A, B { }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'typescript', 'test.ts')
      expect(relations).toHaveLength(2)
      expect(relations.map(r => r.parentClass).sort()).toEqual(['A', 'B'])
      expect(relations.every(r => r.kind === 'implement')).toBe(true)
      expect(relations.every(r => r.childClass === 'Foo')).toBe(true)
    })

    it('extracts TypeScript extends and implements together', async () => {
      const code = `class Dog extends Animal implements Serializable { }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'typescript', 'test.ts')
      expect(relations).toHaveLength(2)
      const inheritRelation = relations.find(r => r.kind === 'inherit')
      const implementRelation = relations.find(r => r.kind === 'implement')
      expect(inheritRelation?.parentClass).toBe('Animal')
      expect(implementRelation?.parentClass).toBe('Serializable')
    })

    it('handles JavaScript class extends', async () => {
      const code = `class Counter extends Component { render() {} }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'javascript', 'test.js')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('Counter')
      expect(relations[0].parentClass).toBe('Component')
      expect(relations[0].kind).toBe('inherit')
    })
  })

  describe('Python', () => {
    it('extracts Python class inheritance', async () => {
      const code = `class Dog(Animal):\n    pass`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'python', 'test.py')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('Dog')
      expect(relations[0].parentClass).toBe('Animal')
      expect(relations[0].kind).toBe('inherit')
    })

    it('extracts Python multiple inheritance', async () => {
      const code = `class Dog(Animal, Serializable):\n    pass`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'python', 'test.py')
      expect(relations).toHaveLength(2)
      expect(relations.map(r => r.parentClass).sort()).toEqual(['Animal', 'Serializable'])
      expect(relations.every(r => r.kind === 'inherit')).toBe(true)
    })
  })

  describe('Java', () => {
    it('extracts Java class extends', async () => {
      const code = `class Dog extends Animal { }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'java', 'test.java')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('Dog')
      expect(relations[0].parentClass).toBe('Animal')
      expect(relations[0].kind).toBe('inherit')
    })

    it('extracts Java implements', async () => {
      const code = `class Service implements IService { }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'java', 'test.java')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('Service')
      expect(relations[0].parentClass).toBe('IService')
      expect(relations[0].kind).toBe('implement')
    })

    it('extracts Java extends and multiple implements', async () => {
      const code = `class Dog extends Animal implements Serializable, Cloneable { }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'java', 'test.java')
      expect(relations).toHaveLength(3)
      const inheritRelations = relations.filter(r => r.kind === 'inherit')
      const implementRelations = relations.filter(r => r.kind === 'implement')
      expect(inheritRelations).toHaveLength(1)
      expect(implementRelations).toHaveLength(2)
      expect(inheritRelations[0].parentClass).toBe('Animal')
    })
  })

  describe('Rust', () => {
    it('extracts Rust impl for', async () => {
      const code = `impl Display for MyStruct { fn fmt(&self) {} }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'rust', 'test.rs')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('MyStruct')
      expect(relations[0].parentClass).toBe('Display')
      expect(relations[0].kind).toBe('implement')
    })

    it('extracts multiple Rust impl for', async () => {
      const code = `impl Display for MyStruct { } impl Clone for MyStruct { }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'rust', 'test.rs')
      expect(relations).toHaveLength(2)
      expect(relations.map(r => r.parentClass).sort()).toEqual(['Clone', 'Display'])
    })
  })

  describe('Go', () => {
    it('extracts Go embedded struct', async () => {
      const code = `type Dog struct { Animal }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'go', 'test.go')
      expect(relations).toHaveLength(1)
      expect(relations[0].childClass).toBe('Dog')
      expect(relations[0].parentClass).toBe('Animal')
      expect(relations[0].kind).toBe('inherit')
    })

    it('extracts multiple Go embedded structs', async () => {
      const code = `type Dog struct { Animal; Serializer }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'go', 'test.go')
      expect(relations).toHaveLength(2)
      expect(relations.map(r => r.parentClass).sort()).toEqual(['Animal', 'Serializer'])
    })
  })

  describe('Edge cases', () => {
    it('returns empty for code without inheritance', async () => {
      const code = `function foo() {}`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'typescript', 'test.ts')
      expect(relations).toEqual([])
    })

    it('returns empty for empty code', async () => {
      const code = ``
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'typescript', 'test.ts')
      expect(relations).toEqual([])
    })

    it('handles multiple classes in same file', async () => {
      const code = `
        class Dog extends Animal { }
        class Cat extends Animal { }
      `
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'typescript', 'test.ts')
      expect(relations).toHaveLength(2)
      expect(relations.map(r => r.childClass).sort()).toEqual(['Cat', 'Dog'])
    })

    it('maintains file path in all relations', async () => {
      const code = `class Dog extends Animal { } class Service implements IService { }`
      const extractor = new InheritanceExtractor()
      const filePath = 'src/models/index.ts'
      const relations = await extractor.extract(code, 'typescript', filePath)
      expect(relations.length).toBeGreaterThan(0)
      expect(relations.every(r => r.childFile === filePath)).toBe(true)
    })

    it('returns empty for unsupported language', async () => {
      const code = `class Dog extends Animal { }`
      const extractor = new InheritanceExtractor()
      const relations = await extractor.extract(code, 'cobol', 'test.cob')
      expect(relations).toEqual([])
    })
  })
})
