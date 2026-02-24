import type { EntityType } from '@pleaseai/rpg-graph/node'
import type { SemanticOptions } from '../semantic'

export interface EvolutionOptions {
  commitRange: string
  repoPath: string
  driftThreshold?: number
  forceRegenerateThreshold?: number
  useLLM?: boolean
  semantic?: SemanticOptions
  includeSource?: boolean
}

export interface EvolutionResult {
  inserted: number
  deleted: number
  modified: number
  rerouted: number
  prunedNodes: number
  duration: number
  llmCalls: number
  errors: Array<{ entity: string, phase: string, error: string }>
  embeddingChanges?: { added: string[], removed: string[], modified: string[] }
  requiresFullEncode?: boolean
}

export interface ChangedEntity {
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
