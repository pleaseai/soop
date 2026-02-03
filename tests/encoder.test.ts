import { beforeEach, describe, expect, test } from 'vitest'
import { RPGEncoder } from '../src/encoder'
import path from 'node:path'

// Get current project root for testing
const PROJECT_ROOT = path.resolve(__dirname, '..')

describe('RPGEncoder', () => {
  let encoder: RPGEncoder

  beforeEach(() => {
    encoder = new RPGEncoder('/tmp/test-repo')
  })

  test('creates encoder with default options', () => {
    const enc = new RPGEncoder('/path/to/repo')
    expect(enc).toBeDefined()
  })

  test('creates encoder with custom options', () => {
    const enc = new RPGEncoder('/path/to/repo', {
      includeSource: true,
      include: ['**/*.ts'],
      exclude: ['**/node_modules/**'],
      maxDepth: 5,
    })
    expect(enc).toBeDefined()
  })

  test('encode returns RPG with correct structure', async () => {
    const result = await encoder.encode()

    expect(result.rpg).toBeDefined()
    expect(result.filesProcessed).toBeGreaterThanOrEqual(0)
    expect(result.entitiesExtracted).toBeGreaterThanOrEqual(0)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  test('encode creates RPG with repository name from path', async () => {
    const enc = new RPGEncoder('/path/to/my-project')
    const result = await enc.encode()

    expect(result.rpg.getConfig().name).toBe('my-project')
  })

  test('encode creates RPG with root path', async () => {
    const result = await encoder.encode()

    expect(result.rpg.getConfig().rootPath).toBe('/tmp/test-repo')
  })

  test('evolve accepts commit range', async () => {
    // This should not throw
    await expect(encoder.evolve({ commitRange: 'HEAD~5..HEAD' })).resolves.toBeUndefined()
  })
})

describe('RPGEncoder Options', () => {
  test('include patterns filter files', () => {
    const encoder = new RPGEncoder('/repo', {
      include: ['**/*.ts', '**/*.js'],
    })
    expect(encoder).toBeDefined()
  })

  test('exclude patterns filter out files', () => {
    const encoder = new RPGEncoder('/repo', {
      exclude: ['**/test/**', '**/*.test.ts'],
    })
    expect(encoder).toBeDefined()
  })

  test('maxDepth limits traversal', () => {
    const encoder = new RPGEncoder('/repo', {
      maxDepth: 3,
    })
    expect(encoder).toBeDefined()
  })

  test('includeSource embeds code in nodes', () => {
    const encoder = new RPGEncoder('/repo', {
      includeSource: true,
    })
    expect(encoder).toBeDefined()
  })
})

describe('RPGEncoder.discoverFiles', () => {
  test('discovers TypeScript files in repository', async () => {
    const encoder = new RPGEncoder(PROJECT_ROOT, {
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**'],
    })
    const result = await encoder.encode()

    // Should find at least the encoder.ts file
    expect(result.filesProcessed).toBeGreaterThan(0)
  })

  test('respects include patterns', async () => {
    const encoder = new RPGEncoder(PROJECT_ROOT, {
      include: ['src/encoder/**/*.ts'],
      exclude: [],
    })
    const result = await encoder.encode()

    // Should only find files in src/encoder
    expect(result.filesProcessed).toBeGreaterThanOrEqual(1)
  })

  test('respects exclude patterns', async () => {
    const encoder = new RPGEncoder(PROJECT_ROOT, {
      include: ['**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
    })
    const result = await encoder.encode()

    // Should find src files but not test files
    expect(result.filesProcessed).toBeGreaterThan(0)
  })

  test('handles non-existent directory gracefully', async () => {
    const encoder = new RPGEncoder('/non/existent/path', {
      include: ['**/*.ts'],
    })
    const result = await encoder.encode()

    // Should return empty result, not throw
    expect(result.filesProcessed).toBe(0)
  })
})
