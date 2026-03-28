# Type Analyzer Agent Memory

## Project: soop please (RPG)

### Edge Type Design Pattern
- All edges use `source`/`target` (not `from`/`to`) — established by `BaseEdgeSchema`
- `DataFlowEdge` was previously a standalone schema NOT extending `BaseEdgeSchema` (used `from`/`to`)
- PR #155 migrated `DataFlowEdge` to extend `BaseEdgeSchema` (`source`/`target`) and join the discriminated union
- `LegacyDataFlowEdgeSchema` exists for backward compat deserialization only (not in the `Edge` union)
- `DependencyEdge` has `symbol`/`targetSymbol` fields that ARE serialized in `edgeToAttrs` as `dep_symbol`/`dep_target_symbol` (adapters.ts lines 136-139)

### Evolution Types Pattern
- `driftThreshold` has a `DEFAULT_DRIFT_THRESHOLD = 0.3` constant exported from types.ts
- `forceRegenerateThreshold` has `DEFAULT_FORCE_REGENERATE_THRESHOLD = 0.5` constant
- `confidenceThreshold` (added PR #155) DOES have a `DEFAULT_CONFIDENCE_THRESHOLD = 0.3` constant — defined in `packages/encoder/src/evolution/types.ts` line 92
- Default value 0.3 is duplicated in JSDoc for `EvolutionOptions` only — the `SemanticRouter` constructor uses the constant, not a hardcoded value
- `newAreasCreated` is `required` (not optional) in `EvolutionResult` — correct, metrics should not be optional

### Adapter Pattern
- `edgeToAttrs` / `attrsToEdge` are the bidirectional store adapters in `packages/graph/src/adapters.ts`
- DataFlowEdge adapter uses `df_` prefix for attribute names (consistent namespace)
- `attrsToEdge` has an unsafe cast for `dependencyType` — no validation before cast

### Serialization Architecture
- `dataFlowEdges` are serialized to a SEPARATE array in JSON (not mixed with `edges`)
- This design allows separate migration/legacy handling during deserialization
- `SerializedRPGSchema` uses `z.array(z.unknown())` for `dataFlowEdges` — intentionally loose for migration

### Test Coverage
- Legacy format tests exist: graph.test.ts line ~408 (from/to format migration)
- data-flow.test.ts uses `source`/`target` correctly after PR #155
