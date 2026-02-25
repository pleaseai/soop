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
  'tree-sitter-c',
  'tree-sitter-c-sharp',
  'tree-sitter-cpp',
  'tree-sitter-ruby',
  'tree-sitter-kotlin',
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
  // Library bundle: packages/repo/dist/src/index.mjs + packages/repo/dist/src/index.d.mts
  // Bundles all @pleaseai/* workspace packages inline (private, not separately published on npm)
  // Their pure-JS transitive deps (ai-sdk, consola, etc.) are also bundled
  // Native/binary deps remain external (consumer must install optionalDependencies)
  {
    entry: { 'src/index': './packages/repo/src/index.ts' },
    format: 'esm',
    platform: 'node',
    dts: { eager: true },
    clean: true,
    outDir: 'packages/repo/dist',
    external,
    noExternal: [/^@pleaseai\//],
    inlineOnly: false,
  },
  // CLI binary: packages/repo/dist/packages/cli/src/cli.mjs (standalone, bundles all pure-JS deps)
  // noExternal ensures @pleaseai/* workspace packages are bundled inline (private, not on npm)
  {
    entry: { 'packages/cli/src/cli': './packages/cli/src/cli.ts' },
    format: 'esm',
    platform: 'node',
    dts: false,
    outDir: 'packages/repo/dist',
    external,
    noExternal: [/^@pleaseai\//],
    inlineOnly: false,
  },
  // MCP server binary: packages/repo/dist/packages/mcp/src/server.mjs (standalone)
  // noExternal ensures @pleaseai/* workspace packages are bundled inline (private, not on npm)
  {
    entry: { 'packages/mcp/src/server': './packages/mcp/src/server.ts' },
    format: 'esm',
    platform: 'node',
    dts: false,
    outDir: 'packages/repo/dist',
    external,
    noExternal: [/^@pleaseai\//],
    banner: { js: '#!/usr/bin/env node' },
    inlineOnly: false,
  },
  // Launcher scripts: compiled from scripts/launcher/*.ts → packages/repo/dist/launcher-{cli,mcp}.mjs
  // These are pure Node.js scripts (no native deps) used by bin/repo and bin/repo-mcp shims
  {
    entry: {
      'launcher-cli': './scripts/launcher/cli.ts',
      'launcher-mcp': './scripts/launcher/mcp.ts',
    },
    format: 'esm',
    platform: 'node',
    dts: false,
    outDir: 'packages/repo/dist',
    // Launchers have no @pleaseai/* deps — they only use Node.js built-ins
    inlineOnly: false,
  },
])
