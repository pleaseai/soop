import type { Sandbox } from '@vercel/agent-eval'

/**
 * Setup function that configures the soop MCP server in the sandbox.
 * Used by experiment configs to enable soop semantic code search for the agent.
 */
export async function setupSoop(sandbox: Sandbox): Promise<void> {
  // Install soop globally in the sandbox
  await sandbox.runCommand('npm', ['install', '-g', '@pleaseai/soop'])

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
  await sandbox.runCommand('soop', ['init'])
  await sandbox.runCommand('soop', [
    'encode',
    '.',
    '-o',
    '.soop/graph.json',
    '--embed-model',
    'transformers/voyageai/voyage-4-nano',
  ])
}
