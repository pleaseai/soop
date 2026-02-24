import type { EntityType } from '@pleaseai/rpg-graph/node'
import type { SemanticOptions } from '../semantic'

export interface EvolutionOptions {
  /** Git commit range to evolve (e.g. `"HEAD~1..HEAD"`, `"abc123..def456"`) */
  commitRange: string
  /** Absolute path to the repository root */
  repoPath: string
  /** Cosine distance threshold for semantic drift to trigger node rerouting (default: 0.3) */
  driftThreshold?: number
  /**
   * Change ratio threshold for full re-encode (default: 0.5).
   * Computed as `totalChanges / nodeCount`. When this ratio exceeds the threshold,
   * the evolver returns `requiresFullEncode: true` instead of applying incremental changes.
   */
  forceRegenerateThreshold?: number
  /** Whether to use LLM for semantic feature re-extraction (default: true) */
  useLLM?: boolean
  /** Options passed to the semantic extractor for modified entities */
  semantic?: SemanticOptions
  /** Whether to include source code in ChangedEntity objects (default: false) */
  includeSource?: boolean
}

export interface EvolutionResult {
  /** Number of new entities inserted */
  inserted: number
  /** Number of entities deleted */
  deleted: number
  /** Number of entities modified */
  modified: number
  /** Number of modified entities rerouted to a different functional area */
  rerouted: number
  /** Number of orphaned high-level nodes pruned from the graph */
  prunedNodes: number
  /** Wall-clock duration of the evolution run in milliseconds */
  duration: number
  /** Number of LLM API calls made during this evolution */
  llmCalls: number
  /** Non-fatal errors encountered during evolution */
  errors: Array<{ entity: string, phase: string, error: string }>
  /** Embedding store changes for incremental vector index updates */
  embeddingChanges?: { added: string[], removed: string[], modified: string[] }
  /**
   * True when changeRatio (totalChanges / nodeCount) exceeds forceRegenerateThreshold.
   * When true, callers should discard the current graph and run a full `encode()` instead.
   */
  requiresFullEncode: boolean
}

export interface ChangedEntity {
  /** Entity ID in the format `filePath:entityType:qualifiedName` */
  id: string
  filePath: string
  entityType: EntityType
  entityName: string
  qualifiedName: string
  sourceCode?: string
  startLine?: number
  endLine?: number
}

export interface DiffResult {
  insertions: ChangedEntity[]
  deletions: ChangedEntity[]
  modifications: Array<{
    old: ChangedEntity
    new: ChangedEntity
  }>
}

export type FileChangeStatus = 'A' | 'M' | 'D'

export interface FileChange {
  status: FileChangeStatus
  filePath: string
  oldFilePath?: string
}

export const DEFAULT_DRIFT_THRESHOLD = 0.3
export const DEFAULT_FORCE_REGENERATE_THRESHOLD = 0.5
