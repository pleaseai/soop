import { defineConfig } from 'tsdown'

// Packages that cannot be bundled: native binaries, ONNX runtime, optional heavy deps
const external = [
  // Native SQLite / vector / graph DB bindings
  'better-sqlite3',
  '@lancedb/lancedb',
  '@surrealdb/node',
  // Tree-sitter native parser
  'tree-sitter',
  'tree-sitter-typescript',
  'tree-sitter-python',
  'tree-sitter-rust',
  'tree-sitter-go',
  'tree-sitter-java',
  // HuggingFace transformers + ONNX (loads model files at runtime, cannot bundle)
  '@huggingface/transformers',
  'onnxruntime-node',
  'onnxruntime-common',
  // Native image processing
  'sharp',
  /^@img\//,
  'detect-libc',
]

export default defineConfig([
  // Library bundle: dist/src/index.mjs + dist/src/index.d.mts
  // Bundles all @pleaseai/* workspace packages inline (private, not separately published on npm)
  // Their pure-JS transitive deps (ai-sdk, consola, etc.) are also bundled
  // Native/binary deps remain external (consumer must install optionalDependencies)
  {
    entry: { 'src/index': './src/index.ts' },
    format: 'esm',
    platform: 'node',
    dts: { eager: true },
    clean: true,
    outDir: 'dist',
    external,
    noExternal: [/^@pleaseai\//],
    inlineOnly: false,
  },
  // CLI binary: dist/packages/cli/src/cli.mjs (standalone, bundles all pure-JS deps)
  {
    entry: { 'packages/cli/src/cli': './packages/cli/src/cli.ts' },
    format: 'esm',
    platform: 'node',
    dts: false,
    outDir: 'dist',
    external,
    inlineOnly: false,
  },
  // MCP server binary: dist/packages/mcp/src/server.mjs (standalone)
  {
    entry: { 'packages/mcp/src/server': './packages/mcp/src/server.ts' },
    format: 'esm',
    platform: 'node',
    dts: false,
    outDir: 'dist',
    external,
    banner: { js: '#!/usr/bin/env node' },
    inlineOnly: false,
  },
])
