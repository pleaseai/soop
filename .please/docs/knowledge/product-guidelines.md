# Product Guidelines: soop please

## Language & Communication

- All code, comments, commit messages, issues, and PR descriptions in **English**
- User-facing CLI output: English (default), with i18n support planned
- Documentation: English for technical docs, Korean permitted for internal team notes

## Code Style

- **TypeScript** with strict type checking (`tsc --noEmit`)
- **ESLint** with `@antfu/eslint-config` for consistent formatting
- **Zod** for runtime schema validation of graph data
- Prefer workspace package imports (`@pleaseai/soop-*`) over relative cross-package paths
- Within-package imports use relative paths

## Architecture Principles

- **Layered package architecture**: respect dependency layers (Layer 0 → 4)
- **Store implementations isolated**: not re-exported from barrel to avoid transitive native module loading
- **Zero-dependency defaults**: `LocalVectorStore`, `LocalGraphStore` as fallbacks; optional high-perf backends (LanceDB, SurrealDB)
- **Paper-first**: always consult reference implementation (`vendor/RPG-ZeroRepo/`) for algorithm details

## Testing

- **Vitest** as test framework (Jest-compatible)
- Unit tests: `*.test.ts` in `packages/*/tests/`
- Integration tests: `*.integration.test.ts`
- Guard git-history-dependent tests with `it.skipIf`

## Naming Conventions

- Package names: `@pleaseai/soop-{name}` (workspace), `@pleaseai/soop` (published)
- Class names preserve "RPG" concept: `RepositoryPlanningGraph`, `RPGEncoder`
- CLI/brand: "soop please" / `soop`

## Logging

- Use `consola` via `@pleaseai/soop-utils/logger`
- Library packages: `createLogger('Tag')`
- MCP server: `createStderrLogger('Tag')` (stdout reserved for JSON-RPC)
