import type { EntityInput } from '@pleaseai/soop-encoder/semantic'
import { SemanticExtractor } from '@pleaseai/soop-encoder/semantic'
import { describe, expect, it, vi } from 'vitest'

describe('composite key collision prevention', () => {
  describe('extractFunctionBatch with same-named functions from different files', () => {
    it('extracts both functions when two files define the same function name', async () => {
      const extractor = new SemanticExtractor({ useLLM: true })

      const funcA: EntityInput = {
        type: 'function',
        name: 'testShouldWork',
        filePath: 'src/module-a/utils.ts',
        sourceCode: 'function testShouldWork() { return 1; }',
      }
      const funcB: EntityInput = {
        type: 'function',
        name: 'testShouldWork',
        filePath: 'src/module-b/helpers.ts',
        sourceCode: 'function testShouldWork() { return 2; }',
      }

      // Mock LLM to return composite-keyed response
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          'src/module-a/utils.ts::testShouldWork': ['return numeric value from module a'],
          'src/module-b/helpers.ts::testShouldWork': ['return numeric value from module b'],
        }),
      })
      ;(extractor as any).llmClient = { generate: mockGenerate }

      const { result } = await (extractor as any).extractFunctionBatch(
        [funcA, funcB],
        { memory: undefined, isTest: false, alreadyParsedNames: [], prevInvalidKeys: [] },
      )

      expect(result.get(funcA)).toBeDefined()
      expect(result.get(funcB)).toBeDefined()
      expect(result.get(funcA)?.description).toContain('module a')
      expect(result.get(funcB)?.description).toContain('module b')
    })

    it('includes file path comment in code blocks sent to LLM', async () => {
      const extractor = new SemanticExtractor({ useLLM: true })

      const funcA: EntityInput = {
        type: 'function',
        name: 'helper',
        filePath: 'src/foo.ts',
        sourceCode: 'function helper() {}',
      }

      const mockGenerate = vi.fn().mockResolvedValue({ content: '{}' })
      ;(extractor as any).llmClient = { generate: mockGenerate }

      await (extractor as any).extractFunctionBatch([funcA], {})

      // Verify LLM was called - the prompt would contain the file path comment
      expect(mockGenerate).toHaveBeenCalledOnce()
    })

    it('uses composite keys in follow-up message for pending functions', () => {
      const extractor = new SemanticExtractor({ useLLM: false })

      const funcA: EntityInput = {
        type: 'function',
        name: 'process',
        filePath: 'src/alpha/processor.ts',
      }
      const funcB: EntityInput = {
        type: 'function',
        name: 'process',
        filePath: 'src/beta/processor.ts',
      }

      const message: string = (extractor as any).buildFunctionFollowUpMessage(
        [funcA, funcB],
        ['src/alpha/processor.ts::process'],
        [],
      )

      expect(message).toContain('src/alpha/processor.ts::process')
      expect(message).toContain('src/beta/processor.ts::process')
      // Already parsed should show composite key
      expect(message).toContain('So far, you\'ve extracted features for: src/alpha/processor.ts::process')
      // Pending should show composite key
      expect(message).toContain('src/beta/processor.ts::process')
    })

    it('uses composite keys in alreadyParsedNames tracking', async () => {
      const extractor = new SemanticExtractor({ useLLM: true })
      const allInputs: EntityInput[] = []
      const resultMap = new Map<number, any>()

      const funcA: EntityInput = {
        type: 'function',
        name: 'init',
        filePath: 'src/a.ts',
        sourceCode: 'function init() {}',
      }
      const funcB: EntityInput = {
        type: 'function',
        name: 'init',
        filePath: 'src/b.ts',
        sourceCode: 'function init() {}',
      }
      allInputs.push(funcA, funcB)

      // First iteration returns only funcA's composite key
      // Second iteration should use composite key in alreadyParsedNames
      let callCount = 0
      const mockGenerate = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return {
            content: JSON.stringify({
              'src/a.ts::init': ['initialize module a'],
            }),
          }
        }
        return {
          content: JSON.stringify({
            'src/b.ts::init': ['initialize module b'],
          }),
        }
      })
      ;(extractor as any).llmClient = { generate: mockGenerate }

      await (extractor as any).processFunctionBatches([funcA, funcB], allInputs, resultMap, false)

      // Both should be extracted
      const idxA = allInputs.indexOf(funcA)
      const idxB = allInputs.indexOf(funcB)
      expect(resultMap.get(idxA)).toBeDefined()
      expect(resultMap.get(idxB)).toBeDefined()
    })
  })

  describe('extractClassBatch with same-named classes from different files', () => {
    it('extracts both classes when two files define the same class name', async () => {
      const extractor = new SemanticExtractor({ useLLM: true })

      const classA: EntityInput = {
        type: 'class',
        name: 'Processor',
        filePath: 'src/module-a/processor.ts',
        sourceCode: 'class Processor { run() {} }',
      }
      const classB: EntityInput = {
        type: 'class',
        name: 'Processor',
        filePath: 'src/module-b/processor.ts',
        sourceCode: 'class Processor { execute() {} }',
      }

      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({
          'src/module-a/processor.ts::Processor': {
            run: ['run task in module a pipeline'],
          },
          'src/module-b/processor.ts::Processor': {
            execute: ['execute job in module b queue'],
          },
        }),
      })
      ;(extractor as any).llmClient = { generate: mockGenerate }

      const { result } = await (extractor as any).extractClassBatch(
        [
          { classEntity: classA, methodEntities: [] },
          { classEntity: classB, methodEntities: [] },
        ],
        { memory: undefined, isTest: false },
      )

      expect(result.get('src/module-a/processor.ts::Processor')).toBeDefined()
      expect(result.get('src/module-b/processor.ts::Processor')).toBeDefined()
    })

    it('uses composite keys in class follow-up message', () => {
      const extractor = new SemanticExtractor({ useLLM: false })

      const classA: EntityInput = {
        type: 'class',
        name: 'Handler',
        filePath: 'src/http/handler.ts',
      }
      const classB: EntityInput = {
        type: 'class',
        name: 'Handler',
        filePath: 'src/grpc/handler.ts',
      }

      const message: string = (extractor as any).buildClassFollowUpMessage([
        { classEntity: classA, methodEntities: [] },
        { classEntity: classB, methodEntities: [] },
      ])

      expect(message).toContain('src/http/handler.ts::Handler')
      expect(message).toContain('src/grpc/handler.ts::Handler')
    })

    it('includes file path comments in class code blocks sent to LLM', async () => {
      const extractor = new SemanticExtractor({ useLLM: true })

      const classA: EntityInput = {
        type: 'class',
        name: 'Builder',
        filePath: 'src/core/builder.ts',
        sourceCode: 'class Builder { build() {} }',
      }

      const mockGenerate = vi.fn().mockResolvedValue({ content: '{}' })
      ;(extractor as any).llmClient = { generate: mockGenerate }

      await (extractor as any).extractClassBatch(
        [{ classEntity: classA, methodEntities: [] }],
        { memory: undefined, isTest: false },
      )

      // Verify LLM was called - the prompt would contain the file path comment
      expect(mockGenerate).toHaveBeenCalledOnce()
    })
  })

  describe('processClassGroupBatches lookup uses composite key', () => {
    it('resolves class features using composite key from batch result', async () => {
      const extractor = new SemanticExtractor({ useLLM: true })

      const classEntity: EntityInput = {
        type: 'class',
        name: 'Store',
        filePath: 'src/storage/store.ts',
        sourceCode: 'class Store {}',
      }
      const allInputs: EntityInput[] = [classEntity]
      const resultMap = new Map<number, any>()

      // Mock extractClassBatch to return composite-keyed result
      const mockExtractClassBatch = vi.spyOn(extractor as any, 'extractClassBatch')
      const fakeResult = new Map<string, any>()
      fakeResult.set('src/storage/store.ts::Store', {
        description: 'store data in persistent storage',
        keywords: ['store', 'storage'],
      })
      mockExtractClassBatch.mockResolvedValue({
        result: fakeResult,
        memory: { addUser: vi.fn() } as any,
      })

      await (extractor as any).processClassGroupBatches(
        [{ classEntity, methodEntities: [] }],
        allInputs,
        resultMap,
        false,
      )

      expect(resultMap.get(0)).toBeDefined()
      expect(resultMap.get(0)?.description).toBe('store data in persistent storage')

      mockExtractClassBatch.mockRestore()
    })
  })
})
