/**
 * LLM prompt templates for RPG Evolution operations
 */

/**
 * Semantic Routing Prompt — used by FindBestParent
 *
 * Given a new entity's feature description and a list of candidate parent
 * categories, the LLM selects the most semantically compatible parent.
 */
export function buildSemanticRoutingPrompt(
  entityFeature: string,
  candidates: Array<{ id: string, description: string }>,
): { prompt: string, systemPrompt: string } {
  const candidateList = candidates.map((c, i) => `${i + 1}. [${c.id}]: ${c.description}`).join('\n')

  return {
    systemPrompt: `You are a code architecture classifier. Your task is to route a code entity to the most semantically compatible category in a hierarchical codebase graph.

Respond with ONLY valid JSON in this exact format:
{"selectedId": "<category_id or null>", "confidence": <0.0-1.0>}

Rules:
- Select the category whose description is most semantically related to the entity's feature
- If no category is a good fit, set selectedId to null
- confidence should reflect how well the entity fits the selected category`,

    prompt: `Route this code entity to the best parent category.

Entity feature: ${entityFeature}

Available categories:
${candidateList}

Which category is the most semantically compatible parent for this entity?`,
  }
}

/**
 * Response type for semantic routing
 */
export interface SemanticRoutingResponse {
  selectedId: string | null
  confidence: number
}

/**
 * Drift Detection Prompt — secondary check when cosine similarity is ambiguous
 *
 * Given old and new feature descriptions for the same entity, assess whether
 * the semantic intent has fundamentally changed.
 */
export function buildDriftDetectionPrompt(
  oldFeature: string,
  newFeature: string,
): { prompt: string, systemPrompt: string } {
  return {
    systemPrompt: `You are a code evolution analyst. Determine whether a code entity's semantic intent has fundamentally changed between two versions.

Respond with ONLY valid JSON in this exact format:
{"drifted": true/false, "reason": "brief explanation"}

Rules:
- "drifted" = true means the entity now serves a fundamentally different purpose
- "drifted" = false means the entity still serves the same purpose (even if implementation details changed)
- Focus on WHAT the code does, not HOW it does it`,

    prompt: `Has this entity's semantic intent fundamentally changed?

Old feature: ${oldFeature}
New feature: ${newFeature}

Has the semantic intent drifted?`,
  }
}

/**
 * Response type for drift detection
 */
export interface DriftDetectionResponse {
  drifted: boolean
  reason: string
}
