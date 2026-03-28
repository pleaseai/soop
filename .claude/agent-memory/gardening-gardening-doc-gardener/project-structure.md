---
name: Project Structure Conventions
description: Monorepo layout, package naming, and structural conventions for this soop-please project
type: project
---

## Package Structure

12 packages under `packages/` (not 9 — ast, namu, soop-native were added):
- `ast/` — `@pleaseai/soop-ast` — WASM tree-sitter parser (Layer 0)
- `utils/` — `@pleaseai/soop-utils` — LLM, git helpers, logger (Layer 0)
- `store/` — `@pleaseai/soop-store` — Storage implementations (Layer 0)
- `graph/` — `@pleaseai/soop-graph` — RPG data structures (Layer 1)
- `encoder/` — `@pleaseai/soop-encoder` — Code→RPG pipeline (Layer 2)
- `tools/` — `@pleaseai/soop-tools` — Agentic navigation (Layer 2)
- `zerorepo/` — `@pleaseai/soop-zerorepo` — Code generation (Layer 2)
- `namu/` — `@pleaseai/soop-namu` — WASM grammar asset management (Layer 2)
- `mcp/` — `@pleaseai/soop-mcp` — MCP server (Layer 3)
- `cli/` — `@pleaseai/soop-cli` — CLI entry point (Layer 4)
- `soop/` — `@pleaseai/soop` — Published umbrella package
- `soop-native/` — native binary distribution

## MCP Tool Names

Current tool names are `soop_search`, `soop_fetch`, `soop_explore`, `soop_encode`, `soop_evolve`, `soop_stats`.
Old names `rpg_search`, `rpg_fetch`, `rpg_explore`, `rpg_encode`, `rpg_stats` are stale.
`soop_evolve` was listed as "Does not exist" in docs but IS implemented in `packages/mcp/src/tools.ts`.

## AST Parser Location

AST parsing moved from `@pleaseai/soop-utils/ast` to dedicated `@pleaseai/soop-ast` package.
Import: `import { ASTParser } from '@pleaseai/soop-ast'`

## File Path Format in Docs

Source paths should use `packages/<pkg>/src/<file>.ts` format, not the old `src/<path>.ts` format.

## No Root-Level `src/`

There is no `src/` directory at the repo root. All code lives under `packages/*/src/`.
