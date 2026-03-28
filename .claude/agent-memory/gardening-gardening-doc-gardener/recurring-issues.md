---
name: Recurring Documentation Issues
description: Chronic staleness patterns and structural problems found in first full scan (2026-03-29)
type: project
---

## Chronic Issues

### 1. docs/implementation-status.md — High staleness risk
This file uses concrete file paths that change as the codebase evolves.
All `src/` paths were wrong (should be `packages/*/src/`). Fixed in first scan.
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

## Structural Notes

- `.please/INDEX.md` uses relative links to `docs/tracks/`, `docs/plans/` etc. — these resolve correctly relative to `.please/`
- `.please/docs/knowledge/*.md` files are intentionally not linked (they are auto-loaded context, not navigational docs)
- `agent-evals/` and `evaluation/` are separate evaluation frameworks — both have README.md files
- CHANGELOG.md files in each package are valid (versioned packages)
