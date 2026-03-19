#!/usr/bin/env tsx
/**
 * Generate eval fixtures from the SWE-bench Verified dataset.
 *
 * Reads the curated 30-instance subset from vendor/context-please/evaluation/
 * and generates eval fixture directories under evals/swe-bench/ for each instance.
 *
 * Usage:
 *   npx tsx scripts/generate-evals.ts
 *   npx tsx scripts/generate-evals.ts --max 5          # generate only first 5
 *   npx tsx scripts/generate-evals.ts --id django__django-14170  # generate specific instance
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  loadDataset,
  getOracleFiles,
  instanceIdToEvalName,
} from '../lib/swe-bench-loader.js'
import type { SWEBenchInstance } from '../lib/swe-bench-loader.js'

const EVALS_DIR = resolve(import.meta.dirname ?? '.', '../evals/swe-bench')

function generatePromptMd(instance: SWEBenchInstance): string {
  const repoName = instance.repo.split('/').pop() ?? instance.repo
  return `The codebase is a ${repoName} repository.

Issue: ${instance.problem_statement.split('\n')[0].trim()}

${instance.problem_statement}

Your task is to identify and edit the files that need to be modified to resolve the issue. Focus on making the necessary changes to completely address the problem. Use the available tools step by step to accomplish this goal.
`
}

function generateEvalTs(oracleFiles: string[]): string {
  const filesArray = oracleFiles.map(f => `  '${f}',`).join('\n')

  return `import { readFileSync } from 'node:fs'
import { test, expect } from 'vitest'
import { calculateMetrics } from '../../../lib/metrics.js'

const ORACLE_FILES = [
${filesArray}
]

test('agent edited the correct files', () => {
  const raw = readFileSync('__agent_eval__/results.json', 'utf-8')
  const results = JSON.parse(raw)

  if (!results.o11y) {
    throw new Error('No observability data in results')
  }

  const filesModified = results.o11y.filesModified ?? []
  const { recall } = calculateMetrics(filesModified, ORACLE_FILES)
  expect(recall).toBeGreaterThan(0)
})

test('agent did not make excessive tool calls', () => {
  const raw = readFileSync('__agent_eval__/results.json', 'utf-8')
  const results = JSON.parse(raw)

  if (!results.o11y) {
    throw new Error('No observability data in results')
  }

  expect(results.o11y.totalToolCalls).toBeLessThan(50)
})
`
}

function generatePackageJson(): string {
  return JSON.stringify({ dependencies: {} }, null, 2) + '\n'
}

function generateEval(instance: SWEBenchInstance): void {
  const evalName = instanceIdToEvalName(instance.instance_id)
  const evalDir = join(EVALS_DIR, evalName)

  if (existsSync(evalDir)) {
    console.log(`  [skip] ${evalName} already exists`)
    return
  }

  const oracleFiles = getOracleFiles(instance)
  if (oracleFiles.length === 0) {
    console.log(`  [skip] ${evalName} has no oracle files in patch`)
    return
  }

  mkdirSync(evalDir, { recursive: true })
  writeFileSync(join(evalDir, 'PROMPT.md'), generatePromptMd(instance))
  writeFileSync(join(evalDir, 'EVAL.ts'), generateEvalTs(oracleFiles))
  writeFileSync(join(evalDir, 'package.json'), generatePackageJson())

  console.log(`  [created] ${evalName} (${oracleFiles.length} oracle files)`)
}

// Parse CLI args
const args = process.argv.slice(2)
let maxInstances = Infinity
let specificId: string | undefined

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max' && args[i + 1]) {
    maxInstances = Number.parseInt(args[i + 1], 10)
    i++
  }
  else if (args[i] === '--id' && args[i + 1]) {
    specificId = args[i + 1]
    i++
  }
}

// Load and generate
console.log('Loading SWE-bench dataset...')
const dataset = loadDataset()
console.log(`Found ${dataset.instances.length} instances\n`)

let instances = dataset.instances
if (specificId) {
  instances = instances.filter(i => i.instance_id === specificId)
  if (instances.length === 0) {
    console.error(`Instance ${specificId} not found`)
    process.exit(1)
  }
}
instances = instances.slice(0, maxInstances)

console.log(`Generating ${instances.length} eval fixtures...`)
mkdirSync(EVALS_DIR, { recursive: true })

for (const instance of instances) {
  generateEval(instance)
}

console.log('\nDone!')
