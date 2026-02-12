import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'

let cachedGitPath: string | undefined

/**
 * Resolve the absolute path to the `git` binary by searching PATH directories.
 *
 * Mitigates CWE-426 (Untrusted Search Path) / CWE-427 (Uncontrolled Search Path Element)
 * by explicitly resolving and caching the executable path instead of relying on
 * implicit PATH resolution in child_process calls.
 *
 * @throws {Error} if git is not found in any PATH directory
 */
export function resolveGitBinary(): string {
  if (cachedGitPath)
    return cachedGitPath

  const dirs = (process.env.PATH ?? '').split(delimiter)
  for (const dir of dirs) {
    const candidate = join(dir, 'git')
    try {
      accessSync(candidate, constants.X_OK)
      cachedGitPath = candidate
      return candidate
    }
    catch {
      continue
    }
  }

  throw new Error(
    'git binary not found in PATH. '
    + 'Install git or set PATH to include the directory containing git.',
  )
}

/**
 * Clear the cached git path (for testing purposes).
 */
export function clearGitPathCache(): void {
  cachedGitPath = undefined
}
