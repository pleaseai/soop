import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { InteractiveEncoder } from '../src/mcp/interactive/encoder'
import { InteractiveState } from '../src/mcp/interactive/state'

describe('MCP Interactive Encoding Integration', () => {
  let tmpDir: string
  let repoDir: string

  beforeAll(async () => {
    // Create a temporary directory with test files
    tmpDir = await mkdtemp(join(tmpdir(), 'rpg-interactive-test-'))
    repoDir = join(tmpDir, 'test-repo')
    mkdirSync(join(repoDir, 'src'), { recursive: true })

    writeFileSync(join(repoDir, 'src', 'main.ts'), `
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function add(a: number, b: number): number {
  return a + b
}
`)

    writeFileSync(join(repoDir, 'src', 'utils.ts'), `
import { greet } from './main'

export class Logger {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  log(message: string): void {
    console.log(\`[\${this.prefix}] \${message}\`)
  }

  greetAndLog(name: string): void {
    const greeting = greet(name)
    this.log(greeting)
  }
}
`)
  })

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  describe('full interactive encoding flow', () => {
    let state: InteractiveState
    let encoder: InteractiveEncoder

    beforeAll(() => {
      state = new InteractiveState()
      encoder = new InteractiveEncoder(state)
    })

    it('should build structural index', async () => {
      const result = await encoder.buildIndex(repoDir, {
        include: ['**/*.ts'],
      })

      expect(result.success).toBe(true)
      expect(result.files).toBe(2) // main.ts, utils.ts
      expect(result.entities).toBeGreaterThan(2) // files + functions + class + methods
      expect(result.batches).toBeGreaterThan(0)
      expect(state.rpg).not.toBeNull()
      expect(state.entities.length).toBe(result.entities)
    })

    it('should provide status after build', () => {
      const status = encoder.getStatus()
      expect(status).toContain('Index built')
      expect(status).toContain('rpg://encoding/entities')
    })

    it('should provide entity batches', () => {
      const batch0 = encoder.getEntityBatch('*', 0)
      expect(batch0).toContain('Semantic Feature Extraction')
      expect(batch0).toContain('Batch 0')
      expect(batch0).toContain('```')
    })

    it('should submit features for entities', async () => {
      const features: Record<string, string[]> = {}
      for (const entity of state.entities) {
        features[entity.id] = [`process ${entity.name}`]
      }

      const result = await encoder.submitFeatures(JSON.stringify(features))
      expect(result.success).toBe(true)
      expect(result.coveragePercent).toBe(100)
      expect(result.entitiesProcessed).toBe(state.entities.length)
    })

    it('should finalize features', async () => {
      const result = await encoder.finalizeFeatures()
      expect(result.success).toBe(true)
      expect(result.entitiesProcessed).toBeGreaterThan(0)
      expect(state.fileFeatures.length).toBeGreaterThan(0)
    })

    it('should provide synthesis batches', () => {
      const synthBatch = encoder.getSynthesisBatch(0)
      expect(synthBatch).toContain('File-Level Feature Synthesis')
      expect(synthBatch).toContain('Synthesis Batch 0')
    })

    it('should submit synthesis', async () => {
      const synthesis: Record<string, { description: string, keywords: string[] }> = {}
      for (const file of state.fileFeatures) {
        synthesis[file.filePath] = {
          description: `file-level: ${file.description}`,
          keywords: ['test', 'synthesis'],
        }
      }

      const result = await encoder.submitSynthesis(JSON.stringify(synthesis))
      expect(result.success).toBe(true)
      expect(result.entitiesProcessed).toBe(state.fileFeatures.length)
    })

    it('should provide hierarchy context', () => {
      const ctx = encoder.getHierarchyContext()
      expect(ctx).toContain('Domain Discovery')
      expect(ctx).toContain('Hierarchy Assignment')
      expect(ctx).toContain('File Features')
    })

    it('should submit hierarchy', async () => {
      const assignments: Record<string, string> = {}
      for (const file of state.fileFeatures) {
        assignments[file.filePath] = 'Core/utilities/helpers'
      }

      const result = await encoder.submitHierarchy(JSON.stringify(assignments))
      expect(result.success).toBe(true)
      expect(result.entitiesProcessed).toBe(state.fileFeatures.length)
    })

    it('should persist graph to .rpg/graph.json', () => {
      const graphPath = join(repoDir, '.rpg', 'graph.json')
      expect(existsSync(graphPath)).toBe(true)
    })

    it('should verify graph has hierarchy nodes', async () => {
      const rpg = state.rpg!
      const highLevelNodes = await rpg.getHighLevelNodes()
      expect(highLevelNodes.length).toBeGreaterThan(0)
    })

    it('should verify search works on the encoded RPG', async () => {
      const rpg = state.rpg!
      const results = await rpg.searchByFeature('process')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    let encoder: InteractiveEncoder

    beforeAll(() => {
      const state = new InteractiveState()
      encoder = new InteractiveEncoder(state)
    })

    it('should handle invalid JSON in submitFeatures', async () => {
      await encoder.buildIndex(repoDir, { include: ['**/*.ts'] })
      await expect(encoder.submitFeatures('not json')).rejects.toThrow('Invalid JSON')
    })

    it('should handle unknown entity IDs in submitFeatures', async () => {
      await expect(
        encoder.submitFeatures(JSON.stringify({ 'nonexistent:file': ['test'] })),
      ).rejects.toThrow('Entity not found')
    })

    it('should handle invalid JSON in submitSynthesis', async () => {
      await expect(encoder.submitSynthesis('bad json')).rejects.toThrow('Invalid JSON')
    })

    it('should handle invalid JSON in submitHierarchy', async () => {
      await expect(encoder.submitHierarchy('bad json')).rejects.toThrow('Invalid JSON')
    })

    it('should handle stale revision in submitRouting', async () => {
      await expect(
        encoder.submitRouting('[]', 'wrong-revision'),
      ).rejects.toThrow('Stale revision')
    })
  })

  describe('pagination', () => {
    it('should handle multi-batch lifting', async () => {
      const state = new InteractiveState()
      const encoder = new InteractiveEncoder(state)

      await encoder.buildIndex(repoDir, { include: ['**/*.ts'] })

      // Force small batches
      state.buildBatches(100, 2)
      expect(state.batchBoundaries.length).toBeGreaterThan(1)

      // Process each batch
      for (let i = 0; i < state.batchBoundaries.length; i++) {
        const batchText = encoder.getEntityBatch('*', i)
        expect(batchText).toContain(`Batch ${i}`)

        const batchEntities = state.getBatchEntities(i)
        const features: Record<string, string[]> = {}
        for (const entity of batchEntities) {
          features[entity.id] = [`batch ${i} feature`]
        }
        await encoder.submitFeatures(JSON.stringify(features))
      }

      expect(state.getCoveragePercent()).toBe(100)
    })
  })

  describe('drift detection and routing', () => {
    it('should detect drift when features change significantly', async () => {
      const state = new InteractiveState()
      const encoder = new InteractiveEncoder(state)

      await encoder.buildIndex(repoDir, { include: ['**/*.ts'] })

      // First submission
      const entityId = state.entities[0]!.id
      await encoder.submitFeatures(JSON.stringify({
        [entityId]: ['parse arguments', 'validate input'],
      }))

      // Second submission with very different features (high Jaccard distance)
      const result = await encoder.submitFeatures(JSON.stringify({
        [entityId]: ['render template', 'compile stylesheet'],
      }))

      // Should detect drift
      expect(result.driftDetected).toBe(1)
      expect(state.pendingRouting.length).toBe(1)
      expect(state.pendingRouting[0]?.reason).toBe('drifted')
    })

    it('should provide routing batch with hierarchy context', async () => {
      const state = new InteractiveState()
      const encoder = new InteractiveEncoder(state)

      await encoder.buildIndex(repoDir, { include: ['**/*.ts'] })

      // Add pending routing manually
      state.pendingRouting = [{
        entityId: state.entities[0]!.id,
        features: ['test feature'],
        currentPath: state.entities[0]!.filePath,
        reason: 'drifted',
      }]

      const batch = encoder.getRoutingBatch(0)
      expect(batch).toContain('Routing Batch 0')
      expect(batch).toContain('drifted')
      expect(batch).toContain('Graph revision:')
    })

    it('should apply routing decisions', async () => {
      const state = new InteractiveState()
      const encoder = new InteractiveEncoder(state)

      await encoder.buildIndex(repoDir, { include: ['**/*.ts'] })

      state.pendingRouting = [{
        entityId: state.entities[0]!.id,
        features: ['test'],
        currentPath: state.entities[0]!.filePath,
        reason: 'drifted',
      }]

      const revision = state.getGraphRevision()
      const decisions = [{ entityId: state.entities[0]!.id, decision: 'keep' }]
      const result = await encoder.submitRouting(JSON.stringify(decisions), revision)

      expect(result.success).toBe(true)
      expect(state.pendingRouting.length).toBe(0)
    })
  })
})
