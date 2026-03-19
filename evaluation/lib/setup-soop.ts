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

  await sandbox.writeFiles({
    '.claude/settings.json': JSON.stringify(soopMcpConfig, null, 2),
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
