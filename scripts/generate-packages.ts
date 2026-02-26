#!/usr/bin/env bun
/**
 * Build script for cross-platform binary distribution.
 *
 * Compiles `soop` and `soop-mcp` standalone Bun executables for 7 platform targets,
 * then generates the npm/soop-<target>/ package directories with package.json manifests.
 *
 * Usage: bun run scripts/generate-packages.ts
 */

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Target {
  /** npm package suffix, e.g. "darwin-arm64" → @pleaseai/soop-darwin-arm64 */
  packageSuffix: string
  /** Bun compile target string */
  bunTarget: string
  /** package.json `os` value */
  os: string
  /** package.json `cpu` value */
  cpu: string
  /** package.json `libc` value (Linux only) */
  libc?: string
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = import.meta.dirname ? join(import.meta.dirname, '..') : process.cwd()

// Read version from packages/soop/package.json
const pkgJson = await Bun.file(join(ROOT, 'packages', 'soop', 'package.json')).json() as { version: string }
const VERSION = pkgJson.version

const TARGETS: Target[] = [
  {
    packageSuffix: 'darwin-arm64',
    bunTarget: 'bun-darwin-arm64',
    os: 'darwin',
    cpu: 'arm64',
  },
  {
    packageSuffix: 'darwin-x64',
    bunTarget: 'bun-darwin-x64',
    os: 'darwin',
    cpu: 'x64',
  },
  {
    packageSuffix: 'linux-x64-glibc',
    bunTarget: 'bun-linux-x64',
    os: 'linux',
    cpu: 'x64',
    libc: 'glibc',
  },
  {
    packageSuffix: 'linux-arm64-glibc',
    bunTarget: 'bun-linux-arm64',
    os: 'linux',
    cpu: 'arm64',
    libc: 'glibc',
  },
  {
    packageSuffix: 'linux-x64-musl',
    bunTarget: 'bun-linux-x64-musl',
    os: 'linux',
    cpu: 'x64',
    libc: 'musl',
  },
  {
    packageSuffix: 'linux-arm64-musl',
    bunTarget: 'bun-linux-arm64-musl',
    os: 'linux',
    cpu: 'arm64',
    libc: 'musl',
  },
  {
    packageSuffix: 'win32-x64',
    bunTarget: 'bun-windows-x64',
    os: 'win32',
    cpu: 'x64',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function packageName(suffix: string): string {
  return `@pleaseai/soop-${suffix}`
}

function binaryName(name: string, os: string): string {
  return os === 'win32' ? `${name}.exe` : name
}

async function buildBinary(
  entrypoint: string,
  outfile: string,
  target: string,
): Promise<void> {
  // Ensure the output directory exists before Bun.build — compile mode silently
  // succeeds without writing if the directory is missing.
  await mkdir(join(outfile, '..'), { recursive: true })
  console.log(`  Building ${outfile} for ${target}...`)
  const result = await Bun.build({
    entrypoints: [entrypoint],
    compile: {
      target: target as Bun.Build.CompileTarget,
      outfile,
    },
    bytecode: target.split('-')[1] !== 'windows', // https://github.com/oven-sh/bun/issues/18416
    minify: true,
    // Embed all @pleaseai/* workspace packages; exclude heavy native/optional deps
    external: [
      '@lancedb/lancedb',
      '@surrealdb/node',
      '@huggingface/transformers',
      'onnxruntime-node',
      'onnxruntime-common',
      'sharp',
      'better-sqlite3',
      'tree-sitter',
      'tree-sitter-typescript',
      'tree-sitter-python',
      'tree-sitter-rust',
      'tree-sitter-go',
      'tree-sitter-java',
      'tree-sitter-c',
      'tree-sitter-c-sharp',
      'tree-sitter-cpp',
      'tree-sitter-ruby',
      'tree-sitter-kotlin',
      'detect-libc',
    ],
  })

  if (!result.success) {
    console.error(`  Build failed for ${outfile}:`)
    for (const log of result.logs) {
      console.error(`    ${log.message}`)
    }
    throw new Error(`Bun.build failed for ${outfile} on ${target}`)
  }

  if (!existsSync(outfile)) {
    throw new Error(
      `Bun.build reported success but output file does not exist: ${outfile} (target: ${target})`,
    )
  }
}

async function generatePackageJson(target: Target): Promise<void> {
  const pkgDir = join(ROOT, 'npm', `soop-${target.packageSuffix}`)
  await mkdir(pkgDir, { recursive: true })

  const pkg: Record<string, unknown> = {
    name: packageName(target.packageSuffix),
    version: VERSION,
    description: `Soop Please binary for ${target.os}-${target.cpu}${target.libc ? `-${target.libc}` : ''}`,
    os: [target.os],
    cpu: [target.cpu],
    bin: {
      'soop': binaryName('soop', target.os),
      'soop-mcp': binaryName('soop-mcp', target.os),
    },
    files: [
      binaryName('soop', target.os),
      binaryName('soop-mcp', target.os),
    ],
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'https://github.com/pleaseai/soop.git',
    },
  }

  // Add libc field for Linux targets
  if (target.libc) {
    pkg.libc = [target.libc]
  }

  await writeFile(
    join(pkgDir, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Target filter (--filter <packageSuffix-prefix>)
// e.g. --filter darwin   → darwin-arm64, darwin-x64
//      --filter linux-x64 → linux-x64-glibc, linux-x64-musl
//      --filter linux-arm64 → linux-arm64-glibc, linux-arm64-musl
//      --filter win32     → win32-x64
// ---------------------------------------------------------------------------

const filterIdx = process.argv.indexOf('--filter')
const filterPrefix = filterIdx !== -1 ? process.argv[filterIdx + 1] : null
const BUILD_TARGETS = filterPrefix
  ? TARGETS.filter(t => t.packageSuffix.startsWith(filterPrefix))
  : TARGETS

if (filterPrefix && BUILD_TARGETS.length === 0) {
  console.error(`No targets match --filter "${filterPrefix}". Available: ${TARGETS.map(t => t.packageSuffix).join(', ')}`)
  process.exit(1)
}

// --skip-missing: skip targets where cross-compilation fails (local dev only)
// Without this flag (CI default), build failures cause an immediate error.
const skipMissing = process.argv.includes('--skip-missing')

console.log(`Building Soop Please binaries v${VERSION} for ${BUILD_TARGETS.length} targets${filterPrefix ? ` (filter: ${filterPrefix})` : ''}${skipMissing ? ' (--skip-missing)' : ''}...\n`)

// Compile binaries for each target
for (const target of BUILD_TARGETS) {
  const pkgDir = join(ROOT, 'npm', `soop-${target.packageSuffix}`)

  const repoBin = binaryName('soop', target.os)
  const mcpBin = binaryName('soop-mcp', target.os)

  console.log(`\n[${target.packageSuffix}] target=${target.bunTarget}`)

  try {
    await buildBinary(
      join(ROOT, 'packages', 'cli', 'src', 'cli.ts'),
      join(pkgDir, repoBin),
      target.bunTarget,
    )

    await buildBinary(
      join(ROOT, 'packages', 'mcp', 'src', 'server.ts'),
      join(pkgDir, mcpBin),
      target.bunTarget,
    )

    await generatePackageJson(target)
    console.log(`  Generated npm/soop-${target.packageSuffix}/package.json`)
  }
  catch (err) {
    if (skipMissing) {
      console.warn(`  Skipping ${target.packageSuffix}: ${err instanceof Error ? err.message : String(err)}`)
    }
    else {
      throw err
    }
  }
}

// Sync optionalDependencies in packages/soop/package.json so versions stay in sync with VERSION
const repoPkgPath = join(ROOT, 'packages', 'soop', 'package.json')
const repoPkg = await Bun.file(repoPkgPath).json() as Record<string, unknown>
const optDeps = repoPkg.optionalDependencies as Record<string, string>
for (const target of TARGETS) {
  const name = packageName(target.packageSuffix)
  if (name in optDeps) {
    optDeps[name] = VERSION
  }
}
await writeFile(repoPkgPath, `${JSON.stringify(repoPkg, null, 2)}\n`)
console.log(`\nSynced optionalDependencies in packages/soop/package.json → v${VERSION}`)

console.log('\nBuild complete!')
console.log('Platform packages written to npm/')
console.log('\nTo publish platform packages:')
console.log('  for dir in npm/soop-*/; do (cd "$dir" && npm publish --access public); done')
