import type { Sandbox } from '@vercel/agent-eval'

/**
 * Setup function that configures the soop MCP server in the sandbox.
 * Used by experiment configs to enable soop semantic code search for the agent.
 */
export async function setupSoop(sandbox: Sandbox): Promise<void> {
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

  await sandbox.writeFiles({
    '.claude/settings.json': JSON.stringify(soopMcpConfig, null, 2),
    'CLAUDE.md': soopHint,
    'GEMINI.md': soopHint,
    'AGENTS.md': soopHint,
  })

  // Initialize soop and encode the repository
  // Use local embedding model (voyage-4-nano) to avoid needing API keys for embedding
  const initResult = await sandbox.runCommand('soop', ['init'])
  if (initResult.exitCode !== 0) {
    throw new Error(`soop init failed: ${initResult.stderr}`)
  }

  const encodeResult = await sandbox.runCommand('soop', [
    'encode',
    '.',
    '-o',
    '.soop/graph.json',
    '--embed-model',
    'transformers/voyageai/voyage-4-nano',
  ])
  if (encodeResult.exitCode !== 0) {
    throw new Error(`soop encode failed: ${encodeResult.stderr}`)
  }
}
