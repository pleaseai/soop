import { type RPGConfig, RepositoryPlanningGraph } from '../graph'
import path from 'node:path'
import fs from 'node:fs'
import { readdir, stat } from 'node:fs/promises'

/**
 * Options for encoding a repository
 */
export interface EncoderOptions {
  /** Repository path */
  repoPath: string
  /** Include source code in nodes */
  includeSource?: boolean
  /** File patterns to include */
  include?: string[]
  /** File patterns to exclude */
  exclude?: string[]
  /** Maximum depth for directory traversal */
  maxDepth?: number
}

/**
 * Result of encoding a repository
 */
export interface EncodingResult {
  /** The generated RPG */
  rpg: RepositoryPlanningGraph
  /** Number of files processed */
  filesProcessed: number
  /** Number of functions/classes extracted */
  entitiesExtracted: number
  /** Time taken in milliseconds */
  duration: number
}

/**
 * RPG Encoder - Extracts RPG from existing codebases
 *
 * Implements three phases:
 * 1. Semantic Lifting: Extract semantic features from code
 * 2. Structural Reorganization: Build functional hierarchy
 * 3. Artifact Grounding: Connect to physical code entities
 */
export class RPGEncoder {
  private repoPath: string
  private options: EncoderOptions

  constructor(repoPath: string, options?: Partial<Omit<EncoderOptions, 'repoPath'>>) {
    this.repoPath = repoPath
    this.options = {
      repoPath,
      includeSource: false,
      include: ['**/*.ts', '**/*.js', '**/*.py'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      maxDepth: 10,
      ...options,
    }
  }

  /**
   * Encode the repository into an RPG
   */
  async encode(): Promise<EncodingResult> {
    const startTime = Date.now()

    // Extract repository name from path
    const repoName = this.repoPath.split('/').pop() ?? 'unknown'

    const config: RPGConfig = {
      name: repoName,
      rootPath: this.repoPath,
    }

    const rpg = new RepositoryPlanningGraph(config)

    // Phase 1: Semantic Lifting
    const files = await this.discoverFiles()
    let entitiesExtracted = 0

    for (const file of files) {
      const entities = await this.extractEntities(file)
      entitiesExtracted += entities.length

      for (const entity of entities) {
        rpg.addLowLevelNode({
          id: entity.id,
          feature: entity.feature,
          metadata: entity.metadata,
          sourceCode: this.options.includeSource ? entity.sourceCode : undefined,
        })
      }
    }

    // Phase 2: Structural Reorganization
    await this.buildFunctionalHierarchy(rpg)

    // Phase 3: Artifact Grounding
    await this.injectDependencies(rpg)

    return {
      rpg,
      filesProcessed: files.length,
      entitiesExtracted,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Discover files to process
   */
  private async discoverFiles(): Promise<string[]> {
    // Check if repository exists
    if (!fs.existsSync(this.repoPath)) {
      return []
    }

    const files: string[] = []
    const includePatterns = this.options.include ?? ['**/*.ts', '**/*.js', '**/*.py']
    const excludePatterns = this.options.exclude ?? [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
    ]

    // Recursively walk directory
    await this.walkDirectory(this.repoPath, files, includePatterns, excludePatterns, 0)

    return files.sort()
  }

  /**
   * Recursively walk directory and collect matching files
   */
  private async walkDirectory(
    dir: string,
    files: string[],
    includePatterns: string[],
    excludePatterns: string[],
    depth: number
  ): Promise<void> {
    const maxDepth = this.options.maxDepth ?? 10
    if (depth > maxDepth) return

    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      const relativePath = path.relative(this.repoPath, fullPath)

      // Check if excluded
      if (this.matchesPattern(relativePath, excludePatterns)) {
        continue
      }

      let stats: fs.Stats
      try {
        stats = await stat(fullPath)
      } catch {
        continue
      }

      if (stats.isDirectory()) {
        await this.walkDirectory(fullPath, files, includePatterns, excludePatterns, depth + 1)
      } else if (stats.isFile()) {
        if (this.matchesPattern(relativePath, includePatterns)) {
          files.push(fullPath)
        }
      }
    }
  }

  /**
   * Check if path matches any of the glob patterns
   */
  private matchesPattern(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => this.globMatch(filePath, pattern))
  }

  /**
   * Simple glob matching (supports * and **)
   */
  private globMatch(filePath: string, pattern: string): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/')
    const normalizedPattern = pattern.replace(/\\/g, '/')

    // Split into segments for better matching
    const pathSegments = normalizedPath.split('/')
    const patternSegments = normalizedPattern.split('/')

    return this.matchSegments(pathSegments, patternSegments, 0, 0)
  }

  /**
   * Match path segments against pattern segments
   */
  private matchSegments(
    pathSegs: string[],
    patternSegs: string[],
    pathIdx: number,
    patternIdx: number
  ): boolean {
    // Both exhausted - match
    if (pathIdx === pathSegs.length && patternIdx === patternSegs.length) {
      return true
    }

    // Pattern exhausted but path remaining - no match
    if (patternIdx === patternSegs.length) {
      return false
    }

    const patternSeg = patternSegs[patternIdx]

    // Handle ** (globstar)
    if (patternSeg === '**') {
      // Try matching zero or more directories
      for (let i = pathIdx; i <= pathSegs.length; i++) {
        if (this.matchSegments(pathSegs, patternSegs, i, patternIdx + 1)) {
          return true
        }
      }
      return false
    }

    // Path exhausted but pattern remaining (and not **)
    if (pathIdx === pathSegs.length) {
      return false
    }

    // Match single segment
    if (this.matchSegment(pathSegs[pathIdx], patternSeg)) {
      return this.matchSegments(pathSegs, patternSegs, pathIdx + 1, patternIdx + 1)
    }

    return false
  }

  /**
   * Match single path segment against pattern segment
   */
  private matchSegment(pathSeg: string, patternSeg: string): boolean {
    // Convert pattern to regex
    const regexPattern = patternSeg
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*/g, '.*') // * matches anything
      .replace(/\?/g, '.') // ? matches single char

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(pathSeg)
  }

  /**
   * Extract entities (functions, classes) from a file
   */
  private async extractEntities(_file: string): Promise<
    Array<{
      id: string
      feature: { description: string; keywords?: string[] }
      metadata: { entityType: 'file' | 'class' | 'function'; path: string }
      sourceCode?: string
    }>
  > {
    // TODO: Implement AST parsing and semantic extraction
    return []
  }

  /**
   * Build functional hierarchy from extracted entities
   */
  private async buildFunctionalHierarchy(_rpg: RepositoryPlanningGraph): Promise<void> {
    // TODO: Implement LLM-based functional grouping
  }

  /**
   * Inject dependency edges via AST analysis
   */
  private async injectDependencies(_rpg: RepositoryPlanningGraph): Promise<void> {
    // TODO: Implement AST-based dependency extraction
  }

  /**
   * Incrementally update RPG with new commits
   */
  async evolve(options: { commitRange: string }): Promise<void> {
    // TODO: Implement incremental updates
    console.log(`Evolving with commits: ${options.commitRange}`)
  }
}
