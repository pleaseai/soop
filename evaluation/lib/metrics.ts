import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Transcript summary from agent-eval results.
 * Written to __agent_eval__/results.json by the framework.
 */
export interface TranscriptSummary {
  totalTurns: number
  toolCalls: Record<string, number>
  totalToolCalls: number
  filesRead: string[]
  filesModified: string[]
  shellCommands: { command: string, exitCode?: number, success?: boolean }[]
  errors: string[]
  thinkingBlocks: number
}

export interface AgentEvalResults {
  o11y: TranscriptSummary | null
}

/**
 * Load the agent-eval results from the sandbox.
 * The framework writes this file before running EVAL.ts.
 */
export function loadResults(basePath = '.'): AgentEvalResults {
  const resultsPath = join(basePath, '__agent_eval__', 'results.json')
  const raw = readFileSync(resultsPath, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Extract oracle (ground truth) file paths from a unified diff patch string.
 * Matches lines like "--- a/path/to/file.py" to get the modified files.
 *
 * Ported from vendor/context-please/evaluation/utils/format.py:extract_oracle_files_from_patch
 */
export function extractOracleFiles(patch: string): string[] {
  if (!patch) return []
  const pattern = /^--- a\/(.+)$/gm
  const files = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(patch)) !== null) {
    files.add(match[1])
  }
  return [...files]
}

/**
 * Normalize a file path by stripping leading slashes for consistent comparison.
 */
function normalizePath(p: string): string {
  return p.replace(/^\/+/, '')
}

/**
 * Calculate precision, recall, and F1 score for file retrieval.
 *
 * Ported from vendor/context-please/evaluation/analyze_and_plot_mcp_efficiency.py
 *
 * @param hits - Files the agent modified/found
 * @param oracles - Ground truth files from the patch
 */
export function calculateMetrics(hits: string[], oracles: string[]): {
  precision: number
  recall: number
  f1: number
} {
  const normalizedHits = new Set(hits.map(normalizePath))
  const normalizedOracles = new Set(oracles.map(normalizePath))

  if (normalizedHits.size === 0 && normalizedOracles.size === 0) {
    return { precision: 1, recall: 1, f1: 1 }
  }

  const intersection = [...normalizedHits].filter(h => normalizedOracles.has(h))

  const precision = normalizedHits.size > 0
    ? intersection.length / normalizedHits.size
    : 0

  const recall = normalizedOracles.size > 0
    ? intersection.length / normalizedOracles.size
    : 0

  const f1 = precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0

  return { precision, recall, f1 }
}
