import type { Command } from 'commander'

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP server for Claude Code integration')
    .argument('[rpg-file]', 'RPG file path')
    .option('--no-search', 'Disable semantic search')
    .option('--interactive', 'Enable interactive encoding protocol')
    .option('--root-path <dir>', 'Root path override for source resolution')
    .configureOutput({
      writeOut: (str: string) => process.stderr.write(str),
      writeErr: (str: string) => process.stderr.write(str),
    })
    .action(async (rpgFile: string | undefined, options: { search?: boolean, interactive?: boolean, rootPath?: string }) => {
      const { startMcpServer } = await import('@pleaseai/soop-mcp/server')
      await startMcpServer({
        rpgFile,
        noSearch: options.search === false,
        interactive: options.interactive,
        rootPath: options.rootPath,
      })
    })
}
