import { chmodSync, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from '@pleaseai/soop-utils/logger'

const log = createLogger('hooks')

const HOOK_CONTENT = `#!/bin/sh
# Repo Please auto-sync hook — installed by "repo init --hooks"
# Runs repo sync after git operations. Failures do not block git.

if command -v repo >/dev/null 2>&1; then
  repo sync || echo "repo sync failed (exit $?), run 'repo sync' manually to debug" >&2
elif command -v bunx >/dev/null 2>&1; then
  bunx repo sync || echo "repo sync failed (exit $?), run 'repo sync' manually to debug" >&2
fi
`

const HOOK_NAMES = ['post-merge', 'post-checkout'] as const

/**
 * Install git hooks that run "repo sync" after merge/checkout.
 * Does not overwrite existing hooks.
 */
export async function installHooks(repoPath: string): Promise<void> {
  const gitDir = path.join(repoPath, '.git')
  if (!existsSync(gitDir)) {
    log.error('Not a git repository (no .git directory)')
    return
  }

  const hooksDir = path.join(gitDir, 'hooks')
  await mkdir(hooksDir, { recursive: true })

  for (const hookName of HOOK_NAMES) {
    const hookPath = path.join(hooksDir, hookName)

    if (existsSync(hookPath)) {
      log.warn(`${hookName} hook already exists, skipping`)
      continue
    }

    await writeFile(hookPath, HOOK_CONTENT)
    chmodSync(hookPath, 0o755)
    log.success(`Installed ${hookName} hook`)
  }
}
