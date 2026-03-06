import type { RepositoryPlanningGraph } from '@pleaseai/soop-graph'
import type { CallOptions, LLMClient } from '@pleaseai/soop-utils/llm'
import type { FileFeatureGroup } from './types'
import { createLogger } from '@pleaseai/soop-utils/logger'
import { buildHierarchicalConstructionPrompt } from './prompts'

const log = createLogger('HierarchyBuilder')

/**
 * Hierarchy Builder — construct 2-5 level semantic hierarchy from functional areas.
 *
 * Implements paper §3.2 Step 2: "Hierarchical Aggregation"
 * - Assigns file groups to 2-5 level paths
 * - Creates HighLevelNodes for each path segment
 * - Creates FunctionalEdges for the hierarchy
 * - Links file LowLevelNodes to their leaf HighLevelNodes
 *
 * Uses an iterative refinement loop: after each LLM call, newly assigned groups
 * are removed from the remaining set, and further iterations proceed until all
 * groups are assigned or no progress is made (stuck detection).
 */
export class HierarchyBuilder {
  constructor(
    private readonly rpg: RepositoryPlanningGraph,
    private readonly llmClient: LLMClient,
  ) {}

  async build(
    functionalAreas: string[],
    fileGroups: FileFeatureGroup[],
    options?: {
      repoName?: string
      repoInfo?: string
      maxIterations?: number
      callOptions?: CallOptions
    },
  ): Promise<void> {
    const assignments = await this.getAssignments(
      functionalAreas,
      fileGroups,
      options?.repoName,
      options?.repoInfo,
      options?.maxIterations ?? 10,
      options?.callOptions,
    )

    // Build a map: groupLabel → file node IDs
    const groupToFileIds = new Map<string, string[]>()
    for (const group of fileGroups) {
      groupToFileIds.set(
        group.groupLabel,
        group.fileFeatures.map(f => f.fileId),
      )
    }

    // Track created nodes to avoid duplicates
    const createdNodes = new Set<string>()

    // Process each assignment path
    for (const [pathStr, groupLabels] of Object.entries(assignments)) {
      const segments = pathStr.split('/')
      if (segments.length < 2 || segments.length > 5) {
        continue // Skip invalid paths (should have been validated)
      }

      // Create Level 0: Functional area
      const area = segments[0]!
      const areaId = `domain:${area}`
      if (!createdNodes.has(areaId)) {
        createdNodes.add(areaId)
        await this.rpg.addHighLevelNode({
          id: areaId,
          feature: {
            description: `provide ${this.humanize(area)} functionality`,
            keywords: [area.toLowerCase()],
          },
        })
      }

      // Create intermediate levels dynamically
      let parentId = areaId
      for (let i = 1; i < segments.length; i++) {
        const segmentId = `domain:${segments.slice(0, i + 1).join('/')}`
        if (!createdNodes.has(segmentId)) {
          createdNodes.add(segmentId)
          await this.rpg.addHighLevelNode({
            id: segmentId,
            feature: {
              description: segments[i]!,
              keywords: segments[i]!.split(/\s+/),
            },
          })
          await this.rpg.addFunctionalEdge({ source: parentId, target: segmentId })
        }
        parentId = segmentId
      }

      // Link file LowLevelNodes to the leaf node
      for (const label of groupLabels) {
        const fileIds = groupToFileIds.get(label)
        if (!fileIds)
          continue
        for (const fileId of fileIds) {
          const hasNode = await this.rpg.hasNode(fileId)
          if (hasNode) {
            await this.rpg.addFunctionalEdge({ source: parentId, target: fileId })
          }
        }
      }
    }

    // Handle unassigned files: files not covered by any assignment
    await this.handleUnassignedFiles(fileGroups, assignments, createdNodes)
  }

  private async getAssignments(
    functionalAreas: string[],
    fileGroups: FileFeatureGroup[],
    repoName?: string,
    repoInfo?: string,
    maxIterations = 10,
    callOptions?: CallOptions,
  ): Promise<Record<string, string[]>> {
    const allGroupLabels = new Set(fileGroups.map(g => g.groupLabel))
    const assignedLabels = new Map<string, string>() // groupLabel → path

    let remainingGroups = [...fileGroups]

    for (let iter = 0; iter < maxIterations && remainingGroups.length > 0; iter++) {
      const { system, user } = buildHierarchicalConstructionPrompt(
        functionalAreas,
        remainingGroups,
        repoName,
        repoInfo,
      )

      let responseText: string
      try {
        const response = await this.llmClient.complete(user, system, callOptions)
        responseText = response.content
      }
      catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        log.warn(`LLM assignment call failed (iteration ${iter + 1}/${maxIterations}): ${msg}. Breaking assignment loop.`)
        break
      }

      const rawAssignments = this.parseAssignmentsFromResponse(responseText)

      let assignedThisRound = 0
      for (const [pathStr, groupLabels] of Object.entries(rawAssignments)) {
        const validPath = this.validateAndFuzzyMatchPath(pathStr, functionalAreas)
        if (!validPath)
          continue

        for (const label of groupLabels) {
          if (allGroupLabels.has(label) && !assignedLabels.has(label)) {
            assignedLabels.set(label, validPath)
            assignedThisRound++
          }
        }
      }

      if (assignedThisRound === 0) {
        // Stuck — nothing was assigned this iteration
        break
      }

      // Update remaining groups
      remainingGroups = fileGroups.filter(g => !assignedLabels.has(g.groupLabel))
    }

    // Convert map to Record<path, labels[]>
    const result: Record<string, string[]> = {}
    for (const [label, path] of assignedLabels.entries()) {
      if (!result[path])
        result[path] = []
      result[path].push(label)
    }

    return result
  }

  private parseAssignmentsFromResponse(text: string): Record<string, string[]> {
    // Try <solution> block
    const solutionMatch = text.match(/<solution>\s*([\s\S]*?)\s*<\/solution>/)
    if (solutionMatch) {
      try {
        const parsed = JSON.parse(solutionMatch[1]!.trim())
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          // Handle wrapper key "assignments"
          if (
            parsed.assignments
            && typeof parsed.assignments === 'object'
            && !Array.isArray(parsed.assignments)
          ) {
            return this.validateStringArrayValues(parsed.assignments)
          }
          return this.validateStringArrayValues(parsed)
        }
      }
      catch (error) {
        log.debug(`Failed to parse <solution> block as JSON: ${error instanceof Error ? error.message : String(error)}`)
        // Fall through to raw JSON extraction
      }
    }

    // Try JSON object with "assignments" key
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.assignments && typeof parsed.assignments === 'object') {
          return this.validateStringArrayValues(parsed.assignments)
        }
        // Direct object (no wrapper key)
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return this.validateStringArrayValues(parsed)
        }
      }
      catch (error) {
        log.debug(`Failed to parse raw JSON as assignments: ${error instanceof Error ? error.message : String(error)}`)
        // Fall through
      }
    }

    return {}
  }

  /**
   * Validate that all values in a parsed object are string arrays.
   * Filters out any non-array values to prevent TypeError at call sites.
   */
  private validateStringArrayValues(parsed: Record<string, unknown>): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        result[key] = value.filter((item): item is string => typeof item === 'string')
      }
    }
    return result
  }

  private validateAndFuzzyMatchPath(
    pathStr: string,
    functionalAreas: string[],
  ): string | null {
    const segments = pathStr.split('/')
    if (segments.length < 2 || segments.length > 5)
      return null

    const area = segments[0]
    if (!area)
      return null

    // Validate all segments are non-empty
    for (const segment of segments) {
      if (!segment || segment.trim().length === 0)
        return null
    }

    const restPath = segments.slice(1).join('/')

    // Exact match
    if (functionalAreas.includes(area))
      return pathStr

    // Case-insensitive match
    const lowerArea = area.toLowerCase()
    const exactCI = functionalAreas.find(a => a.toLowerCase() === lowerArea)
    if (exactCI)
      return `${exactCI}/${restPath}`

    // Prefix match
    const prefixMatch = functionalAreas.find(
      a => a.toLowerCase().startsWith(lowerArea) || lowerArea.startsWith(a.toLowerCase()),
    )
    if (prefixMatch)
      return `${prefixMatch}/${restPath}`

    // Substring match (require minimum length to avoid false positives with short strings)
    const subMatch = functionalAreas.find(
      a => (lowerArea.length >= 4 && a.toLowerCase().includes(lowerArea)) || (a.toLowerCase().length >= 4 && lowerArea.includes(a.toLowerCase())),
    )
    if (subMatch)
      return `${subMatch}/${restPath}`

    return null
  }

  private async handleUnassignedFiles(
    fileGroups: FileFeatureGroup[],
    assignments: Record<string, string[]>,
    createdNodes: Set<string>,
  ): Promise<void> {
    // Collect all assigned group labels
    const assignedLabels = new Set<string>()
    for (const labels of Object.values(assignments)) {
      for (const label of labels) {
        assignedLabels.add(label)
      }
    }

    // Find unassigned groups
    const unassigned = fileGroups.filter(g => !assignedLabels.has(g.groupLabel))
    if (unassigned.length === 0)
      return

    // Create Uncategorized functional area
    const areaId = 'domain:Uncategorized'
    if (!createdNodes.has(areaId)) {
      createdNodes.add(areaId)
      await this.rpg.addHighLevelNode({
        id: areaId,
        feature: {
          description: 'provide uncategorized functionality',
          keywords: ['uncategorized'],
        },
      })
    }

    const miscId = 'domain:Uncategorized/miscellaneous'
    if (!createdNodes.has(miscId)) {
      createdNodes.add(miscId)
      await this.rpg.addHighLevelNode({
        id: miscId,
        feature: {
          description: 'miscellaneous',
          keywords: ['misc'],
        },
      })
      await this.rpg.addFunctionalEdge({ source: areaId, target: miscId })
    }

    // Link unassigned file nodes
    for (const group of unassigned) {
      for (const file of group.fileFeatures) {
        const hasNode = await this.rpg.hasNode(file.fileId)
        if (hasNode) {
          await this.rpg.addFunctionalEdge({ source: miscId, target: file.fileId })
        }
      }
    }
  }

  private humanize(pascalCase: string): string {
    return pascalCase.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  }
}
