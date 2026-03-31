# JSONL Graph Format Support

> Track: jsonl-graph-format-20260331

## Overview

Add JSONL (JSON Lines) serialization format for the RPG graph to enable git-friendly storage. Currently, `graph.json` is a single pretty-printed JSON file — any node/edge change rewrites the entire file, producing large diffs and frequent merge conflicts. JSONL stores one record per line with deterministic sorting, making diffs minimal and merges tractable.

## Requirements

### Functional Requirements

- [ ] FR-1: Add `toJSONL()` method to `RepositoryPlanningGraph` that serializes the graph as JSONL with a metadata header line followed by one node/edge per line, sorted by ID
- [ ] FR-2: Add `fromJSONL(content)` static method to `RepositoryPlanningGraph` that deserializes a JSONL-formatted graph
- [ ] FR-3: Support dual format — auto-detect `.json` vs `.jsonl` on load based on file extension
- [ ] FR-4: Add `--format jsonl|json` CLI flag to `encode` and `evolve` commands (default: `jsonl`)
- [ ] FR-5: Update `soop sync` to handle JSONL graph files from canonical `.soop/graph.jsonl`
- [ ] FR-6: Update MCP server to load JSONL graph files (auto-detect like embeddings)
- [ ] FR-7: Sort nodes by ID and edges by `(source, target, type)` for deterministic output that minimizes git diff noise

### Non-functional Requirements

- [ ] NFR-1: JSONL serialization/deserialization performance must be within 10% of JSON for graphs up to 10,000 nodes
- [ ] NFR-2: JSONL output must produce minimal diffs when a single node or edge is added/modified/removed
- [ ] NFR-3: Maintain backward compatibility — existing `.json` graph files must continue to load without changes

## Acceptance Criteria

- [ ] AC-1: Modifying one node in a graph produces a diff of ≤3 lines (the changed line + optional adjacent context)
- [ ] AC-2: Two independent node additions to a JSONL graph file can be merged by git without conflicts
- [ ] AC-3: `fromJSONL(toJSONL(graph))` round-trips without data loss
- [ ] AC-4: CLI `soop encode --format jsonl` produces a valid `.jsonl` output file
- [ ] AC-5: MCP server correctly loads both `.json` and `.jsonl` graph files
- [ ] AC-6: `soop sync` works with canonical `graph.jsonl` files

## Out of Scope

- Converting `meta.json` to JSONL (too small to benefit)
- Automatic migration of existing `graph.json` files to `.jsonl` (users can re-encode)
- Git LFS integration for JSONL files
- Streaming JSONL parsing for very large graphs

## Assumptions

- The existing `embeddings.jsonl` pattern (metadata header + sorted data lines) is proven and can be reused for graph serialization
- Node and edge IDs are unique and suitable as sort keys for deterministic output
- The `PythonRPG` schema structure can be decomposed into per-line records without information loss
