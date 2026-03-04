import type { Node } from '@pleaseai/soop-graph/node'
import type { RepositoryPlanningGraph } from '@pleaseai/soop-graph/rpg'
import type { LLMClient } from '@pleaseai/soop-utils/llm'
import type { Embedding } from '../embedding'
import type { SemanticRoutingResponse } from './prompts'
import { isHighLevelNode } from '@pleaseai/soop-graph/node'
import { createLogger } from '@pleaseai/soop-utils/logger'
import { z } from 'zod/v4'
import { buildSemanticRoutingPrompt, SemanticRoutingResponseSchema } from './prompts'

const log = createLogger('SemanticRouter')

/**
 * FindBestParent — LLM-based recursive top-down semantic routing
 *
 * Implements the FindBestParent sub-procedure from Algorithm 4
 * (RPG-Encoder §3, Appendix A.2, insertion.tex):
 * Starting at the root, recursively descend through HighLevelNode children,
 * asking the LLM which child is the best semantic parent for a new entity.
 */
export class SemanticRouter {
  private readonly rpg: RepositoryPlanningGraph
  private readonly llmClient?: LLMClient
  private readonly embedding?: Embedding
  private readonly confidenceThreshold: number
  private llmCalls = 0

  constructor(
    rpg: RepositoryPlanningGraph,
    options?: { llmClient?: LLMClient, embedding?: Embedding, confidenceThreshold?: number },
  ) {
    this.rpg = rpg
    this.llmClient = options?.llmClient
    this.embedding = options?.embedding
    this.confidenceThreshold = options?.confidenceThreshold ?? 0.3
  }

  /**
   * Find the best parent node for a new entity with the given feature description.
   *
   * Returns the node ID of the best parent.
   */
  async findBestParent(entityFeature: string): Promise<string | null> {
    // Get root-level nodes (those with no functional parent)
    const highLevelNodes = await this.rpg.getHighLevelNodes()
    if (highLevelNodes.length === 0) {
      return null
    }

    // Find root nodes: high-level nodes that have no parent
    const roots: Node[] = []
    for (const node of highLevelNodes) {
      const parent = await this.rpg.getParent(node.id)
      if (!parent) {
        roots.push(node)
      }
    }

    if (roots.length === 0) {
      return null
    }

    // If only one root, start descent from it
    if (roots.length === 1 && roots[0]) {
      return this.descend(roots[0].id, entityFeature)
    }

    // Multiple roots: select among them first
    const bestRootId = await this.selectBestChild(roots, entityFeature)
    if (!bestRootId) {
      return null
    }

    return this.descend(bestRootId, entityFeature)
  }

  /**
   * Recursively descend through the hierarchy to find the best parent
   */
  private async descend(nodeId: string, entityFeature: string): Promise<string> {
    const children = await this.rpg.getChildren(nodeId)

    // Filter to high-level (abstract) children only
    const abstractChildren = children.filter(isHighLevelNode)

    // Base case: no abstract children — this node is the best parent
    if (abstractChildren.length === 0) {
      return nodeId
    }

    const bestChildId = await this.selectBestChild(abstractChildren, entityFeature)

    // LLM said "none" — current node is the best parent
    if (!bestChildId) {
      return nodeId
    }

    // Recurse into chosen child
    return this.descend(bestChildId, entityFeature)
  }

  /**
   * Select the best child from candidates using LLM or embedding fallback
   */
  private async selectBestChild(candidates: Node[], entityFeature: string): Promise<string | null> {
    if (this.llmClient) {
      return this.selectWithLLM(candidates, entityFeature)
    }

    if (this.embedding) {
      return this.selectWithEmbedding(candidates, entityFeature)
    }

    // No LLM or embedding — return first candidate as deterministic fallback
    const fallbackId = candidates[0]?.id ?? null
    if (fallbackId) {
      log.warn(
        `No LLM or embedding configured — falling back to first candidate "${fallbackId}" for entity: "${entityFeature.slice(0, 80)}"`,
      )
    }
    return fallbackId
  }

  /**
   * Select best child using LLM
   */
  private async selectWithLLM(candidates: Node[], entityFeature: string): Promise<string | null> {
    const candidateList = candidates.map(c => ({
      id: c.id,
      description: c.feature.description,
    }))

    const { prompt, systemPrompt } = buildSemanticRoutingPrompt(entityFeature, candidateList)

    try {
      const response = await this.llmClient?.completeJSON<SemanticRoutingResponse>(
        prompt,
        systemPrompt,
        SemanticRoutingResponseSchema,
      )
      this.llmCalls++

      if (response?.selectedId) {
        // Check confidence threshold — low confidence means no good fit
        if (response.confidence < this.confidenceThreshold) {
          log.debug(
            `LLM routing confidence ${response.confidence} below threshold ${this.confidenceThreshold} — returning null`,
          )
          return null
        }

        // Validate the selected ID exists in candidates
        const valid = candidates.some(c => c.id === response.selectedId)
        if (valid) {
          return response.selectedId
        }
      }

      return null
    }
    catch (error) {
      this.llmCalls++ // API was called even if it failed
      log.warn(
        'LLM call failed, falling back to embedding-based routing:',
        error instanceof Error ? error.message : String(error),
      )
      if (this.embedding) {
        return this.selectWithEmbedding(candidates, entityFeature)
      }
      return null
    }
  }

  /**
   * Select best child using cosine similarity of embeddings
   */
  private async selectWithEmbedding(
    candidates: Node[],
    entityFeature: string,
  ): Promise<string | null> {
    if (!this.embedding) {
      return null
    }

    const entityEmbed = await this.embedding.embed(entityFeature)
    let bestScore = Number.NEGATIVE_INFINITY
    let bestId: string | null = null

    for (const candidate of candidates) {
      const candidateEmbed = await this.embedding.embed(candidate.feature.description)
      const similarity = cosineSimilarity(entityEmbed.vector, candidateEmbed.vector)

      if (similarity > bestScore) {
        bestScore = similarity
        bestId = candidate.id
      }
    }

    return bestId
  }

  /**
   * Create a new functional area for an entity that doesn't fit existing areas.
   *
   * Uses LLM to generate an area name from the entity feature, then creates
   * a 2-level hierarchy: domain:NewArea/subcategory.
   * Returns the leaf node ID.
   */
  async createNewArea(entityFeature: string): Promise<string> {
    let areaName = 'NewArea'
    let subcategory = 'general'

    if (this.llmClient) {
      try {
        const response = await this.llmClient.completeJSON<{ areaName: string, subcategory: string }>(
          `Given this code entity feature description, suggest a PascalCase functional area name and a lowercase subcategory name for organizing it.\n\nEntity feature: ${entityFeature}\n\nRespond with JSON: {"areaName": "PascalCaseName", "subcategory": "lowercase descriptive name"}`,
          'You are a code architecture classifier. Respond with ONLY valid JSON.',
          z.object({ areaName: z.string(), subcategory: z.string() }),
        )
        this.llmCalls++
        if (response?.areaName) {
          areaName = response.areaName
        }
        if (response?.subcategory) {
          subcategory = response.subcategory
        }
      }
      catch (error) {
        this.llmCalls++
        log.warn(
          'LLM call failed for area name generation, using default:',
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    // Create the 2-level hierarchy
    const areaId = `domain:${areaName}`
    if (!(await this.rpg.hasNode(areaId))) {
      await this.rpg.addHighLevelNode({
        id: areaId,
        feature: {
          description: `provide ${areaName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} functionality`,
          keywords: [areaName.toLowerCase()],
        },
      })
    }

    const leafId = `domain:${areaName}/${subcategory}`
    if (!(await this.rpg.hasNode(leafId))) {
      await this.rpg.addHighLevelNode({
        id: leafId,
        feature: {
          description: subcategory,
          keywords: subcategory.split(/\s+/),
        },
      })
      await this.rpg.addFunctionalEdge({ source: areaId, target: leafId })
    }

    return leafId
  }

  /**
   * Get total LLM calls made during routing
   */
  getLLMCalls(): number {
    return this.llmCalls
  }

  /**
   * Reset LLM call counter
   */
  resetLLMCalls(): void {
    this.llmCalls = 0
  }
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    dotProduct += ai * bi
    normA += ai * ai
    normB += bi * bi
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) {
    return 0
  }

  return dotProduct / magnitude
}
