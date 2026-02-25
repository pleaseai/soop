# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**repo please** is a TypeScript/Bun implementation of two research papers:
- **RPG-ZeroRepo**: Repository generation from specifications (Intent → Code)
- **RPG-Encoder**: Repository understanding via graph encoding (Code → Intent)

The core data structure is the **Repository Planning Graph (RPG)** - a hierarchical dual-view graph combining semantic features with structural metadata.

> Note: "RPG" (Repository Planning Graph) as a concept name is preserved in class names (`RepositoryPlanningGraph`, `RPGEncoder`, etc.). Only the brand/CLI/package names have changed to "repo please" / `repo` / `@pleaseai/repo`.

## Build & Development Commands

```bash
# Install dependencies
bun install

# Run in development mode (with watch)
bun run dev

# Build for production
bun run build

# Run all tests
bun run test

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Run single test file
bun run test packages/graph/tests/graph.test.ts

# Run specific test by name
bun run test -t "should create node"

# Watch mode for tests
bun run test:watch

# Test UI (browser-based)
bun run test:ui

# Test with coverage
bun run test:coverage

# Lint
bun run lint

# Lint and auto-fix
bun run lint:fix

# Format code
bun run format

# Type checking
bun run typecheck

# CLI (development)
bun run packages/cli/src/cli.ts encode ./my_project

# Initialize repo please in a repository
repo init [path] [--hooks] [--ci] [--encode]

# Sync canonical graph to local with incremental evolve
repo sync [--force]

# Stamp config.github.commit with current HEAD SHA
repo stamp <repo-file>

# Print last encoded commit SHA
repo last-commit <repo-file>
```

## Two-Tier RPG Data Management

repo please uses a two-tier architecture for data management:

**Tier 1 (CI)**: On main push, `repo encode`/`repo evolve` runs in GitHub Actions and commits `.repo/graph.json` to git.

**Tier 2 (Local)**: `repo sync` copies the canonical graph to `.repo/local/`, applies incremental evolve for local branch changes, and builds vector indices. Local data is gitignored.

```
.repo/
  graph.json          # Canonical RPG (git committed, CI-managed)
  config.json         # Encode/sync settings (git committed)
  cache/              # Semantic cache (gitignored)
    semantic-cache.db # LLM response cache (SQLite, WAL mode)
  local/              # Local-only data (gitignored)
    graph.json        # Local evolved RPG copy
    vectors/          # Local vector embeddings (LocalVectorStore, JSON-based)
    state.json        # Local state (base commit, branch, etc.)
```

### Setup

```bash
# Initialize with CI workflow and git hooks
repo init --ci --hooks --encode

# Or step by step:
repo init                      # Create .repo/ structure
repo encode . -o .repo/graph.json --stamp  # Initial encode
repo sync                      # Copy to local + evolve
```

### Commit tracking

The `--stamp` flag on `encode`/`evolve` records the HEAD SHA in `config.github.commit`. The CI workflow uses `repo last-commit` to determine the commit range for incremental evolve.

## Architecture

### Workspace Structure

The project uses **Bun workspaces** with a private monorepo root (`version: 0.0.0`) and 9 packages under `packages/`. The published package is `packages/repo` (`@pleaseai/repo`); all other packages are `private: true` and bundled inline.

```
packages/
├── repo/      # Published: @pleaseai/repo (umbrella package, bin/repo, bin/repo-mcp)
├── utils/     # Layer 0: AST parser, LLM interface, git helpers, logger (independent)
├── store/     # Layer 0: Storage interfaces & implementations (independent)
├── graph/     # Layer 1: RPG data structures (→ store)
├── encoder/   # Layer 2: Code → RPG extraction (→ graph, utils)
├── tools/     # Layer 2: Agentic tools for graph navigation (→ graph, encoder)
├── zerorepo/  # Layer 2: Intent → Code generation (→ graph, utils)
├── mcp/       # Layer 3: MCP server (→ graph, encoder, tools, utils)
└── cli/       # Layer 4: CLI entry point (→ encoder, graph, tools, zerorepo)
```

### Import Pattern

Cross-package imports use workspace package names:
```typescript
// Correct: workspace package imports
import { RepositoryPlanningGraph } from '@pleaseai/repo-graph'
import { ASTParser } from '@pleaseai/repo-utils/ast'
import { RPGEncoder } from '@pleaseai/repo-encoder'

// Sub-path exports are available for fine-grained imports:
import { SQLiteGraphStore } from '@pleaseai/repo-store/sqlite'
import { DataFlowEdgeSchema } from '@pleaseai/repo-graph/edge'
import { SemanticSearch } from '@pleaseai/repo-encoder/semantic-search'
```

Within the same package, use relative imports:
```typescript
// Inside packages/encoder/src/encoder.ts:
import { SemanticCache } from './cache'
import { DataFlowDetector } from './data-flow'
```

### Core Concepts

**RPG Graph Structure** `G = (V, E)`:
- **Nodes (V)**: Each node contains `{ feature, metadata }` where feature = semantic description, metadata = code entity info
  - `HighLevelNode`: Architectural directories/modules
  - `LowLevelNode`: Atomic implementations (files, classes, functions)
- **Edges (E)**:
  - `FunctionalEdge`: Feature hierarchy (parent-child relationships)
  - `DependencyEdge`: Import/call relationships via AST analysis

### Module Responsibilities

| Package | Purpose |
|---------|---------|
| `@pleaseai/repo-utils` | AST parser (tree-sitter), LLM interface (OpenAI/Anthropic/Google), git helpers, logger |
| `@pleaseai/repo-store` | Storage interfaces (GraphStore, VectorStore, TextSearchStore) & implementations (SQLite, SurrealDB, LanceDB) |
| `@pleaseai/repo-graph` | RPG data structures (Node, Edge, RPG class) |
| `@pleaseai/repo-encoder` | Code → RPG extraction (semantic lifting, structural reorganization, artifact grounding, evolution) |
| `@pleaseai/repo-tools` | Agentic tools (SearchNode, FetchNode, ExploreRPG) for graph navigation |
| `@pleaseai/repo-zerorepo` | Intent → Code generation (proposal construction, implementation planning, code generation) |
| `@pleaseai/repo-mcp` | MCP server for Claude Code integration |
| `@pleaseai/repo-cli` | CLI entry point |

### Key Pipelines

**ZeroRepo (Generation)**:
1. Proposal-level: Feature tree → explore-exploit selection → goal-aligned refactoring
2. Implementation-level: File structure → data flow → interface design
3. Code generation: Topological traversal with test-driven validation

**Encoder (Understanding)**:
1. Encoding: Semantic lifting → structural reorganization → artifact grounding
2. Evolution: Commit-level incremental updates (add/modify/delete)
3. Operation: SearchNode, FetchNode, ExploreRPG tools

### Store Implementations

The `@pleaseai/repo-store` package provides the storage layer with decomposed interfaces:

| Store | Module | Engine | Search |
|-------|--------|--------|--------|
| `SQLiteGraphStore` | `packages/store/src/sqlite/` | `better-sqlite3` (WAL mode) | FTS5 full-text search |
| `SurrealGraphStore` | `packages/store/src/surreal/` | `surrealdb` + `@surrealdb/node` embedded | BM25 search |
| `LanceDBVectorStore` | `packages/store/src/lancedb/` | LanceDB (optional) | Vector similarity search |
| `LocalVectorStore` | `packages/store/src/local/` | JSON file (zero-dependency) | Brute-force cosine similarity |
| `LocalGraphStore` | `packages/store/src/local/` | JSON file (zero-dependency) | — (SQLite fallback) |
| `LocalTextSearchStore` | `packages/store/src/local/` | In-memory (zero-dependency) | Term-frequency word matching |
| `DefaultContextStore` | `packages/store/src/default-context-store.ts` | SQLite + LocalVectorStore (LocalGraph fallback) | Graph + Text + Vector |

**Import pattern** — store implementations are NOT re-exported from the barrel to avoid transitive native module loading:
```typescript
import { SQLiteGraphStore } from '@pleaseai/repo-store/sqlite'
import { SurrealGraphStore } from '@pleaseai/repo-store/surreal'
import { LocalVectorStore, LocalGraphStore, LocalTextSearchStore } from '@pleaseai/repo-store/local' // zero-dependency defaults
import { LanceDBVectorStore } from '@pleaseai/repo-store/lancedb' // optional, requires @lancedb/lancedb
import { DefaultContextStore } from '@pleaseai/repo-store/default-context-store'
```

### Key Libraries

- **tree-sitter**: AST parsing for multiple languages (TypeScript, JavaScript, Python, Rust, Go, Java)
- **lancedb**: Vector DB for semantic search (Bun-native, disk-based) — optional dependency; `LocalVectorStore` is used as the zero-dependency fallback
- **surrealdb** + **@surrealdb/node**: Embedded graph database (mem:// or surrealkv://)
- **@huggingface/transformers**: Local embedding with MongoDB LEAF models
- **zod**: Schema validation for graph data
- **commander**: CLI framework
- **consola**: Structured logging with log levels and tagged output
- **vitest**: Testing framework (Jest-compatible, for MCP compatibility)

## Reference Papers

- RPG-ZeroRepo: https://arxiv.org/abs/2509.16198
- RPG-Encoder: https://arxiv.org/abs/2602.02084
- Paper source files in `docs/arXiv-*/` for implementation details
- **Paper vs Implementation Status**: [docs/implementation-status.md](docs/implementation-status.md)

## MCP Server

repo please provides an MCP (Model Context Protocol) server for Claude Code integration.

### Running the MCP Server

```bash
# Development mode
bun run mcp <repo-file.json>

# Example with sample fixture
bun run mcp tests/fixtures/sample-rpg.json
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `repo_search` | Semantic code search by features or file patterns |
| `repo_fetch` | Retrieve entity details, source code, and feature paths |
| `repo_explore` | Traverse the graph along functional/dependency edges |
| `repo_encode` | Convert a repository into an RPG |
| `repo_stats` | Get graph statistics (node/edge counts) |

### Claude Code Configuration

Add to your Claude Code settings (`.claude/settings.json` or `~/.config/claude/settings.json`):

```json
{
  "mcpServers": {
    "repo": {
      "command": "bun",
      "args": ["run", "/path/to/repo/packages/mcp/src/server.ts", "/path/to/repo-file.json"],
      "env": {}
    }
  }
}
```

Or with the installed package:

```json
{
  "mcpServers": {
    "repo": {
      "command": "repo-mcp",
      "args": ["/path/to/repo-file.json"]
    }
  }
}
```

## Language Convention

All git commit messages, code comments, GitHub issues, pull request titles/descriptions, and review comments must be written in **English**.

## Design Decisions

- **Bun workspaces**: Monorepo with private root (`version: 0.0.0`) and `packages/repo` as the published umbrella package; all `@pleaseai/repo-*` workspace packages are `private: true`
- **Vitest over Bun Test**: Jest compatibility for planned MCP server development
- **LanceDB over ChromaDB**: No external server required, Bun-native, disk-based persistence — available as an optional high-performance vector store via `@pleaseai/repo-store/lancedb`; `LocalVectorStore` (zero-dependency JSON store) is the current default everywhere, with LanceDB as an opt-in upgrade
- **All workspace packages bundled inline**: `@pleaseai/repo-*` are all `private: true` and not published to npm; tsdown `noExternal` bundles them into the CLI/MCP/library outputs so `npm install -g @pleaseai/repo` works without 404 errors
- **Paper-based implementation**: Original implementation based on research papers, not forked from Microsoft code
- **Dual GraphStore backends**: SQLiteGraphStore (better-sqlite3) and SurrealGraphStore (native graph relations) in `@pleaseai/repo-store` for evaluation

## Logging

The project uses [`consola`](https://github.com/unjs/consola) for structured logging via `@pleaseai/repo-utils/logger`.

### Usage

```typescript
// In library packages — use createLogger with a tag
import { createLogger } from '@pleaseai/repo-utils/logger'
const log = createLogger('MyModule')
log.info('Processing...')       // [MyModule] Processing...
log.warn('Fallback used')       // [MyModule] Fallback used
log.error('Operation failed')   // [MyModule] Operation failed
log.debug('Verbose details')    // Hidden unless log level >= 4

// In MCP server — use createStderrLogger (stdout reserved for JSON-RPC)
import { createStderrLogger } from '@pleaseai/repo-utils/logger'
const log = createStderrLogger('MCP')

// Set global log level (affects all loggers: createLogger children + createStderrLogger instances)
import { setLogLevel, LogLevels } from '@pleaseai/repo-utils/logger'
setLogLevel(LogLevels.debug)    // Enable debug output
```

### Log Levels

| Level | Value | Methods |
|-------|-------|---------|
| Fatal | 0 | `log.fatal()` |
| Error | 0 | `log.error()` |
| Warn | 1 | `log.warn()` |
| Log | 2 | `log.log()` |
| Info | 3 | `log.info()`, `log.success()`, `log.fail()`, `log.ready()`, `log.start()`, `log.box()` |
| Debug | 4 | `log.debug()` |
| Trace | 5 | `log.trace()` |

### CLI `--verbose` Flag

The CLI `encode` command accepts `--verbose` which sets the global log level to `debug` (4), making `log.debug()` calls visible across all packages (both `createLogger` and `createStderrLogger` instances).

### Logging vs Output in CLI

- **Logging** (use consola): progress info, phase transitions, verbose details
- **Output** (keep `console.log`): user-facing results, statistics, search results

## Known Gotchas

### better-sqlite3 native bindings
If `better-sqlite3` native bindings are compiled for a different Node.js version, run `npm rebuild better-sqlite3` to recompile them.

### SurrealDB embedded engine limitations
- **No transactions**: `mem://` and `surrealkv://` engines do not support `beginTransaction()`. Use sequential operations instead.
- **option\<T\> fields**: SCHEMAFULL tables with `option<T>` fields reject JS `null`. Omit the field entirely from the content object.
- **ORDER BY**: Fields used in `ORDER BY` must also appear in the `SELECT` clause.
- **No LIKE operator**: Use application-level regex filtering instead.
- **update().patch()**: Expects RFC 6902 JSON Patch operations, not plain objects. Use `UPDATE SET` queries for partial updates.
- **SDK imports**: Use `createNodeEngines` from `@surrealdb/node` and `RecordId`, `Table`, `Surreal` from `surrealdb`.

### Vitest CLI
- `--include` is not a valid CLI option; use positional arguments (`vitest run 'pattern'`) or workspace projects (`--project=unit`)
- Test file naming: `*.integration.test.ts` for integration tests, `*.test.ts` for unit tests
- Test files live in `packages/*/tests/` — run a single package's tests with e.g. `bun run test packages/encoder/tests/semantic.test.ts`

### CI shallow clones
- `actions/checkout@v6` defaults to `fetch-depth: 1` — tests using `HEAD~1..HEAD` or specific commit hashes will fail
- Unit tests use `fetch-depth: 2`; integration tests use `fetch-depth: 0` (full history for submodule fixture commits)
- Guard git-history-dependent tests with `it.skipIf(!hasGitAncestor(repoPath, ref))` as a safety net
- The `tests/fixtures/superjson` submodule is a real git repo used for evolution/diff-parser integration tests

### Linter auto-formatting
- Always run `bun run lint:fix` after editing test files — the local formatter and CI linter may disagree on arrow-parens, brace-style, and comma-dangle

## Semantic Extraction

RPG encoding uses LLM for semantic feature extraction. Options:

| Mode | Performance | Cost | Use Case |
|------|-------------|------|----------|
| `useLLM: true` + Gemini 3 Flash | Best (78% SWE-bench) | Free tier | Recommended default |
| `useLLM: true` + Claude Haiku 4.5 | High (73% SWE-bench) | $1/$5 per 1M | Production fallback |
| `useLLM: true` + GPT-4o | High (70% SWE-bench) | $3/$10 per 1M | Paper baseline |
| `useLLM: true` + Claude Code (sonnet) | High | Pro/Max sub | No API key needed |
| `useLLM: true` + Codex CLI (gpt-5.3-codex) | High | Plus/Pro sub | No API key needed |
| `useLLM: false` (heuristic) | ~15% lower | Free | Offline/testing |

## Embedding Options

CLI flag: `--embed-model <provider/model>` (encode/embed commands)

| Provider | Model | CLI prefix | Dimension | Cost | Notes |
|----------|-------|-----------|-----------|------|-------|
| Voyage AI | voyage-4 | `voyage-ai/voyage-4` | 1024 | $0.06/1M | **Default (CI)** — balanced quality/cost |
| Voyage AI | voyage-4-large | `voyage-ai/voyage-4-large` | 1024 | $0.12/1M | Best quality, MoE architecture |
| Voyage AI | voyage-4-lite | `voyage-ai/voyage-4-lite` | 1024 | $0.02/1M | Low latency, query-time use |
| HuggingFace (local) | voyageai/voyage-4-nano | `transformers/voyageai/voyage-4-nano` | 1024 | Free | **Default (local)** — open-weight, Apache 2.0 |
| HuggingFace (local) | MongoDB/mdbr-leaf-ir | `transformers/MongoDB/mdbr-leaf-ir` | 768 | Free | Information retrieval |
| HuggingFace (local) | MongoDB/mdbr-leaf-mt | `transformers/MongoDB/mdbr-leaf-mt` | 1024 | Free | Multi-task |
| OpenAI | text-embedding-3-small | `openai/text-embedding-3-small` | 1536 | $0.02/1M | |
| OpenAI | text-embedding-3-large | `openai/text-embedding-3-large` | 3072 | $0.13/1M | |

All Voyage 4 models (including local `voyage-4-nano`) share the same embedding space — documents and queries can use different models interchangeably.

### CI Workflow Model Selection

The `repo init --ci` template automatically selects the embedding model:

- `VOYAGE_API_KEY` set → `voyage-ai/voyage-4`
- `VOYAGE_API_KEY` not set → `transformers/voyageai/voyage-4-nano` (free, no API key required)

### Alternative Embedding Models (Not Yet Implemented)

| Provider | Model | Dimension | Cost | Notes |
|----------|-------|-----------|------|-------|
| Google | gemini-embedding-001 | 3072 | Free | MTEB Multilingual #1 |
| Jina AI | jina-embeddings-v3 | 1024 | $0.02/1M | Paper baseline (Agentless) |
