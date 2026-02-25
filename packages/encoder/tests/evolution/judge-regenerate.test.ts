import type { DiffResult } from '@pleaseai/rpg-encoder/evolution/types'
import type { EntityType } from '@pleaseai/rpg-graph/node'
import { RPGEvolver } from '@pleaseai/rpg-encoder/evolution/evolve'
import { DEFAULT_FORCE_REGENERATE_THRESHOLD } from '@pleaseai/rpg-encoder/evolution/types'
import { describe, expect, it } from 'vitest'

/**
 * Build a DiffResult with the given number of changes.
 */
function makeDiff(insertions: number, deletions: number, modifications: number): DiffResult {
  return {
    insertions: Array.from({ length: insertions }, (_, i) => ({
      id: `src/test.ts:function:fn${i}`,
      filePath: 'src/test.ts',
      entityType: 'function' as EntityType,
      entityName: `fn${i}`,
      qualifiedName: `fn${i}`,
    })),
    deletions: Array.from({ length: deletions }, (_, i) => ({
      id: `src/test.ts:function:del${i}`,
      filePath: 'src/test.ts',
      entityType: 'function' as EntityType,
      entityName: `del${i}`,
      qualifiedName: `del${i}`,
    })),
    modifications: Array.from({ length: modifications }, (_, i) => ({
      old: {
        id: `src/test.ts:function:old${i}`,
        filePath: 'src/test.ts',
        entityType: 'function' as EntityType,
        entityName: `fn${i}`,
        qualifiedName: `fn${i}`,
      },
      new: {
        id: `src/test.ts:function:new${i}`,
        filePath: 'src/test.ts',
        entityType: 'function' as EntityType,
        entityName: `fn${i}`,
        qualifiedName: `fn${i}`,
      },
    })),
  }
}

/**
 * Create an RPGEvolver with a stub RPG (only used to test judgeRegenerate,
 * which does not call any RPG methods itself).
 */
function createEvolver(forceRegenerateThreshold?: number): RPGEvolver {
  const rpgStub = {} as any
  return new RPGEvolver(rpgStub, {
    commitRange: 'HEAD~1..HEAD',
    repoPath: '/tmp/test-repo',
    useLLM: false,
    ...(forceRegenerateThreshold !== undefined ? { forceRegenerateThreshold } : {}),
  })
}

describe('RPGEvolver.judgeRegenerate', () => {
  describe('default threshold (0.5)', () => {
    it('exports DEFAULT_FORCE_REGENERATE_THRESHOLD as 0.5', () => {
      expect(DEFAULT_FORCE_REGENERATE_THRESHOLD).toBe(0.5)
    })

    it('returns false when nodeCount is 0 (avoids division by zero)', () => {
      const evolver = createEvolver()
      expect((evolver as any).judgeRegenerate(makeDiff(100, 100, 100), 0)).toBe(false)
    })

    it('returns false when changeRatio is well below threshold (0.1)', () => {
      const evolver = createEvolver()
      // 10 changes / 100 nodes = 0.1 ratio
      expect((evolver as any).judgeRegenerate(makeDiff(5, 3, 2), 100)).toBe(false)
    })

    it('returns false when changeRatio equals threshold exactly (not strictly greater)', () => {
      const evolver = createEvolver()
      // 50 changes / 100 nodes = exactly 0.5 — judgeRegenerate uses `> threshold`, not `>=`
      expect((evolver as any).judgeRegenerate(makeDiff(25, 15, 10), 100)).toBe(false)
    })

    it('returns true when changeRatio is just above threshold (0.51)', () => {
      const evolver = createEvolver()
      // 51 changes / 100 nodes = 0.51 > 0.5
      expect((evolver as any).judgeRegenerate(makeDiff(17, 17, 17), 100)).toBe(true)
    })

    it('returns true when changeRatio far exceeds threshold', () => {
      const evolver = createEvolver()
      // 90 changes / 100 nodes = 0.9 > 0.5
      expect((evolver as any).judgeRegenerate(makeDiff(30, 30, 30), 100)).toBe(true)
    })
  })

  describe('custom forceRegenerateThreshold', () => {
    it('uses custom threshold instead of default', () => {
      const evolver = createEvolver(0.8)
      // 60/100 = 0.6 < 0.8 — should NOT trigger with custom threshold
      expect((evolver as any).judgeRegenerate(makeDiff(20, 20, 20), 100)).toBe(false)
      // 90/100 = 0.9 > 0.8 — should trigger
      expect((evolver as any).judgeRegenerate(makeDiff(30, 30, 30), 100)).toBe(true)
    })

    it('threshold of 0 triggers re-encode on any non-empty diff', () => {
      const evolver = createEvolver(0)
      // 1/100 = 0.01 > 0 — any change triggers
      expect((evolver as any).judgeRegenerate(makeDiff(1, 0, 0), 100)).toBe(true)
    })

    it('threshold of 1 never triggers for normal repositories', () => {
      const evolver = createEvolver(1)
      // 99/100 = 0.99 < 1 — even 99% changes should not trigger
      expect((evolver as any).judgeRegenerate(makeDiff(33, 33, 33), 100)).toBe(false)
    })
  })

  describe('changeRatio calculation', () => {
    it('counts insertions, deletions, and modifications equally', () => {
      const evolver = createEvolver()
      // Only insertions: 60/100 = 0.6 > 0.5
      expect((evolver as any).judgeRegenerate(makeDiff(60, 0, 0), 100)).toBe(true)
      // Only deletions: 60/100 = 0.6 > 0.5
      expect((evolver as any).judgeRegenerate(makeDiff(0, 60, 0), 100)).toBe(true)
      // Only modifications: 60/100 = 0.6 > 0.5
      expect((evolver as any).judgeRegenerate(makeDiff(0, 0, 60), 100)).toBe(true)
    })

    it('uses current nodeCount as the denominator', () => {
      const evolver = createEvolver()
      const diff = makeDiff(10, 0, 0) // 10 insertions
      // 10/10 = 1.0 > 0.5 — small repo triggers easily
      expect((evolver as any).judgeRegenerate(diff, 10)).toBe(true)
      // 10/1000 = 0.01 < 0.5 — large repo stays stable
      expect((evolver as any).judgeRegenerate(diff, 1000)).toBe(false)
    })
  })
})
