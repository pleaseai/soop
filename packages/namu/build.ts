/**
 * Build WASM grammars for web-tree-sitter@0.26.x.
 *
 * Uses tree-sitter-cli to compile each grammar into a WASM binary.
 * Requires either emcc (Emscripten) or Docker to be available.
 *
 * Usage:
 *   bun run build:wasm              # build all grammars
 *   bun run build:wasm typescript   # build a single grammar
 */
import { execFile as execFileCallback } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'wasm')
// Use the native binary directly (downloaded by tree-sitter-cli's install.js)
const treeSitterBin = path.join(__dirname, 'node_modules', 'tree-sitter-cli', 'tree-sitter')

// All grammars to build: [packageName, subPath?]
const ALL_GRAMMARS: Array<[string, string?]> = [
  ['tree-sitter-c'],
  ['tree-sitter-c-sharp'],
  ['tree-sitter-cpp'],
  ['tree-sitter-go'],
  ['tree-sitter-java'],
  ['tree-sitter-javascript'],
  ['tree-sitter-kotlin'],
  ['tree-sitter-python'],
  ['tree-sitter-ruby'],
  ['tree-sitter-rust'],
  ['tree-sitter-typescript', 'typescript'],
]

function findPackageRoot(startPath: string): string {
  let dir = startPath
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }
  throw new Error(`Could not find package root from ${startPath}`)
}

async function buildGrammar(packageName: string, subPath?: string): Promise<void> {
  const label = subPath ? `${packageName}/${subPath}` : packageName
  process.stdout.write(`⏳ Building ${label}\n`)

  let packagePath: string
  try {
    const resolvedPath = import.meta.resolve(packageName)
    const filePath = fileURLToPath(resolvedPath)
    packagePath = findPackageRoot(path.dirname(filePath))
  }
  catch {
    packagePath = path.join(__dirname, 'node_modules', packageName)
  }

  const cwd = subPath ? path.join(packagePath, subPath) : packagePath

  const args = ['build', '--wasm', cwd]

  await execFile(treeSitterBin, args, { cwd: outDir })
  process.stdout.write(`✅ ${label}\n`)
}

async function main(): Promise<void> {
  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true })

  // Determine which grammars to build
  const langArg = process.argv[2]
  const grammars = langArg
    ? ALL_GRAMMARS.filter(([name]) => name === langArg || name === `tree-sitter-${langArg}`)
    : ALL_GRAMMARS

  if (grammars.length === 0) {
    console.error(`Unknown grammar: ${langArg}`)
    process.exit(1)
  }

  for (const [packageName, subPath] of grammars) {
    await buildGrammar(packageName, subPath)
  }

  process.stdout.write(`\n✨ Done. WASMs in ${outDir}\n`)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
