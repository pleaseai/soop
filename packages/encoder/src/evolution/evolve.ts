import type { RepositoryPlanningGraph } from '@pleaseai/rpg-graph/rpg'
import type { OperationContext } from './operations'
import type { DiffResult, EvolutionOptions, EvolutionResult } from './types'
import { ASTParser } from '@pleaseai/rpg-utils/ast'
import { LLMClient } from '@pleaseai/rpg-utils/llm'
import type { LLMProvider } from '@pleaseai/rpg-utils/llm'
import { createLogger } from '@pleaseai/rpg-utils/logger'
import { injectDependencies } from '../dependency-injection'
import { SemanticExtractor } from '../semantic'
import { DiffParser } from './diff-parser'
import { deleteNode, insertNode, processModification } from './operations'
import { SemanticRouter } from './semantic-router'
import { DEFAULT_DRIFT_THRESHOLD } from './types'

const log = createLogger('RPGEvolver')

const DEFAULT_FORCE_REGENERATE_THRESHOLD = 0.5

export class RPGEvolver {
  private readonly rpg: RepositoryPlanningGraph
  private readonly options: EvolutionOptions
  private readonly diffParser: DiffParser
  private readonly semanticExtractor: SemanticExtractor
  private readonly semanticRouter: SemanticRouter
  private readonly astParser: ASTParser

  constructor(rpg: RepositoryPlanningGraph, options: EvolutionOptions) {
    this.rpg = rpg
    this.options = options
    this.astParser = new ASTParser()
    this.diffParser = new DiffParser(options.repoPath, this.astParser)
    this.semanticExtractor = new SemanticExtractor(options.semantic)
    const llmClient = this.createLLMClient()
    this.semanticRouter = new SemanticRouter(rpg, { llmClient })
  }

  async evolve(): Promise<EvolutionResult> {
    const startTime = Date.now()
    const result: EvolutionResult = {
      inserted: 0,
      deleted: 0,
      modified: 0,
      rerouted: 0,
      prunedNodes: 0,
      duration: 0,
      llmCalls: 0,
      errors: [],
    }

    const diffResult = await this.diffParser.parse(this.options.commitRange)

    // Area 9: Judge Regenerate
    const allNodes = await this.rpg.getLowLevelNodes()
    const nodeCount = allNodes.length

    if (this.judgeRegenerate(diffResult, nodeCount)) {
      result.requiresFullEncode = true
      result.duration = Date.now() - startTime
      return result
    }

    const ctx: OperationContext = {
      semanticExtractor: this.semanticExtractor,
      semanticRouter: this.semanticRouter,
      astParser: this.astParser,
      repoPath: this.options.repoPath,
      includeSource: this.options.includeSource,
    }

    const driftThreshold = this.options.driftThreshold ?? DEFAULT_DRIFT_THRESHOLD

    const errors: Array<{ entity: string, phase: string, error: string }> = []

    const embeddingChanges = {
      added: [] as string[],
      removed: [] as string[],
      modified: [] as string[],
    }

    // Process deletions
    for (const entity of diffResult.deletions) {
      try {
        const pruned = await deleteNode(this.rpg, entity.id)
        result.deleted++
        result.prunedNodes += pruned
        embeddingChanges.removed.push(entity.id)
      }
      catch (error) {
        errors.push({
          entity: entity.id,
          phase: 'deletion',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Process modifications
    for (const mod of diffResult.modifications) {
      try {
        const modResult = await processModification(this.rpg, mod.old, mod.new, ctx, driftThreshold)
        if (modResult.rerouted) {
          result.rerouted++
          embeddingChanges.removed.push(mod.old.id)
          embeddingChanges.added.push(mod.new.id)
        }
        else {
          result.modified++
          embeddingChanges.modified.push(mod.new.id)
        }
        result.prunedNodes += modResult.prunedNodes
      }
      catch (error) {
        errors.push({
          entity: mod.old.id,
          phase: 'modification',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Process insertions
    for (const entity of diffResult.insertions) {
      try {
        await insertNode(this.rpg, entity, ctx)
        result.inserted++
        embeddingChanges.added.push(entity.id)
      }
      catch (error) {
        errors.push({
          entity: entity.id,
          phase: 'insertion',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Area 10: Post-Evolution Dependency Graph Rebuild
    log.info('Post-evolution: rebuilding dependency graph...')
    try {
      await injectDependencies(this.rpg, this.options.repoPath, this.astParser)
    }
    catch (error) {
      const msg = `Dependency rebuild failed: ${error instanceof Error ? error.message : String(error)}`
      log.warn(msg)
      errors.push({ entity: 'dependency-rebuild', phase: 'post-evolution', error: msg })
    }

    result.llmCalls = this.semanticRouter.getLLMCalls()
    result.errors = errors
    result.embeddingChanges = embeddingChanges
    result.duration = Date.now() - startTime

    return result
  }

  private judgeRegenerate(diffResult: DiffResult, currentNodeCount: number): boolean {
    if (currentNodeCount === 0)
      return false

    const totalChanges
      = diffResult.insertions.length
        + diffResult.deletions.length
        + diffResult.modifications.length

    const changeRatio = totalChanges / currentNodeCount
    const threshold = this.options.forceRegenerateThreshold ?? DEFAULT_FORCE_REGENERATE_THRESHOLD

    return changeRatio > threshold
  }

  private createLLMClient(): LLMClient | undefined {
    const useLLM = this.options.useLLM ?? this.options.semantic?.useLLM ?? true
    if (!useLLM)
      return undefined
    const provider = this.options.semantic?.provider ?? this.detectProvider()
    if (!provider)
      return undefined
    return new LLMClient({
      provider,
      model: this.options.semantic?.model,
      apiKey: this.options.semantic?.apiKey,
      maxTokens: this.options.semantic?.maxTokens,
      claudeCodeSettings: this.options.semantic?.claudeCodeSettings,
      codexSettings: this.options.semantic?.codexSettings,
    })
  }

  private detectProvider(): LLMProvider | null {
    if (process.env.GOOGLE_API_KEY)
      return 'google'
    if (process.env.ANTHROPIC_API_KEY)
      return 'anthropic'
    if (process.env.OPENAI_API_KEY)
      return 'openai'
    return null
  }
}
