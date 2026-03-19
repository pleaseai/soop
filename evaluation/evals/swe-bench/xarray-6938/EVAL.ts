import { readFileSync } from 'node:fs'
import { test, expect } from 'vitest'
import { calculateMetrics } from '../../../lib/metrics.js'

// Oracle files from the patch (ground truth: files that need to be modified)
const ORACLE_FILES = [
  'xarray/core/dataset.py',
  'xarray/core/variable.py',
]

test('agent edited the correct files for the swap_dims fix', () => {
  const raw = readFileSync('__agent_eval__/results.json', 'utf-8')
  const results = JSON.parse(raw)

  if (!results.o11y) {
    throw new Error('No observability data in results')
  }

  const filesModified = results.o11y.filesModified ?? []

  // Check that at least one oracle file was modified
  const { recall } = calculateMetrics(filesModified, ORACLE_FILES)
  expect(recall).toBeGreaterThan(0)
})

test('agent modified xarray/core/variable.py (core fix)', () => {
  const raw = readFileSync('__agent_eval__/results.json', 'utf-8')
  const results = JSON.parse(raw)

  if (!results.o11y) {
    throw new Error('No observability data in results')
  }

  const filesModified: string[] = results.o11y.filesModified ?? []
  const normalized = filesModified.map(f => f.replace(/^\/+/, ''))

  expect(normalized).toContain('xarray/core/variable.py')
})

test('agent did not make excessive tool calls', () => {
  const raw = readFileSync('__agent_eval__/results.json', 'utf-8')
  const results = JSON.parse(raw)

  if (!results.o11y) {
    throw new Error('No observability data in results')
  }

  expect(results.o11y.totalToolCalls).toBeLessThan(50)
})
