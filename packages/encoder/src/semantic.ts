import type { ClaudeCodeSettings, CodexCliSettings, LLMProvider } from '@pleaseai/rpg-utils/llm'
import { SemanticFeatureSchema as NodeSemanticFeatureSchema } from '@pleaseai/rpg-graph/node'
import { LLMClient } from '@pleaseai/rpg-utils/llm'
import { createLogger } from '@pleaseai/rpg-utils/logger'
import { z } from 'zod/v4'
import { buildBatchClassPrompt, buildBatchFunctionPrompt } from './reorganization/prompts'
import { estimateEntityTokens } from './token-counter'

const log = createLogger('SemanticExtractor')

/**
 * Options for semantic extraction
 */
export interface SemanticOptions {
  /** LLM provider to use */
  provider?: LLMProvider
  /** Model name (e.g., 'gpt-5.2', 'haiku', 'gemini-3-flash-preview') */
  model?: string
  /** API key (defaults to environment variable) */
  apiKey?: string
  /** Whether to use LLM for semantic extraction (if false, uses heuristic) */
  useLLM?: boolean
  /** Maximum tokens per request */
  maxTokens?: number
  /** Claude Code provider settings (only used when provider is 'claude-code') */
  claudeCodeSettings?: ClaudeCodeSettings
  /** Codex CLI provider settings (only used when provider is 'codex') */
  codexSettings?: CodexCliSettings
  /** Minimum tokens per batch - if last batch is below this, merge with previous (default: 10000) */
  minBatchTokens?: number
  /** Maximum tokens per batch - group entities until this limit (default: 50000) */
  maxBatchTokens?: number
  /** Maximum parse iterations for retry on LLM extraction failure (default: 3) */
  maxParseIterations?: number
  /** Repository name (for LLM batch prompts) */
  repoName?: string
  /** Repository overview/info (for richer LLM prompts) */
  repoInfo?: string
  /** Maximum concurrent batch LLM requests (default: 4) */
  maxConcurrentBatches?: number
}

/**
 * Zod schema for semantic feature with required keywords (extends graph/node schema)
 */
export const SemanticFeatureSchema = NodeSemanticFeatureSchema.extend({
  keywords: z.array(z.string()),
})

/**
 * Semantic feature generated for an entity
 */
export type SemanticFeature = z.infer<typeof SemanticFeatureSchema>

/**
 * Input for semantic extraction
 */
export interface EntityInput {
  /** Entity type (function, class, method, file) */
  type: string
  /** Entity name */
  name: string
  /** Source code (optional, for LLM analysis) */
  sourceCode?: string
  /** File path */
  filePath: string
  /** Parent entity name (for methods) */
  parent?: string
  /** Documentation/comments */
  documentation?: string
}

/**
 * A class entity with its child methods for batched processing
 */
export interface ClassGroup {
  classEntity: EntityInput
  methodEntities: EntityInput[]
}

/**
 * Result of a batch parse call from LLM
 * Maps entity name to feature(s)
 */
export type BatchParseResult = Record<string, string[] | Record<string, string[]>>

/**
 * Run tasks with a concurrency limit
 */
async function runConcurrent<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]!()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

/**
 * Semantic extractor using LLM or heuristics
 */
export class SemanticExtractor {
  private readonly llmClient?: LLMClient
  private readonly options: SemanticOptions
  private readonly warnings: string[] = []

  constructor(options: SemanticOptions = {}) {
    this.options = {
      useLLM: true,
      maxTokens: 2048,
      minBatchTokens: 10000,
      maxBatchTokens: 50000,
      maxParseIterations: 3,
      maxConcurrentBatches: 4,
      ...options,
    }

    // Initialize LLM client if enabled
    if (this.options.useLLM) {
      const provider = this.options.provider
      if (provider) {
        this.llmClient = new LLMClient({
          provider,
          model: this.options.model,
          apiKey: this.options.apiKey,
          maxTokens: this.options.maxTokens,
          claudeCodeSettings: this.options.claudeCodeSettings,
          codexSettings: this.options.codexSettings,
        })
      }
    }
  }

  /**
   * Get the internal LLM client (for usage stats)
   */
  getLLMClient(): LLMClient | undefined {
    return this.llmClient
  }

  /**
   * Get accumulated warnings from LLM fallback events
   */
  getWarnings(): readonly string[] {
    return this.warnings
  }

  /**
   * Extract semantic features for an entity
   */
  async extract(input: EntityInput): Promise<SemanticFeature> {
    // Try LLM extraction if available
    if (this.llmClient && input.sourceCode) {
      const maxIterations = this.options.maxParseIterations ?? 3
      for (let attempt = 1; attempt <= maxIterations; attempt++) {
        try {
          return await this.extractWithLLM(input)
        }
        catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (attempt < maxIterations) {
            log.debug(`LLM extraction attempt ${attempt}/${maxIterations} failed for ${input.name}: ${msg}. Retrying...`)
            continue
          }
          const warningMsg = `LLM extraction failed for ${input.name} after ${maxIterations} attempts: ${msg}. Falling back to heuristic.`
          this.warnings.push(`[SemanticExtractor] ${warningMsg}`)
          log.warn(warningMsg)
        }
      }
    }

    // Use heuristic extraction
    return this.extractWithHeuristic(input)
  }

  /**
   * Extract batch of entities (with grouped batching for classes/functions and multi-iteration retry)
   */
  async extractBatch(inputs: EntityInput[]): Promise<SemanticFeature[]> {
    // Build a map of index -> result for preserving order
    const resultMap = new Map<number, SemanticFeature>()

    // Separate entities by type
    const classEntities = inputs.filter(e => e.type === 'class')
    const methodEntities = inputs.filter(e => e.type === 'method')
    const functionEntities = inputs.filter(e => e.type === 'function')

    // Build class groups: each class with its child methods
    const classGroups: ClassGroup[] = classEntities.map(classEntity => ({
      classEntity,
      methodEntities: methodEntities.filter(m => m.parent === classEntity.name),
    }))

    // Process if LLM is available
    if (this.llmClient) {
      // Process class groups with batch LLM
      if (classGroups.length > 0) {
        await this.processClassGroupBatches(classGroups, inputs, resultMap)
      }

      // Process standalone functions with batch LLM
      if (functionEntities.length > 0) {
        await this.processFunctionBatches(functionEntities, inputs, resultMap)
      }
    }

    // Fall back to individual extraction for entities not yet in resultMap
    const remainingEntities = inputs.filter((_, i) => !resultMap.has(i))
    for (const entity of remainingEntities) {
      const idx = inputs.indexOf(entity)
      const feature = await this.extract(entity)
      resultMap.set(idx, feature)
    }

    // Return results in original order
    return inputs.map((_, i) => resultMap.get(i)!)
  }

  /**
   * Process class groups using token-aware batching and parallel LLM calls
   */
  private async processClassGroupBatches(
    classGroups: ClassGroup[],
    allInputs: EntityInput[],
    resultMap: Map<number, SemanticFeature>,
  ): Promise<void> {
    const batches = this.createClassGroupBatches(classGroups)
    const maxConcurrent = this.options.maxConcurrentBatches ?? 4
    const maxIterations = this.options.maxParseIterations ?? 3

    log.debug(`Processing ${classGroups.length} class groups in ${batches.length} batches (concurrency: ${maxConcurrent})`)

    const tasks = batches.map(batch => async () => {
      let pendingGroups = batch
      let iteration = 0

      while (pendingGroups.length > 0 && iteration < maxIterations) {
        iteration++
        try {
          const batchResult = await this.extractClassBatch(pendingGroups)
          const stillMissing: ClassGroup[] = []

          for (const group of pendingGroups) {
            const { classEntity, methodEntities } = group
            const classResult = batchResult.get(classEntity.name)

            if (classResult instanceof Map) {
              // Class with methods: methodMap has '__class__' entry for the class itself
              const classFeature = classResult.get('__class__')
              if (classFeature) {
                const classIdx = allInputs.indexOf(classEntity)
                if (classIdx !== -1) {
                  resultMap.set(classIdx, classFeature)
                }
              }
              else if (iteration < maxIterations) {
                stillMissing.push({ classEntity, methodEntities: [] })
              }

              // Fill in method results
              const missingMethods: EntityInput[] = []
              for (const method of methodEntities) {
                const methodFeature = classResult.get(method.name)
                if (methodFeature) {
                  const methodIdx = allInputs.indexOf(method)
                  if (methodIdx !== -1) {
                    resultMap.set(methodIdx, methodFeature)
                  }
                }
                else if (iteration < maxIterations) {
                  missingMethods.push(method)
                }
              }
              // If some methods are missing and we have more iterations, retry just those methods
              if (missingMethods.length > 0 && iteration < maxIterations) {
                stillMissing.push({ classEntity: { ...classEntity, sourceCode: '' }, methodEntities: missingMethods })
              }
            }
            else if (classResult !== undefined) {
              // Data-only class (SemanticFeature)
              const classIdx = allInputs.indexOf(classEntity)
              if (classIdx !== -1) {
                resultMap.set(classIdx, classResult)
              }
            }
            else if (iteration < maxIterations) {
              // No result for this class, retry
              stillMissing.push(group)
            }
          }

          pendingGroups = stillMissing
        }
        catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          log.warn(`Class batch iteration ${iteration}/${maxIterations} failed: ${msg}`)
          break
        }
      }
    })

    await runConcurrent(tasks, maxConcurrent)
  }

  /**
   * Extract features for a batch of class groups using LLM.
   * Returns a map: className -> (Map<methodName | '__class__', SemanticFeature> | SemanticFeature)
   */
  private async extractClassBatch(
    classGroups: ClassGroup[],
  ): Promise<Map<string, Map<string, SemanticFeature> | SemanticFeature>> {
    const result = new Map<string, Map<string, SemanticFeature> | SemanticFeature>()

    // Build combined source code for all class groups
    const codeBlocks: string[] = []
    for (const { classEntity, methodEntities } of classGroups) {
      if (classEntity.sourceCode) {
        codeBlocks.push(classEntity.sourceCode)
      }
      else if (methodEntities.length > 0) {
        const parts = [`class ${classEntity.name} {`]
        for (const method of methodEntities) {
          if (method.sourceCode) {
            parts.push(`  ${method.sourceCode}`)
          }
        }
        parts.push('}')
        codeBlocks.push(parts.join('\n'))
      }
    }

    if (codeBlocks.length === 0) {
      return result
    }

    const repoName = this.options.repoName ?? 'unknown'
    const repoInfo = this.options.repoInfo ?? ''
    const classesCode = codeBlocks.join('\n\n')

    const { system, user } = buildBatchClassPrompt(repoName, repoInfo, classesCode)

    try {
      const llmResponse = await this.llmClient!.complete(user, system)
      const parsed = this.parseBatchResponse(llmResponse.content)

      for (const { classEntity, methodEntities } of classGroups) {
        const classData = parsed[classEntity.name]
        if (classData === undefined || classData === null) {
          continue
        }

        if (Array.isArray(classData)) {
          // Data-only class: array of feature strings
          const stringFeatures = classData.filter((f): f is string => typeof f === 'string')
          const feature = this.featureListToSemanticFeature(stringFeatures, classEntity.name, classEntity.filePath)
          result.set(classEntity.name, feature)
        }
        else if (typeof classData === 'object') {
          // Class with methods: object mapping methodName -> feature strings
          const methodDataMap = classData as Record<string, unknown>
          const methodMap = new Map<string, SemanticFeature>()
          const classFeatureStrings: string[] = []

          for (const [methodName, methodFeatures] of Object.entries(methodDataMap)) {
            if (Array.isArray(methodFeatures)) {
              const stringFeatures = methodFeatures.filter((f): f is string => typeof f === 'string')
              const methodEntity = methodEntities.find(m => m.name === methodName)
              const methodFeature = this.featureListToSemanticFeature(
                stringFeatures,
                methodName,
                methodEntity?.filePath ?? classEntity.filePath,
              )
              methodMap.set(methodName, methodFeature)
              if (classFeatureStrings.length === 0 && stringFeatures.length > 0) {
                classFeatureStrings.push(...stringFeatures)
              }
            }
          }

          // Create a class-level feature synthesized from the method data
          const classFeature = this.featureListToSemanticFeature(
            classFeatureStrings,
            classEntity.name,
            classEntity.filePath,
          )
          methodMap.set('__class__', classFeature)

          result.set(classEntity.name, methodMap)
        }
      }
    }
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.warn(`Class batch LLM call failed: ${msg}`)
    }

    return result
  }

  /**
   * Process standalone functions using token-aware batching and parallel LLM calls
   */
  private async processFunctionBatches(
    functionEntities: EntityInput[],
    allInputs: EntityInput[],
    resultMap: Map<number, SemanticFeature>,
  ): Promise<void> {
    const batches = this.createTokenAwareBatches(functionEntities)
    const maxConcurrent = this.options.maxConcurrentBatches ?? 4
    const maxIterations = this.options.maxParseIterations ?? 3

    log.debug(`Processing ${functionEntities.length} functions in ${batches.length} batches (concurrency: ${maxConcurrent})`)

    const tasks = batches.map(batch => async () => {
      let pendingFunctions = batch
      let iteration = 0

      while (pendingFunctions.length > 0 && iteration < maxIterations) {
        iteration++
        try {
          const batchResult = await this.extractFunctionBatch(pendingFunctions)
          const stillMissing: EntityInput[] = []

          for (const funcEntity of pendingFunctions) {
            const feature = batchResult.get(funcEntity.name)
            if (feature) {
              const idx = allInputs.indexOf(funcEntity)
              if (idx !== -1) {
                resultMap.set(idx, feature)
              }
            }
            else if (iteration < maxIterations) {
              stillMissing.push(funcEntity)
            }
          }

          pendingFunctions = stillMissing
        }
        catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          log.warn(`Function batch iteration ${iteration}/${maxIterations} failed: ${msg}`)
          break
        }
      }
    })

    await runConcurrent(tasks, maxConcurrent)
  }

  /**
   * Extract features for a batch of standalone functions using LLM.
   * Returns a map: functionName -> SemanticFeature
   */
  private async extractFunctionBatch(
    functionEntities: EntityInput[],
  ): Promise<Map<string, SemanticFeature>> {
    const result = new Map<string, SemanticFeature>()

    const codeBlocks = functionEntities
      .filter(e => e.sourceCode)
      .map(e => e.sourceCode!)

    if (codeBlocks.length === 0) {
      return result
    }

    const repoName = this.options.repoName ?? 'unknown'
    const repoInfo = this.options.repoInfo ?? ''
    const functionsCode = codeBlocks.join('\n\n')

    const { system, user } = buildBatchFunctionPrompt(repoName, repoInfo, functionsCode)

    try {
      const llmResponse = await this.llmClient!.complete(user, system)
      const parsed = this.parseBatchResponse(llmResponse.content)

      for (const funcEntity of functionEntities) {
        const funcData = parsed[funcEntity.name]
        if (Array.isArray(funcData)) {
          const stringFeatures = funcData.filter((f): f is string => typeof f === 'string')
          const feature = this.featureListToSemanticFeature(stringFeatures, funcEntity.name, funcEntity.filePath)
          result.set(funcEntity.name, feature)
        }
      }
    }
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.warn(`Function batch LLM call failed: ${msg}`)
    }

    return result
  }

  /**
   * Parse batch LLM response - extracts JSON from <solution> tags or raw text
   */
  private parseBatchResponse(text: string): Record<string, unknown> {
    // Try to extract from <solution> block first
    const solutionMatch = text.match(/<solution>\s*([\s\S]*?)\s*<\/solution>/)
    if (solutionMatch) {
      try {
        return JSON.parse(solutionMatch[1]!) as Record<string, unknown>
      }
      catch {
        // Fall through to raw JSON extraction
      }
    }

    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>
      }
      catch {
        // Fall through
      }
    }

    log.warn('Could not parse batch response as JSON')
    return {}
  }

  /**
   * Convert a list of feature strings to a SemanticFeature
   */
  private featureListToSemanticFeature(
    features: string[],
    entityName: string,
    filePath: string,
  ): SemanticFeature {
    if (features.length === 0) {
      return this.extractWithHeuristic({ type: 'function', name: entityName, filePath })
    }

    const primaryDescription = features[0]!
    const subFeatures = features.slice(1).filter(f => f.length > 0)

    const validated = this.validateFeatureName(primaryDescription)
    const validatedSubFeatures = [
      ...(validated.subFeatures ?? []),
      ...subFeatures.map(sf => this.validateFeatureName(sf).description),
    ]

    const keywords = this.extractKeywords({ type: 'function', name: entityName, filePath })

    return {
      description: validated.description,
      subFeatures: validatedSubFeatures.length > 0 ? validatedSubFeatures : undefined,
      keywords,
    }
  }

  /**
   * Create token-aware batches from entities.
   *
   * Groups entities greedily until maxBatchTokens is reached.
   * If a single entity exceeds maxBatchTokens, it gets its own batch.
   * If the last batch has fewer tokens than minBatchTokens, it's merged with the previous batch.
   *
   * @param inputs - Array of entities to batch
   * @returns Array of batches, where each batch is an array of entities
   */
  private createTokenAwareBatches(inputs: EntityInput[]): EntityInput[][] {
    if (inputs.length === 0) {
      return []
    }

    const batches: EntityInput[][] = []
    const batchTokenCounts: number[] = []
    let currentBatch: EntityInput[] = []
    let currentTokens = 0

    const maxBatchTokens = this.options.maxBatchTokens ?? 50000
    const minBatchTokens = this.options.minBatchTokens ?? 10000

    for (const entity of inputs) {
      const entityTokens = estimateEntityTokens(entity)

      if (entityTokens > maxBatchTokens) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch)
          batchTokenCounts.push(currentTokens)
          currentBatch = []
          currentTokens = 0
        }
        batches.push([entity])
        batchTokenCounts.push(entityTokens)
        continue
      }

      if (currentBatch.length > 0 && currentTokens + entityTokens > maxBatchTokens) {
        batches.push(currentBatch)
        batchTokenCounts.push(currentTokens)
        currentBatch = [entity]
        currentTokens = entityTokens
      }
      else {
        currentBatch.push(entity)
        currentTokens += entityTokens
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch)
      batchTokenCounts.push(currentTokens)
    }

    if (batches.length > 1) {
      const lastBatchTokens = batchTokenCounts[batchTokenCounts.length - 1]!
      const prevBatchTokens = batchTokenCounts[batchTokenCounts.length - 2]!

      if (lastBatchTokens < minBatchTokens && prevBatchTokens + lastBatchTokens <= maxBatchTokens) {
        const lastBatch = batches[batches.length - 1]!
        const previousBatch = batches[batches.length - 2]!
        previousBatch.push(...lastBatch)
        batchTokenCounts[batchTokenCounts.length - 2]! += lastBatchTokens
        batches.pop()
        batchTokenCounts.pop()
      }
    }

    return batches
  }

  /**
   * Create token-aware batches from class groups.
   * Each group's token estimate is the sum of the class + all its methods.
   */
  private createClassGroupBatches(classGroups: ClassGroup[]): ClassGroup[][] {
    if (classGroups.length === 0) {
      return []
    }

    const batches: ClassGroup[][] = []
    const batchTokenCounts: number[] = []
    let currentBatch: ClassGroup[] = []
    let currentTokens = 0

    const maxBatchTokens = this.options.maxBatchTokens ?? 50000
    const minBatchTokens = this.options.minBatchTokens ?? 10000

    for (const group of classGroups) {
      const groupTokens = estimateEntityTokens(group.classEntity)
        + group.methodEntities.reduce((sum, m) => sum + estimateEntityTokens(m), 0)

      if (groupTokens > maxBatchTokens) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch)
          batchTokenCounts.push(currentTokens)
          currentBatch = []
          currentTokens = 0
        }
        batches.push([group])
        batchTokenCounts.push(groupTokens)
        continue
      }

      if (currentBatch.length > 0 && currentTokens + groupTokens > maxBatchTokens) {
        batches.push(currentBatch)
        batchTokenCounts.push(currentTokens)
        currentBatch = [group]
        currentTokens = groupTokens
      }
      else {
        currentBatch.push(group)
        currentTokens += groupTokens
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch)
      batchTokenCounts.push(currentTokens)
    }

    if (batches.length > 1) {
      const lastBatchTokens = batchTokenCounts[batchTokenCounts.length - 1]!
      const prevBatchTokens = batchTokenCounts[batchTokenCounts.length - 2]!

      if (lastBatchTokens < minBatchTokens && prevBatchTokens + lastBatchTokens <= maxBatchTokens) {
        const lastBatch = batches[batches.length - 1]!
        const previousBatch = batches[batches.length - 2]!
        previousBatch.push(...lastBatch)
        batchTokenCounts[batchTokenCounts.length - 2]! += lastBatchTokens
        batches.pop()
        batchTokenCounts.pop()
      }
    }

    return batches
  }

  /**
   * Aggregate child entity features into a file-level summary.
   *
   * Synthesizes function/class-level features into a coherent file-level description.
   * Only considers direct children (functions/classes at file level), not nested methods.
   */
  async aggregateFileFeatures(
    childFeatures: SemanticFeature[],
    fileName: string,
    filePath: string,
  ): Promise<SemanticFeature> {
    if (childFeatures.length === 0) {
      const humanName = this.humanizeName(fileName)
      return {
        description: `define ${humanName} module`,
        keywords: [fileName.toLowerCase()],
      }
    }

    if (this.llmClient) {
      try {
        return await this.aggregateWithLLM(childFeatures, fileName, filePath)
      }
      catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        const warning = `[SemanticExtractor] LLM aggregation failed for ${fileName}: ${msg}. Falling back to heuristic.`
        this.warnings.push(warning)
        console.warn(warning)
      }
    }

    return this.aggregateWithHeuristic(childFeatures, fileName)
  }

  /**
   * Aggregate file features using LLM
   */
  private async aggregateWithLLM(
    childFeatures: SemanticFeature[],
    fileName: string,
    filePath: string,
  ): Promise<SemanticFeature> {
    const featureList = childFeatures
      .map((f) => {
        const subFeatureSuffix = f.subFeatures?.length ? ` (also: ${f.subFeatures.join(', ')})` : ''
        return `- ${f.description}${subFeatureSuffix}`
      })
      .join('\n')

    const prompt = `Synthesize a file-level semantic summary for "${fileName}" (${filePath}).

The file contains the following entities and their features:
${featureList}

Provide a single cohesive description that captures what this file does as a whole.
Use verb + object format. Keep it concise (3-8 words).

Respond with valid JSON:
{
  "description": "file-level summary in verb + object format",
  "keywords": ["relevant", "keywords"]
}`

    const systemPrompt = `You are a senior software analyst. Synthesize file-level summaries from child entity features.
Follow the same naming rules: verb + object format, lowercase, no implementation details, 3-8 words.`

    const response = await this.llmClient?.completeJSON<SemanticFeature>(prompt, systemPrompt, SemanticFeatureSchema)
    if (!response) {
      return this.aggregateWithHeuristic(childFeatures, fileName)
    }

    const validated = this.validateFeatureName(response.description)
    return {
      description: validated.description,
      subFeatures: validated.subFeatures,
      keywords: response.keywords ?? this.mergeKeywords(childFeatures, fileName),
    }
  }

  /**
   * Aggregate file features using heuristics
   */
  private aggregateWithHeuristic(
    childFeatures: SemanticFeature[],
    fileName: string,
  ): SemanticFeature {
    const descriptions = childFeatures.map(f => f.description)

    const verbs = descriptions
      .map(d => d.split(/\s+/)[0])
      .filter((v): v is string => v !== undefined)

    const verbCounts = new Map<string, number>()
    for (const verb of verbs) {
      verbCounts.set(verb, (verbCounts.get(verb) ?? 0) + 1)
    }

    const primaryVerb = [...verbCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'provide'

    const humanName = this.humanizeName(fileName)
    const description = `${primaryVerb} ${humanName} functionality`

    const keywords = this.mergeKeywords(childFeatures, fileName)

    return {
      description,
      subFeatures: descriptions.length > 1 ? descriptions : undefined,
      keywords,
    }
  }

  /**
   * Merge and deduplicate keywords from child features
   */
  private mergeKeywords(childFeatures: SemanticFeature[], fileName: string): string[] {
    const keywordSet = new Set<string>()
    keywordSet.add(fileName.toLowerCase())

    for (const feature of childFeatures) {
      for (const kw of feature.keywords) {
        keywordSet.add(kw.toLowerCase())
      }
    }

    return [...keywordSet]
  }

  /**
   * Extract semantic features using LLM
   */
  private async extractWithLLM(input: EntityInput): Promise<SemanticFeature> {
    const prompt = this.buildPrompt(input)
    const systemPrompt = `You are a senior software analyst. Your task is to extract high-level semantic features from a code entity.

## Key Goals
- Focus on the purpose and high-level behavior of the entity - what it represents or manages in the system.
- Summarize what the entity is responsible for at a high level, avoiding any implementation details.

## Feature Extraction Principles
1. Focus on the purpose and behavior of the entity - what it represents or manages.
2. Do NOT describe implementation details, variable names, or internal logic such as loops, conditionals, or data structures.
3. If an entity performs multiple responsibilities, break them down into separate features.
4. Use the entity name, its code, and the surrounding context to infer meaning.
5. Do not fabricate or invent behaviors not present in the code.
6. Do not skip any defined behavior, including initialization, cleanup, and lifecycle methods.

## Feature Naming Rules
1. Use the "verb + object" format - e.g., "load config", "validate token"
2. Use lowercase English only.
3. Describe purpose, not implementation - focus on what the code does, not how.
4. Each feature should express one single responsibility.
5. If an entity performs multiple responsibilities, create multiple short features, each describing only one responsibility.
6. Keep each feature short and atomic: prefer 3-8 words, no full sentences, no punctuation inside a feature.
7. Avoid vague verbs: avoid "handle", "process", "deal with". Prefer "load", "validate", "convert", "update", "serialize", "compute", "check", "transform".
8. Avoid implementation details: do not mention loops, conditionals, specific data structures, or control flow.
9. Avoid mentioning specific libraries, frameworks, or formats. Say "serialize data" not "convert to JSON".
10. Prefer domain or system semantic words over low-level technical actions: "manage session" not "update dict".
11. Avoid chaining multiple actions: instead of "initialize config and register globally", use separate features.

Always respond with valid JSON:
{
  "description": "primary verb + object feature",
  "subFeatures": ["additional atomic feature 1", "additional atomic feature 2"],
  "keywords": ["relevant", "search", "keywords"]
}

If the entity has only one responsibility, leave subFeatures as an empty array.`

    const response = await this.llmClient?.completeJSON<SemanticFeature>(prompt, systemPrompt, SemanticFeatureSchema)
    if (!response) {
      return this.extractWithHeuristic(input)
    }
    return this.validateFeature(response, input)
  }

  /**
   * Build prompt for LLM extraction
   */
  private buildPrompt(input: EntityInput): string {
    let prompt = `Analyze this ${input.type} and extract its semantic features.\n\n`

    if (input.parent) {
      prompt += `Parent class: ${input.parent}\n`
    }

    prompt += `Name: ${input.name}\n`
    prompt += `File: ${input.filePath}\n`

    if (input.documentation) {
      prompt += `\nDocumentation:\n${input.documentation}\n`
    }

    if (input.sourceCode) {
      const maxSourceLength = 2000
      const truncatedSource
        = input.sourceCode.length > maxSourceLength
          ? `${input.sourceCode.substring(0, maxSourceLength)}\n... (truncated)`
          : input.sourceCode

      prompt += `\nSource code:\n\`\`\`\n${truncatedSource}\n\`\`\`\n`
    }

    prompt += `\nProvide semantic features for this ${input.type}.`

    return prompt
  }

  /**
   * Extract semantic features using heuristics (no LLM)
   */
  private extractWithHeuristic(input: EntityInput): SemanticFeature {
    const description = this.generateDescription(input)
    const keywords = this.extractKeywords(input)

    const validated = this.validateFeatureName(description)
    return {
      description: validated.description,
      subFeatures: validated.subFeatures,
      keywords,
    }
  }

  /**
   * Generate description from entity name and type
   */
  private generateDescription(input: EntityInput): string {
    const name = this.humanizeName(input.name)

    switch (input.type) {
      case 'function':
        return this.generateFunctionDescription(name, input)
      case 'class':
        return `define ${name}`
      case 'method':
        return this.generateFunctionDescription(name, input)
      case 'file':
        return this.generateFileDescription(input.filePath)
      default:
        return name
    }
  }

  /**
   * Generate function description based on common patterns
   */
  private generateFunctionDescription(name: string, _input: EntityInput): string {
    const lowerName = name.toLowerCase()

    const verbPatterns: Array<[string, string]> = [
      ['get', 'retrieve'],
      ['set', 'set'],
      ['is', 'check if'],
      ['has', 'check if has'],
      ['can', 'check if can'],
      ['should', 'determine if should'],
      ['validate', 'validate'],
      ['parse', 'parse'],
      ['format', 'format'],
      ['create', 'create'],
      ['build', 'build'],
      ['make', 'create'],
      ['init', 'initialize'],
      ['setup', 'set up'],
      ['load', 'load'],
      ['save', 'save'],
      ['fetch', 'fetch'],
      ['send', 'send'],
      ['handle', 'dispatch'],
      ['process', 'transform'],
      ['transform', 'transform'],
      ['convert', 'convert'],
      ['extract', 'extract'],
      ['find', 'find'],
      ['search', 'search'],
      ['filter', 'filter'],
      ['sort', 'sort'],
      ['update', 'update'],
      ['delete', 'delete'],
      ['remove', 'remove'],
      ['add', 'add'],
      ['insert', 'insert'],
      ['render', 'render'],
      ['display', 'display'],
      ['show', 'show'],
      ['hide', 'hide'],
      ['toggle', 'toggle'],
      ['enable', 'enable'],
      ['disable', 'disable'],
      ['start', 'start'],
      ['stop', 'stop'],
      ['run', 'execute'],
      ['execute', 'execute'],
      ['on', 'dispatch'],
    ]

    for (const [prefix, verb] of verbPatterns) {
      if (lowerName.startsWith(prefix)) {
        const rest = name.substring(prefix.length).trim()
        if (rest) {
          return `${verb} ${rest.toLowerCase()}`
        }
      }
    }

    return `provide ${name} operation`
  }

  /**
   * Generate file description from path
   */
  private generateFileDescription(filePath: string): string {
    const parts = filePath.split('/')
    const fileName = (parts[parts.length - 1] ?? '').replace(/\.[^.]+$/, '')
    const dirName = parts.length > 1 ? (parts[parts.length - 2] ?? '') : ''

    const humanName = this.humanizeName(fileName)

    if (dirName && dirName !== '.') {
      return `define ${humanName} for ${dirName}`
    }
    return `define ${humanName} module`
  }

  /**
   * Convert camelCase/PascalCase/snake_case to human-readable
   */
  private humanizeName(name: string): string {
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .trim()
  }

  /**
   * Extract keywords from entity
   */
  private extractKeywords(input: EntityInput): string[] {
    const keywords = new Set<string>()

    const nameParts = input.name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 2)

    for (const part of nameParts) {
      keywords.add(part)
    }

    keywords.add(input.type)

    if (input.parent) {
      keywords.add(input.parent.toLowerCase())
    }

    const pathParts = input.filePath
      .split('/')
      .filter(p => p && p !== '.' && p !== '..')
      .map(p => p.replace(/\.[^.]+$/, '').toLowerCase())

    for (const part of pathParts) {
      if (part.length > 2) {
        keywords.add(part)
      }
    }

    return [...keywords]
  }

  /**
   * Vague verbs that should be replaced with more specific alternatives
   */
  private static readonly VAGUE_VERBS = new Set([
    'handle',
    'process',
    'deal with',
    'do',
    'manage',
    'run',
    'perform',
  ])

  /**
   * Preferred replacements for vague verbs (used as suggestions)
   */
  private static readonly VAGUE_VERB_REPLACEMENTS: Record<string, string> = {
    'handle': 'dispatch',
    'process': 'transform',
    'deal with': 'resolve',
    'do': 'execute',
    'manage': 'coordinate',
    'run': 'execute',
    'perform': 'execute',
  }

  /**
   * Implementation detail keywords to strip from feature names
   */
  private static readonly IMPLEMENTATION_KEYWORDS = new Set([
    'loop',
    'iterate',
    'if',
    'else',
    'array',
    'dict',
    'hash',
    'stack',
    'queue',
    'for',
    'while',
    'switch',
    'case',
    'try',
    'catch',
    'throw',
    'return',
    'break',
    'continue',
  ])

  /**
   * Non-action words that indicate a fragment is not a verb phrase
   */
  private static readonly NON_ACTION_PREFIXES = new Set([
    'a',
    'an',
    'the',
    'their',
    'its',
    'his',
    'her',
    'our',
    'your',
    'this',
    'that',
    'these',
    'those',
    'some',
    'all',
    'each',
    'every',
  ])

  /**
   * Check if text looks like an action (verb phrase) rather than a noun fragment
   */
  private looksLikeAction(text: string): boolean {
    const firstWord = text.split(/\s+/)[0]
    if (!firstWord)
      return false
    return !SemanticExtractor.NON_ACTION_PREFIXES.has(firstWord)
  }

  /**
   * Replace a vague leading verb with a more specific alternative
   */
  private replaceVagueVerb(text: string): string {
    const words = text.split(/\s+/)
    if (words.length > 0 && SemanticExtractor.VAGUE_VERBS.has(words[0]!)) {
      const replacement = SemanticExtractor.VAGUE_VERB_REPLACEMENTS[words[0]!]
      if (replacement) {
        words[0] = replacement
        return words.join(' ')
      }
    }
    return text
  }

  /**
   * Validate and normalize a feature name according to paper's naming rules.
   *
   * Rules enforced:
   * 1. Lowercase only
   * 2. Word count: 3-8 words (truncate if >8)
   * 3. Vague verb detection/replacement
   * 4. Implementation detail removal
   * 5. No trailing punctuation
   * 6. Single responsibility check ("and" splits into subFeatures)
   */
  validateFeatureName(description: string): { description: string, subFeatures?: string[] } {
    let desc = description.toLowerCase().trim()

    // Rule 5: Remove trailing punctuation
    desc = desc.replace(/[.,;:!?]+$/, '').trim()

    // Rule 4: Strip implementation detail keywords
    const words = desc.split(/\s+/)
    const filteredWords = words.filter(w => !SemanticExtractor.IMPLEMENTATION_KEYWORDS.has(w))
    desc = filteredWords.join(' ')

    // Rule 6: Single responsibility check - split on all "and" connecting actions
    let subFeatures: string[] | undefined
    const andParts = desc.split(' and ')
    if (andParts.length > 1) {
      const first = andParts[0]!.trim()
      const rest = andParts
        .slice(1)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .filter(p => this.looksLikeAction(p))
      if (first.split(/\s+/).length >= 2 && rest.length > 0) {
        desc = first
        subFeatures = rest
      }
    }

    // Rule 3: Replace vague verbs (apply to both primary description and subFeatures)
    desc = this.replaceVagueVerb(desc)
    if (subFeatures) {
      subFeatures = subFeatures.map(sf => this.replaceVagueVerb(sf))
    }

    // Rule 2: Word count check (3-8 words; truncate if >8, keep as-is if <3)
    const finalWords = desc.split(/\s+/).filter(w => w.length > 0)
    if (finalWords.length > 8) {
      desc = finalWords.slice(0, 8).join(' ')
    }
    else {
      desc = finalWords.join(' ')
    }

    return subFeatures ? { description: desc, subFeatures } : { description: desc }
  }

  /**
   * Validate and normalize LLM response
   */
  private validateFeature(feature: SemanticFeature, input: EntityInput): SemanticFeature {
    if (!feature.description || typeof feature.description !== 'string') {
      feature.description = this.generateDescription(input)
    }

    const validated = this.validateFeatureName(feature.description)
    feature.description = validated.description
    if (validated.subFeatures) {
      feature.subFeatures = [...(feature.subFeatures ?? []), ...validated.subFeatures]
    }

    if (!Array.isArray(feature.keywords)) {
      feature.keywords = this.extractKeywords(input)
    }

    feature.keywords = feature.keywords
      .filter(k => typeof k === 'string' && k.length > 0)
      .map(k => k.toLowerCase().trim())

    return feature
  }
}
