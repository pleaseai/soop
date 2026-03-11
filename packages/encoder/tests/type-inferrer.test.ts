import type { EntityNode, InheritanceRelation } from '@pleaseai/soop-encoder/dependency-graph'
import { TypeInferrer } from '@pleaseai/soop-encoder/type-inferrer'
import { describe, expect, it } from 'vitest'

// Shared test data
const entities: EntityNode[] = [
  { className: 'Animal', methods: ['speak', 'move'] },
  { className: 'Dog', methods: ['speak', 'fetch'] },
  { className: 'Cat', methods: ['speak', 'purr'] },
  { className: 'Object', methods: ['toString', 'equals'] },
]

const inheritances: InheritanceRelation[] = [
  { childFile: 'f.py', childClass: 'Dog', parentClass: 'Animal', kind: 'inherit' },
  { childFile: 'f.py', childClass: 'Cat', parentClass: 'Animal', kind: 'inherit' },
  { childFile: 'f.py', childClass: 'Animal', parentClass: 'Object', kind: 'inherit' },
]

const inferrer = new TypeInferrer(entities, inheritances)

describe('TypeInferrer', () => {
  describe('getMROChain', () => {
    it('returns chain for simple linear inheritance', async () => {
      expect(inferrer.getMROChain('Dog')).toEqual(['Dog', 'Animal', 'Object'])
    })

    it('returns just itself for a class with no parents', async () => {
      expect(inferrer.getMROChain('Object')).toEqual(['Object'])
    })

    it('returns just itself for an unknown class', async () => {
      expect(inferrer.getMROChain('Unknown')).toEqual(['Unknown'])
    })

    it('handles cycles without infinite loop', async () => {
      const cycleEntities: EntityNode[] = [
        { className: 'A', methods: [] },
        { className: 'B', methods: [] },
      ]
      const cycleInheritances: InheritanceRelation[] = [
        { childFile: 'f.py', childClass: 'A', parentClass: 'B', kind: 'inherit' },
        { childFile: 'f.py', childClass: 'B', parentClass: 'A', kind: 'inherit' },
      ]
      const cycleInferrer = new TypeInferrer(cycleEntities, cycleInheritances)
      const chain = cycleInferrer.getMROChain('A')
      expect(chain).toContain('A')
      expect(chain).toContain('B')
      expect(chain.length).toBe(2)
    })

    it('handles multi-level inheritance (Cat path)', async () => {
      expect(inferrer.getMROChain('Cat')).toEqual(['Cat', 'Animal', 'Object'])
    })
  })

  describe('resolveQualifiedCall - receiverKind: none', () => {
    it('returns null for bare function calls', async () => {
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'foo',
        receiverKind: 'none' as const,
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBeNull()
    })

    it('returns null when receiverKind is missing', async () => {
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'foo',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBeNull()
    })
  })

  describe('resolveQualifiedCall - receiverKind: self', () => {
    it('resolves self.method() defined in current class', async () => {
      const callSite = {
        callerFile: 'f.py',
        callerEntity: 'Dog.myMethod',
        calleeSymbol: 'fetch',
        receiverKind: 'self' as const,
        receiver: 'self',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBe('Dog.fetch')
    })

    it('resolves self.method() through MRO to ancestor class', async () => {
      const callSite = {
        callerFile: 'f.py',
        callerEntity: 'Dog.myMethod',
        calleeSymbol: 'move',
        receiverKind: 'self' as const,
        receiver: 'self',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBe('Animal.move')
    })

    it('returns null when method not found in MRO', async () => {
      const callSite = {
        callerFile: 'f.py',
        callerEntity: 'Dog.myMethod',
        calleeSymbol: 'unknownMethod',
        receiverKind: 'self' as const,
        receiver: 'self',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBeNull()
    })

    it('returns null when callerEntity has no class prefix', async () => {
      const callSite = {
        callerFile: 'f.py',
        callerEntity: undefined,
        calleeSymbol: 'fetch',
        receiverKind: 'self' as const,
        receiver: 'self',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBeNull()
    })
  })

  describe('resolveQualifiedCall - receiverKind: super', () => {
    it('resolves super.method() skipping current class to parent', async () => {
      const callSite = {
        callerFile: 'f.py',
        callerEntity: 'Dog.myMethod',
        calleeSymbol: 'speak',
        receiverKind: 'super' as const,
        receiver: 'super',
      }
      // speak is in both Dog and Animal; super skips Dog
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBe('Animal.speak')
    })

    it('resolves super.method() to grandparent when not in parent', async () => {
      const callSite = {
        callerFile: 'f.py',
        callerEntity: 'Dog.myMethod',
        calleeSymbol: 'toString',
        receiverKind: 'super' as const,
        receiver: 'super',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBe('Object.toString')
    })
  })

  describe('resolveQualifiedCall - receiverKind: variable (type inference)', () => {
    it('infers type from Python constructor and resolves method', async () => {
      const code = `x = Dog()\nx.fetch()`
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'fetch',
        receiverKind: 'variable' as const,
        receiver: 'x',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, code, 'python')).toBe('Dog.fetch')
    })

    it('infers type and resolves method through MRO', async () => {
      const code = `x = Dog()`
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'move',
        receiverKind: 'variable' as const,
        receiver: 'x',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, code, 'python')).toBe('Animal.move')
    })

    it('falls back to attribute type inference when local var not found', async () => {
      // self.helper = Dog() → self.helper.fetch() should resolve Dog.fetch
      const code = `self.helper = Dog()`
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'fetch',
        receiverKind: 'variable' as const,
        receiver: 'helper',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, code, 'python')).toBe('Dog.fetch')
    })
  })

  describe('resolveQualifiedCall - fuzzy fallback', () => {
    it('rejects common method names from blocklist', async () => {
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'get',
        receiverKind: 'variable' as const,
        receiver: 'unknown_var',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBeNull()
    })

    it('resolves unique method name via fuzzy fallback', async () => {
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'purr',
        receiverKind: 'variable' as const,
        receiver: 'unknown_var',
      }
      // purr is only in Cat
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBe('Cat.purr')
    })

    it('rejects ambiguous method name found in multiple classes', async () => {
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'speak',
        receiverKind: 'variable' as const,
        receiver: 'unknown_var',
      }
      // speak is in Dog, Cat, and Animal -> ambiguous
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBeNull()
    })

    it('returns null for method not found anywhere', async () => {
      const callSite = {
        callerFile: 'f.py',
        calleeSymbol: 'noSuchMethod',
        receiverKind: 'variable' as const,
        receiver: 'unknown_var',
      }
      expect(await inferrer.resolveQualifiedCall(callSite, '', 'python')).toBeNull()
    })
  })

  describe('inferLocalVarType', () => {
    it('infers type from Python constructor assignment', async () => {
      const code = `x = Foo()`
      expect(await inferrer.inferLocalVarType(code, 'python', 'x')).toBe('Foo')
    })

    it('infers type from TypeScript new expression', async () => {
      const code = `const x = new Bar()`
      expect(await inferrer.inferLocalVarType(code, 'typescript', 'x')).toBe('Bar')
    })

    it('returns null for unknown variable name', async () => {
      const code = `x = Foo()`
      expect(await inferrer.inferLocalVarType(code, 'python', 'unknown')).toBeNull()
    })

    it('returns null for unsupported language', async () => {
      expect(await inferrer.inferLocalVarType('x = 1', 'unknown-lang', 'x')).toBeNull()
    })
  })

  describe('inferAttributeType', () => {
    it('infers type from Python self.field = Bar()', async () => {
      const code = `self.helper = Bar()`
      expect(await inferrer.inferAttributeType(code, 'python', 'helper')).toBe('Bar')
    })

    it('infers type from TypeScript this.field = new Bar()', async () => {
      const code = `class A { constructor() { this.helper = new Helper() } }`
      expect(await inferrer.inferAttributeType(code, 'typescript', 'helper')).toBe('Helper')
    })

    it('returns null for unknown attribute name', async () => {
      const code = `self.helper = Bar()`
      expect(await inferrer.inferAttributeType(code, 'python', 'unknown')).toBeNull()
    })
  })

  describe('language coverage', () => {
    it('returns null for Rust (no traversal branch yet)', async () => {
      // Rust has an INFERENCE_PATTERNS entry but no manual traversal implementation
      expect(await inferrer.inferLocalVarType('let x = Foo::new()', 'rust', 'x')).toBeNull()
    })

    it('returns null for Go (no traversal branch yet)', async () => {
      // Go has an INFERENCE_PATTERNS entry but no manual traversal implementation
      expect(await inferrer.inferLocalVarType('x := Foo{}', 'go', 'x')).toBeNull()
    })

    it('returns null for unsupported language', async () => {
      expect(await inferrer.inferLocalVarType('x = 1', 'ruby', 'x')).toBeNull()
    })

    it('attribute inference returns null for Rust', async () => {
      expect(await inferrer.inferAttributeType('self.x = Foo::new()', 'rust', 'x')).toBeNull()
    })
  })
})
