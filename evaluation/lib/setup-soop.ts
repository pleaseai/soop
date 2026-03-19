import type { Sandbox } from '@vercel/agent-eval'
import { setupSweBench } from './setup-swe-bench.js'

interface SetupSoopOptions {
  embed: boolean
}

/**
 * Setup function that configures the soop MCP server in the sandbox.
 * Chains after setupSweBench to ensure the repo is cloned first.
 * Used by experiment configs to enable soop semantic code search for the agent.
 */
async function setupSoopInternal(sandbox: Sandbox, options: SetupSoopOptions): Promise<void> {
  // Clone the SWE-bench repo first
  await setupSweBench(sandbox)

  // Install soop globally in the sandbox
  const installResult = await sandbox.runCommand('npm', ['install', '-g', '@pleaseai/soop'])
  if (installResult.exitCode !== 0) {
    throw new Error(`Failed to install @pleaseai/soop: ${installResult.stderr}`)
  }

  // Configure Claude Code to use soop MCP server
  const soopMcpConfig = {
    mcpServers: {
      soop: {
        command: 'soop',
        args: ['mcp', '.soop/graph.json'],
      },
    },
  }

  const soopHint = `# soop MCP

A semantic code search server is available via the soop MCP tools.
Use \`soop_search\` with \`featureTerms\` to find code by behavior or purpose before reading files.
Use \`soop_fetch\` to retrieve full source code and feature context for entities found by search.
Use \`soop_explore\` to traverse dependency and functional edges from a known entity.
`

  // Read existing agent instruction files and append soop hint (don't overwrite repo-specific instructions)
  const hintFiles: Record<string, string> = {
    '.claude/settings.json': JSON.stringify(soopMcpConfig, null, 2),
  }
  for (const file of ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md']) {
    let existing = ''
    try {
      existing = await sandbox.readFile(file)
    }
    catch (error) {
      // Only swallow "file not found" errors; rethrow unexpected failures
      const msg = error instanceof Error ? error.message : String(error)
      if (!msg.includes('ENOENT') && !msg.includes('no such file') && !msg.includes('not found')) {
        throw error
      }
    }
    hintFiles[file] = existing ? `${existing}\n\n${soopHint}` : soopHint
  }
  await sandbox.writeFiles(hintFiles)

  // Initialize soop and encode the repository
  // Use local embedding model (voyage-4-nano) to avoid needing API keys for embedding
  const initResult = await sandbox.runCommand('soop', ['init'])
  if (initResult.exitCode !== 0) {
    throw new Error(`soop init failed: ${initResult.stderr}`)
  }

  const encodeArgs = [
    'encode',
    '.',
    '-o',
    '.soop/graph.json',
    ...(options.embed ? ['--embed-model', 'transformers/voyageai/voyage-4-nano'] : []),
  ]
  const encodeResult = await sandbox.runCommand('soop', encodeArgs)
  if (encodeResult.exitCode !== 0) {
    throw new Error(`soop encode failed: ${encodeResult.stderr}`)
  }
}

function createSetupSoop(options: SetupSoopOptions) {
  return (sandbox: Sandbox) => setupSoopInternal(sandbox, options)
}

/** Setup with vector embedding (hybrid search: FTS + vector) */
export const setupSoop = createSetupSoop({ embed: true })

/** Setup without embedding (text search only: FTS) */
export const setupSoopText = createSetupSoop({ embed: false })
