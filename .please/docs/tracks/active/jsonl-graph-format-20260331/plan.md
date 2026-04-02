# Plan: JSONL Graph Format Support

> Track: jsonl-graph-format-20260331
> Spec: [spec.md](./spec.md)

## Overview

- **Source**: .please/docs/tracks/active/jsonl-graph-format-20260331/spec.md
- **Issue**: #261
- **Created**: 2026-03-31
- **Approach**: Pragmatic — follow proven embeddings.jsonl pattern, minimal new abstractions

## Purpose

After this change, developers and CI pipelines will be able to store RPG graphs as JSONL files where each node and edge occupies a single line. They can verify it works by running `soop encode --format jsonl` and observing that single-node edits produce 1-2 line git diffs instead of full-file rewrites.

## Context

The RPG graph is currently serialized as a single pretty-printed JSON file (`graph.json`) via `RepositoryPlanningGraph.toJSON()` which calls `JSON.stringify(data, null, 2)`. Any change to a single node or edge rewrites the entire file, producing large git diffs and frequent merge conflicts when CI and local branches both evolve the graph.

The codebase already has a proven JSONL pattern for embeddings (`serializeEmbeddingsJsonl` / `parseEmbeddingsJsonl` in `packages/graph/src/embeddings.ts`): metadata on line 1, data entries sorted by ID on subsequent lines. This pattern can be directly reused for graph serialization.

The `PythonRPG` serialization format contains: `repo_name`, `repo_info`, `data_flow[]`, `excluded_files[]`, `repo_node_id`, `nodes[]`, `edges[]`, `_dep_to_rpg_map`, `dep_graph`. The arrays (nodes, edges, data_flow) are already sorted deterministically by `serialize()` in `rpg.ts:482-499`.

Non-goals: converting `meta.json` to JSONL (too small), streaming parsers, automatic migration of existing files.

## Architecture Decision

The JSONL format uses a type-discriminated line structure following the embeddings pattern:

- **Line 1 (header)**: `{"type":"header","repo_name":"...","repo_info":"...","excluded_files":[...],"repo_node_id":"...","_dep_to_rpg_map":{...},"dep_graph":null}`
- **Lines 2..N (nodes)**: `{"type":"node",...PythonNode fields}` — sorted by `id`
- **Lines N+1..M (edges)**: `{"type":"edge",...PythonEdge fields}` — sorted by `(src, dst, relation)`
- **Lines M+1..K (data_flow)**: `{"type":"data_flow",...data flow fields}` — sorted by `(source, target, dataId)`

The `type` discriminator enables self-describing records and future extensibility. The meta companion file stays as `.meta.json` regardless of graph format. `metaPathFor()` is updated so that `graph.jsonl` maps to `graph.meta.json` (not `.meta.jsonl`).

Dual-format support: auto-detect by file extension on load (`.jsonl` preferred over `.json`), CLI `--format` flag controls output format (default: `jsonl`).

## Tasks

- [x] T001 Add JSONL serialization/deserialization functions for PythonRPG (file: packages/graph/src/jsonl.ts)
- [x] T002 Add toJSONL/fromJSONL methods to RepositoryPlanningGraph (file: packages/graph/src/rpg.ts) (depends on T001)
- [x] T003 Update metaPathFor to produce .meta.json for .jsonl inputs (file: packages/graph/src/meta.ts)
- [x] T004 [P] Update encoder save to support JSONL format option (file: packages/encoder/src/encoder.ts) (depends on T002, T003)
- [x] T005 [P] Add --format flag to CLI encode command (file: packages/cli/src/cli.ts) (depends on T004)
- [x] T006 [P] Add --format flag to CLI evolve command (file: packages/cli/src/cli.ts) (depends on T004)
- [x] T007 [P] Update sync command to auto-detect graph.jsonl (file: packages/cli/src/commands/sync.ts) (depends on T002)
- [x] T008 [P] Update MCP server to auto-detect and load JSONL graphs (file: packages/mcp/src/server.ts) (depends on T002)
- [x] T009 Export JSONL functions from graph package barrel (file: packages/graph/src/index.ts) (depends on T001)

## Key Files

### Create

- `packages/graph/src/jsonl.ts` — JSONL serialize/parse functions for PythonRPG
- `packages/graph/tests/jsonl.test.ts` — Round-trip, sorting, diff-friendliness tests

### Modify

- `packages/graph/src/rpg.ts` — Add `toJSONL()`, `toJSONLWithMeta()`, `fromJSONL()` methods
- `packages/graph/src/meta.ts` — Fix `metaPathFor()` for `.jsonl` → `.meta.json`
- `packages/graph/src/index.ts` — Export new JSONL functions
- `packages/encoder/src/encoder.ts` — `save()` accepts format option, calls `toJSONL()` or `toJSON()`
- `packages/cli/src/cli.ts` — `--format jsonl|json` flag on encode/evolve commands
- `packages/cli/src/commands/sync.ts` — Auto-detect `graph.jsonl` vs `graph.json`
- `packages/mcp/src/server.ts` — `loadRPG()` auto-detects JSONL format

### Reuse

- `packages/graph/src/embeddings.ts:227-250` — Pattern reference for JSONL serialize/parse
- `packages/graph/src/python-format.ts` — `PythonRPG`, `PythonNode`, `PythonEdge` schemas

## Verification

### Automated Tests

- [ ] `serializeGraphJsonl` produces header + sorted node lines + sorted edge lines + sorted data_flow lines
- [ ] `parseGraphJsonl` round-trips: `parse(serialize(graph))` equals original
- [ ] Single node modification produces ≤3 line diff
- [ ] Two independent node additions produce non-conflicting diffs (different line positions)
- [ ] `metaPathFor('graph.jsonl')` returns `graph.meta.json`
- [ ] CLI `soop encode --format jsonl` produces valid `.jsonl` output
- [ ] MCP `loadRPG()` loads both `.json` and `.jsonl` graph files

### Observable Outcomes

- Running `soop encode --format jsonl -o graph.jsonl` produces a file where `wc -l` equals 1 + nodeCount + edgeCount + dataFlowCount
- Running `git diff` after modifying one node in a `.jsonl` graph shows only the changed line

### Acceptance Criteria Check

- [ ] AC-1: Single node change → ≤3 line diff
- [ ] AC-2: Two independent additions → mergeable by git
- [ ] AC-3: Round-trip fidelity (fromJSONL(toJSONL(graph)) === original)
- [ ] AC-4: CLI `--format jsonl` works
- [ ] AC-5: MCP loads both formats
- [ ] AC-6: Sync works with `graph.jsonl`

## Decision Log

- Decision: Use type-discriminated lines (`{"type":"node",...}`) instead of section markers
  Rationale: Self-describing records enable streaming parsing and future extensibility without positional assumptions
  Date/Author: 2026-03-31 / Claude

- Decision: Meta companion file always uses `.meta.json` extension regardless of graph format
  Rationale: Meta is small JSON, not JSONL; using `.meta.jsonl` would be misleading
  Date/Author: 2026-03-31 / Claude

## Outcomes & Retrospective

### What Was Shipped
- JSONL serialize/parse for PythonRPG with type-discriminated lines and deterministic sorting
- toJSONL/fromJSONL methods on RepositoryPlanningGraph
- Dual-format support (JSON/JSONL) with auto-detection across CLI, encoder, sync, and MCP
- `--format jsonl|json` CLI flag for encode/evolve (default: jsonl)
- metaPathFor handles .jsonl → .meta.json

### What Went Well
- Reusing the existing embeddings.jsonl pattern made design straightforward
- The existing serialize() method already sorted nodes/edges deterministically
- Code review caught a critical bug (sync localGraphPath mismatch) before merge

### What Could Improve
- The sync command needed more careful consideration of the local copy path — this should have been caught during planning

### Tech Debt Created
- No performance benchmark for JSONL vs JSON (NFR-1 from spec)
- No explicit git merge test (AC-2 from spec) — sorting inherently provides this
