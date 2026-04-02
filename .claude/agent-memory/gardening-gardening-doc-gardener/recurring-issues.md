---
name: Recurring Documentation Issues
description: Chronic staleness patterns and structural problems found in first full scan (2026-03-29)
type: project
---

## Chronic Issues

### 1. docs/implementation-status.md — High staleness risk
This file uses concrete file paths that change as the codebase evolves.
All `src/` paths were wrong (should be `packages/*/src/`). Fixed in first scan.
Stale `src/zerorepo/zerorepo.ts` path fixed in 2026-04-02 scan → `packages/zerorepo/src/zerorepo.ts`.
Watch for: package renames, file moves, new packages being added.

### 2. CLAUDE.md Package Count
Package count was listed as "9 packages" while actual count was 12.
Fixed to 12. Watch for: new packages being added without updating this count.

### 3. docs/plan.md — Orphaned, Korean language
An old Korean-language planning document (`docs/plan.md`) exists from early development.
It is orphaned (no inbound links) and superseded by `.please/docs/plans/`.
Not auto-deleted (manual decision needed).

### 4. .please/docs/plans/index.md — Empty despite active plans
The plans index is empty (`## Active` table has no rows) but 8+ plan files exist
in `.please/docs/plans/active/`. These plans are orphaned from the index.
This is expected behavior (index is "auto-maintained by /please:plan").

### 5. docs/rpg-operation.md — Was orphaned
Not linked from any document. Fixed by adding to README.md Documentation section.

### 6. docs/vendor-comparison.md — Brand/naming drift (HIGH recurrence risk)
This file was written before the brand rename from `rpg-*` → `soop-*` and `.rpg/` → `.soop/`.
Fixed in 2026-04-02 scan:
- `@pleaseai/rpg-graph` → `@pleaseai/soop-graph` (and all other rpg-* packages)
- `.rpg/` directory → `.soop/` directory (5 occurrences)
- `rpg sync` / `rpg init` CLI commands → `soop sync` / `soop init`
- `@pleaseai/rpg-utils (ast)` → `@pleaseai/soop-ast` (reflects package extraction)
- Package count "8 packages" → "12 packages"
Watch for: new sections added to this file without updating to current brand names.

### 7. README.md project structure — Missing packages
The project structure section was missing `ast/`, `namu/`, `soop-native/` packages.
Fixed in 2026-04-02 scan. Also fixed `utils/` description (was claiming AST parsing, moved to `soop-ast`).
Watch for: new packages added without updating README structure listing.

## Structural Notes

- `.please/INDEX.md` uses relative links to `docs/tracks/`, `docs/plans/` etc. — these resolve correctly relative to `.please/`
- `.please/docs/knowledge/*.md` files are intentionally not linked (they are auto-loaded context, not navigational docs)
- `agent-evals/` and `evaluation/` are separate evaluation frameworks — both have README.md files
- CHANGELOG.md files in each package are valid (versioned packages)
