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

// Resolve tree-sitter binary, running install.js if the binary hasn't been downloaded yet
async function findTreeSitterBin(): Promise<string> {
  const cliPkgPath = fileURLToPath(import.meta.resolve('tree-sitter-cli/package.json'))
  const cliDir = path.dirname(cliPkgPath)
  const binName = process.platform === 'win32' ? 'tree-sitter.exe' : 'tree-sitter'
  const binPath = path.join(cliDir, binName)

  if (!fs.existsSync(binPath)) {
    process.stdout.write('⏳ Downloading tree-sitter binary...\n')
    await execFile(process.execPath, [path.join(cliDir, 'install.js')], { cwd: cliDir })
  }

  if (!fs.existsSync(binPath)) {
    throw new Error(
      `tree-sitter binary not found at ${binPath} even after running install.js`,
    )
  }

  return binPath
}

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

async function buildGrammar(bin: string, packageName: string, subPath?: string): Promise<void> {
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

  await execFile(bin, args, { cwd: outDir })
  process.stdout.write(`✅ ${label}\n`)
}

async function main(): Promise<void> {
  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true })

  const treeSitterBin = await findTreeSitterBin()

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
    await buildGrammar(treeSitterBin, packageName, subPath)
  }

  process.stdout.write(`\n✨ Done. WASMs in ${outDir}\n`)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
