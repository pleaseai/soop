import type { ExperimentConfig } from '@pleaseai/agent-eval'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RPG_FIXTURE = join(import.meta.dirname, '..', 'fixtures', 'nextjs-rpg.json')

const CLAUDE_MD = `# soop please MCP Server

You have access to a soop please (Repository Planning Graph) MCP server pre-loaded with the Next.js codebase.
Always use soop tools to look up the latest Next.js conventions before writing code.

## Available Tools

| Tool | When to Use |
|------|-------------|
| soop_search | Find code entities by feature description or file pattern |
| soop_fetch | Get detailed metadata, source code, and feature paths for entities |
| soop_explore | Traverse dependency/containment edges from a starting node |
| soop_stats | Check graph statistics |

## Workflow

1. **Before implementing**: Use \`soop_search\` with mode "features" to find relevant Next.js source code
2. **Verify conventions**: Use \`soop_fetch\` to read actual Next.js source and confirm API names, file conventions, and patterns
3. **Trace dependencies**: Use \`soop_explore\` to understand how components connect

## Example

To find how Next.js handles middleware/proxy:
\`\`\`
soop_search({ mode: "features", feature_terms: ["proxy", "middleware", "request handling"] })
soop_fetch({ code_entities: ["<entity-id-from-search>"] })
\`\`\`
`

const config: ExperimentConfig = {
  agent: 'claude-code',
  runs: 1,
  earlyExit: true,
  scripts: ['build'],
  timeout: 1200,
  setup: async (sandbox) => {
    const rpgData = readFileSync(RPG_FIXTURE, 'utf-8')
    await sandbox.writeFiles({
      '.claude/settings.json': JSON.stringify({
        mcpServers: {
          soop: {
            command: 'soop-mcp',
            args: ['nextjs-rpg.json', '--no-search'],
          },
        },
      }),
      'CLAUDE.md': CLAUDE_MD,
      'nextjs-rpg.json': rpgData,
    })
  },
}

export default config
