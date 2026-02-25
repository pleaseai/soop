#!/usr/bin/env node
/**
 * Platform-detecting launcher for the `rpg` CLI binary.
 *
 * Detects the current platform/arch/libc, resolves the appropriate
 * @pleaseai/rpg-<platform>-<arch>[-<libc>] optional package, and
 * executes its pre-compiled `rpg` binary.
 *
 * This file is compiled to dist/launcher-cli.mjs by tsdown and is the
 * target of the `bin/rpg` Node.js shim.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---------------------------------------------------------------------------
// Platform / libc detection
// ---------------------------------------------------------------------------

function detectLibc(): 'glibc' | 'musl' {
  // Check for musl libc files in /lib
  try {
    const libFiles = readdirSync('/lib')
    if (libFiles.some(f => f.startsWith('libc.musl')))
      return 'musl'
  }
  catch {
    // /lib not accessible or no permission
  }

  // Check ldd --version output for "musl"
  try {
    const result = spawnSync('ldd', ['--version'], { encoding: 'utf-8' })
    const out = (result.stdout ?? '') + (result.stderr ?? '')
    if (out.toLowerCase().includes('musl'))
      return 'musl'
  }
  catch {
    // ldd not available
  }

  return 'glibc'
}

function getPackageSuffix(): string {
  const { platform, arch } = process

  if (platform === 'darwin')
    return `darwin-${arch}`
  if (platform === 'linux')
    return `linux-${arch}-${detectLibc()}`
  if (platform === 'win32')
    return `win32-${arch}`

  throw new Error(`Unsupported platform: ${platform}-${arch}`)
}

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

function binaryFilename(): string {
  return process.platform === 'win32' ? 'rpg.exe' : 'rpg'
}

function findBinary(): string {
  const packageName = `@pleaseai/rpg-${getPackageSuffix()}`
  const filename = binaryFilename()
  const require = createRequire(import.meta.url)
  const searchPaths: string[] = []

  // 1. Try require.resolve — handles hoisted node_modules and pnpm virtual store
  try {
    const pkgJsonPath = require.resolve(`${packageName}/package.json`)
    const binPath = join(dirname(pkgJsonPath), filename)
    if (existsSync(binPath))
      return binPath
  }
  catch {
    // package not found via require.resolve
  }

  // 2. Walk up directory tree from this file looking for node_modules/<package>/
  let dir = __dirname
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'node_modules', packageName, filename)
    searchPaths.push(candidate)
    if (existsSync(candidate))
      return candidate
    const parent = dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }

  throw new Error(
    `Could not find the ${packageName} binary.\n`
    + `Searched:\n${searchPaths.map(p => `  - ${p}`).join('\n')}\n\n`
    + `Make sure @pleaseai/rpg is installed — the optional platform package `
    + `should be installed automatically on supported platforms.\n`
    + `If you used --no-optional, re-run without that flag.`,
  )
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

execFileSync(findBinary(), process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env,
})
