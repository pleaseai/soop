import type { RepositoryPlanningGraph } from '../../graph/rpg'
import type { ChangedEntity } from './types'

/**
 * DeleteNode — Algorithm 1 from RPG-Encoder §4 (deletion.tex)
 *
 * 1. Remove the target node (CASCADE deletes incident edges)
 * 2. PruneOrphans: recursively remove empty ancestor HighLevelNodes
 *
 * Returns the number of pruned ancestor nodes.
 */
export async function deleteNode(rpg: RepositoryPlanningGraph, entityId: string): Promise<number> {
  const node = await rpg.getNode(entityId)
  if (!node) {
    return 0 // Idempotent: already deleted
  }

  // Remember parent before removal
  const parent = await rpg.getParent(entityId)

  // Remove node (CASCADE deletes all incident edges)
  await rpg.removeNode(entityId)

  // Prune orphan ancestors
  if (parent) {
    return pruneOrphans(rpg, parent.id)
  }

  return 0
}

/**
 * PruneOrphans — recursive bottom-up removal of empty ancestors
 *
 * If a parent node has no remaining children after deletion,
 * remove it and recurse to its parent.
 */
async function pruneOrphans(rpg: RepositoryPlanningGraph, nodeId: string): Promise<number> {
  const node = await rpg.getNode(nodeId)
  if (!node) {
    return 0
  }

  // Check if node still has children
  const children = await rpg.getChildren(nodeId)
  if (children.length > 0) {
    return 0 // Has children, stop pruning
  }

  // Node is empty — remember parent, then remove
  const parent = await rpg.getParent(nodeId)

  await rpg.removeNode(nodeId)

  // Recurse to parent
  if (parent) {
    return 1 + (await pruneOrphans(rpg, parent.id))
  }

  return 1
}

/**
 * Build a qualified entity ID for matching graph nodes
 *
 * Current encoder uses: filePath:entityType:entityName:startLine
 * Evolution matches on: filePath:entityType:qualifiedName (without line numbers)
 */
export function buildEntityId(entity: ChangedEntity): string {
  return entity.id
}

/**
 * Find a node in the RPG that matches a ChangedEntity.
 *
 * Tries exact match first, then falls back to prefix match
 * (to handle line number differences in existing node IDs).
 */
export async function findMatchingNode(
  rpg: RepositoryPlanningGraph,
  entity: ChangedEntity,
): Promise<string | null> {
  // Try exact match (evolution-style ID without line numbers)
  if (await rpg.hasNode(entity.id)) {
    return entity.id
  }

  // Fallback: search for nodes with matching file path and entity name
  // The existing encoder uses filePath:entityType:entityName:startLine format
  const nodes = await rpg.getLowLevelNodes()
  for (const node of nodes) {
    if (
      node.metadata?.path === entity.filePath
      && node.metadata?.entityType === entity.entityType
    ) {
      // Check if the node ID starts with the entity's base ID pattern
      const basePattern = `${entity.filePath}:${entity.entityType}:${entity.entityName}`
      if (node.id.startsWith(basePattern)) {
        return node.id
      }
    }
  }

  return null
}
