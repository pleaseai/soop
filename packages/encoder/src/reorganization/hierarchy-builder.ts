import type { RepositoryPlanningGraph } from '@pleaseai/rpg-graph'
import type { LLMClient } from '@pleaseai/rpg-utils/llm'
import type { FileFeatureGroup } from './types'
import { buildHierarchicalConstructionPrompt } from './prompts'

/**
 * Hierarchy Builder — construct 3-level semantic hierarchy from functional areas.
 *
 * Implements paper §3.2 Step 2: "Hierarchical Aggregation"
 * - Assigns file groups to 3-level paths
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
    },
  ): Promise<void> {
    const assignments = await this.getAssignments(
      functionalAreas,
      fileGroups,
      options?.repoName,
      options?.repoInfo,
      options?.maxIterations ?? 10,
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
      if (segments.length !== 3) {
        continue // Skip invalid paths (should have been validated)
      }

      const [area, category, subcategory] = segments as [string, string, string]

      // Create Level 0: Functional area
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

      // Create Level 1: Category
      const categoryId = `domain:${area}/${category}`
      if (!createdNodes.has(categoryId)) {
        createdNodes.add(categoryId)
        await this.rpg.addHighLevelNode({
          id: categoryId,
          feature: {
            description: category,
            keywords: category.split(/\s+/),
          },
        })
        await this.rpg.addFunctionalEdge({ source: areaId, target: categoryId })
      }

      // Create Level 2: Subcategory
      const subcategoryId = `domain:${area}/${category}/${subcategory}`
      if (!createdNodes.has(subcategoryId)) {
        createdNodes.add(subcategoryId)
        await this.rpg.addHighLevelNode({
          id: subcategoryId,
          feature: {
            description: subcategory,
            keywords: subcategory.split(/\s+/),
          },
        })
        await this.rpg.addFunctionalEdge({ source: categoryId, target: subcategoryId })
      }

      // Link file LowLevelNodes to subcategory
      for (const label of groupLabels) {
        const fileIds = groupToFileIds.get(label)
        if (!fileIds)
          continue
        for (const fileId of fileIds) {
          const hasNode = await this.rpg.hasNode(fileId)
          if (hasNode) {
            await this.rpg.addFunctionalEdge({ source: subcategoryId, target: fileId })
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
        const response = await this.llmClient.complete(user, system)
        responseText = response.content
      }
      catch {
        // LLM call failed — break and handle unassigned in handleUnassignedFiles
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
            return parsed.assignments as Record<string, string[]>
          }
          return parsed as Record<string, string[]>
        }
      }
      catch {
        /* fall through */
      }
    }

    // Try JSON object with "assignments" key
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.assignments && typeof parsed.assignments === 'object') {
          return parsed.assignments as Record<string, string[]>
        }
        // Direct object (no wrapper key)
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, string[]>
        }
      }
      catch {
        /* fall through */
      }
    }

    return {}
  }

  private validateAndFuzzyMatchPath(
    pathStr: string,
    functionalAreas: string[],
  ): string | null {
    const segments = pathStr.split('/')
    if (segments.length !== 3)
      return null

    const [area, category, subcategory] = segments
    if (!area || !category || !subcategory)
      return null
    if (category.trim().length === 0 || subcategory.trim().length === 0)
      return null

    // Exact match
    if (functionalAreas.includes(area))
      return pathStr

    // Case-insensitive match
    const lowerArea = area.toLowerCase()
    const exactCI = functionalAreas.find(a => a.toLowerCase() === lowerArea)
    if (exactCI)
      return `${exactCI}/${category}/${subcategory}`

    // Prefix match
    const prefixMatch = functionalAreas.find(
      a => a.toLowerCase().startsWith(lowerArea) || lowerArea.startsWith(a.toLowerCase()),
    )
    if (prefixMatch)
      return `${prefixMatch}/${category}/${subcategory}`

    // Substring match
    const subMatch = functionalAreas.find(
      a => a.toLowerCase().includes(lowerArea) || lowerArea.includes(a.toLowerCase()),
    )
    if (subMatch)
      return `${subMatch}/${category}/${subcategory}`

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

    const categoryId = 'domain:Uncategorized/general purpose'
    if (!createdNodes.has(categoryId)) {
      createdNodes.add(categoryId)
      await this.rpg.addHighLevelNode({
        id: categoryId,
        feature: {
          description: 'general purpose',
          keywords: ['general'],
        },
      })
      await this.rpg.addFunctionalEdge({ source: areaId, target: categoryId })
    }

    const subcategoryId = 'domain:Uncategorized/general purpose/miscellaneous'
    if (!createdNodes.has(subcategoryId)) {
      createdNodes.add(subcategoryId)
      await this.rpg.addHighLevelNode({
        id: subcategoryId,
        feature: {
          description: 'miscellaneous',
          keywords: ['misc'],
        },
      })
      await this.rpg.addFunctionalEdge({ source: categoryId, target: subcategoryId })
    }

    // Link unassigned file nodes
    for (const group of unassigned) {
      for (const file of group.fileFeatures) {
        const hasNode = await this.rpg.hasNode(file.fileId)
        if (hasNode) {
          await this.rpg.addFunctionalEdge({ source: subcategoryId, target: file.fileId })
        }
      }
    }
  }

  private humanize(pascalCase: string): string {
    return pascalCase.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  }
}
