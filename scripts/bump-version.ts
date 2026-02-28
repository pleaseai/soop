#!/usr/bin/env bun
/**
 * Syncs the optionalDependencies platform package versions in packages/soop/package.json
 * to match the current package version.
 *
 * Run this before `npm publish` to ensure platform packages reference the correct version.
 * Based on the turborepo bump-version.js pattern.
 *
 * Usage: bun run scripts/bump-version.ts
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = import.meta.dirname ? join(import.meta.dirname, '..') : process.cwd()
const pkgPath = join(ROOT, 'packages', 'soop', 'package.json')

const pkg = await Bun.file(pkgPath).json() as {
  version: string
  optionalDependencies: Record<string, string>
}

const version = pkg.version
const optDeps = pkg.optionalDependencies

let updated = 0
for (const [name, current] of Object.entries(optDeps)) {
  if (name.startsWith('@pleaseai/soop-') && current !== version) {
    optDeps[name] = version
    updated++
  }
}

await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

if (updated > 0) {
  console.log(`Bumped ${updated} optionalDependencies to v${version}`)
}
else {
  console.log(`optionalDependencies already at v${version}`)
}
