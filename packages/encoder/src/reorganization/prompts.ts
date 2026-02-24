import type { FileFeatureGroup } from './types'
import { z } from 'zod/v4'

export const DomainDiscoveryResponseSchema = z.object({
  functionalAreas: z.array(z.string()),
})
export type DomainDiscoveryResponse = z.infer<typeof DomainDiscoveryResponseSchema>

export const HierarchicalConstructionResponseSchema = z.object({
  assignments: z.record(
    z.string().regex(/^[^/]+\/[^/]+\/[^/]+$/),
    z.array(z.string()),
  ),
})
export type HierarchicalConstructionResponse = z.infer<typeof HierarchicalConstructionResponseSchema>

export function formatFileGroups(fileGroups: FileFeatureGroup[]): string {
  return fileGroups
    .map((group) => {
      const fileList = group.fileFeatures
        .map(f => `  - ${f.filePath}: ${f.description}`)
        .join('\n')
      return `[${group.groupLabel}]\n${fileList}`
    })
    .join('\n\n')
}

export function buildDomainDiscoveryPrompt(
  fileGroups: FileFeatureGroup[],
  repoName?: string,
  repoInfo?: string,
  skeleton?: string,
): {
  system: string
  user: string
} {
  const formattedGroups = formatFileGroups(fileGroups)

  const system = `You are an expert software architect and repository analyst.
Your goal is to identify the high-level functional areas of a software repository by analyzing file-level semantic features.

## Process
1. Read the repository context (name, overview, skeleton) to understand the domain.
2. Read all file-level semantic features grouped by top-level directory.
3. Think carefully about which broad functional domains emerge — think architecturally, not by directory.
4. Draft 1-8 candidate areas, then critique each: do any overlap? can any be merged? apply merge-over-split.
5. Output the final refined list.

## Hard Constraints
- Produce between 1 and 8 functional areas (inclusive). Never fewer than 1, never more than 8.
- Areas must be mutually exclusive — no file's responsibility belongs to two areas.
- Prefer merging similar areas over splitting into fine-grained ones (merge-over-split principle).
- Do NOT create an area that maps 1:1 to a single top-level directory — areas must reflect semantic responsibilities.
- Do NOT include test, docs, vendor, or example directories as standalone areas unless they contain essential domain logic.

## Semantic Naming Rules
- Use PascalCase for functional area names (e.g., "GraphStorage", "SemanticAnalysis", "DataIngestion").
- Each name should convey responsibility, not technology (prefer "Authentication" over "JWT").
- Avoid generic filler names: do NOT use "Core", "Misc", "Common", "General", "Utilities", "Other".

## Boundary Rules
- A functional area represents a cohesive set of responsibilities (e.g., "DataProcessing", "UserInterface", "Authentication").
- If two candidate areas always depend on each other and have no independent consumers, merge them.
- Infrastructure/cross-cutting concerns (logging, config, error handling) may form one shared area if they are substantial.

## Output Format
Think step-by-step inside a <think>...</think> block, then provide your final answer inside a <solution>...</solution> block containing valid JSON.

The JSON must have a "functionalAreas" key with an array of PascalCase strings.

Example:
<solution>
{"functionalAreas": ["DataProcessing", "UserInterface", "Authentication", "Configuration"]}
</solution>`

  const repoContext = buildRepoContext(repoName, repoInfo, skeleton)

  const user = `${repoContext}Analyze the following repository file features and identify the high-level functional areas.

## Repository File Features (grouped by top-level directory)

${formattedGroups}

Identify the functional areas of this repository. Remember: 1-8 areas, no overlap, merge-over-split.`

  return { system, user }
}

export function buildHierarchicalConstructionPrompt(
  functionalAreas: string[],
  fileGroups: FileFeatureGroup[],
  repoName?: string,
  repoInfo?: string,
): {
  system: string
  user: string
} {
  const formattedGroups = formatFileGroups(fileGroups)
  const areasStr = functionalAreas.map(a => `- ${a}`).join('\n')

  const system = `You are an expert repository refactoring specialist.
Your goal is to reorganize file groups into a semantic 3-level hierarchy using the discovered functional areas.

## Hard Requirements
- Exhaustive coverage: every non-excluded group must be assigned to exactly one path. No group may be left unassigned.
- No duplicates: each group label appears in exactly one path's array.
- Meaningful assignments: groups assigned to the same path must share a coherent, specific semantic purpose.
- Exactly 3 levels: every path must have the form <FunctionalArea>/<category>/<subcategory> — no more, no fewer slashes.
- Use only the functional areas provided. Do not invent new top-level areas.

## Scope Constraints
- Exclude from assignment: docs, examples, demos, benchmarks, vendor, and test-only directories — unless they contain essential domain logic.
- All other groups must be assigned.

## Semantic Naming Rules
- FunctionalArea: PascalCase, from the provided list (e.g., "DataProcessing").
- category: lowercase, verb+object or noun phrase (e.g., "pipeline orchestration", "schema definition").
- subcategory: lowercase, more specific verb+object or noun phrase (e.g., "task scheduling", "type validation").
- Names must describe responsibility, not echo directory names.
- NEVER use filler labels: "misc", "others", "core", "general", "utilities", "common", "other", "main".

## Assignment Principles (functional coherence signals)
- Assign groups together when they: share the same data structures, are always imported together, implement the same user-facing feature, or form a single pipeline stage.
- Split groups into different paths when they: serve different consumers, operate at different abstraction levels, or have no meaningful dependency between them.
- Prefer fewer, denser paths over many shallow single-item paths — but never force unrelated groups together.

## Output Format
Return a JSON object with an "assignments" key mapping 3-level paths to arrays of group labels.

Example:
{"assignments": {
  "DataProcessing/pipeline orchestration/task scheduling": ["data_loader", "scheduler"],
  "DataProcessing/data transformation/format conversion": ["converter"],
  "UserInterface/component rendering/layout management": ["ui", "layout"]
}}`

  const repoContext = buildRepoContext(repoName, repoInfo)

  const user = `${repoContext}Reorganize the following file groups into a 3-level semantic hierarchy.

## Discovered Functional Areas
${areasStr}

## File Groups (grouped by top-level directory)

${formattedGroups}

Assign each non-excluded group to a 3-level path (<FunctionalArea>/<category>/<subcategory>). Ensure every group is covered exactly once.`

  return { system, user }
}

export function buildGenerateRepoInfoPrompt(
  repoName: string,
  skeleton: string,
  readmeContent: string,
): {
  system: string
  user: string
} {
  const system = `You are a senior software engineer tasked with producing a concise, accurate overview of a software repository.

## Goals
Analyze the repository name, directory skeleton, and README to extract:
1. Project purpose — what problem does it solve and for whom?
2. Core functionalities — the 3-6 most important capabilities.
3. Architectural composition — major layers, subsystems, or packages and how they relate.
4. Key technologies — languages, frameworks, databases, and significant libraries.
5. Typical usage — how a developer or end-user interacts with the system (CLI, API, library, etc.).
6. Notable dependencies or integration points with external systems.

## Output Format
Think step-by-step inside a <think>...</think> block, then write a clear, dense prose summary inside a <solution>...</solution> block.
The solution block should be 100-300 words. Use plain prose — no bullet lists, no headers. Write in the present tense.`

  const user = `Produce a repository overview for the following project.

## Repository Name
${repoName}

## Directory Skeleton
\`\`\`
${skeleton}
\`\`\`

## README
${readmeContent || '(no README found)'}

Summarize the repository purpose, architecture, and key capabilities.`

  return { system, user }
}

export function buildExcludeFilesPrompt(
  repoName: string,
  repoInfo: string,
  skeleton: string,
  fileList: string,
): {
  system: string
  user: string
} {
  const system = `You are a repository analyst deciding which files to exclude from semantic analysis.

## Conservative Exclusion Policy
Err on the side of keeping files. Only exclude a file if the exclusion is obvious and unambiguous.

## Exclude ONLY these categories
- Documentation files (*.md, *.rst, *.txt that are purely documentation)
- Benchmark scripts and performance measurement code
- Example and demo files (files under examples/, demos/, samples/ directories)
- Vendor / third-party code bundled in the repository

## Never Exclude
- Source files that implement any part of the project's own logic
- Configuration files used at runtime or build time
- Test files (even if you would not analyze them semantically)
- Generated files that are checked in and used (e.g., generated parsers, protobuf outputs)

## Output Format
Return a newline-separated list of file paths to exclude. If no files should be excluded, return an empty response.
Do not include explanations — just paths, one per line.`

  const user = `Decide which files to exclude from semantic analysis for the following repository.

## Repository: ${repoName}
${repoInfo}

## Directory Skeleton
\`\`\`
${skeleton}
\`\`\`

## File List
${fileList}

List the files that should be excluded (documentation, benchmarks, examples, demos). Be conservative — only exclude what is clearly non-essential.`

  return { system, user }
}

export function buildAnalyzeDataFlowPrompt(
  repoName: string,
  repoInfo: string,
  skeleton: string,
  treesNames: string[],
  treesInfo: string,
  summaryInvokes: string,
  crossCode: string,
): {
  system: string
  user: string
} {
  const treesNamesStr = treesNames.map(n => `- ${n}`).join('\n')

  const system = `You are an expert software architect analyzing data flow between high-level subsystems of a repository.

## Task
Identify the meaningful data-flow edges between the provided functional subtrees. Each edge represents a real data dependency: one subsystem produces data that another subsystem consumes or transforms.

## Validity Constraints
- Source and target must both be subtree names from the provided list. Do not invent new names.
- Every subtree must appear in at least one edge (full connectivity).
- The resulting graph must be a DAG: no cycles, no self-loops (source must not equal target).
- Only include edges that are evidenced by actual import/call relationships or explicit data passing in the cross-boundary code.
- Do not add speculative or architectural edges that are not supported by the code.

## Edge Fields
- source: name of the producing subtree
- target: name of the consuming subtree
- data_id: short identifier for the data artifact (snake_case, e.g., "parsed_ast", "embedding_vector")
- data_type: the type or schema of the data (e.g., "ASTNode[]", "float[]", "RPGNode", "string")
- transformation: one-sentence description of what happens to the data as it moves from source to target

## Output Format
Return a JSON array of edge objects. Example:
[
  {
    "source": "ASTParser",
    "target": "SemanticLifter",
    "data_id": "parsed_ast",
    "data_type": "ASTNode[]",
    "transformation": "Raw syntax trees are converted into semantic feature descriptions by the LLM lifter."
  }
]`

  const user = `Analyze the data flow between subsystems in the following repository.

## Repository: ${repoName}
${repoInfo}

## Directory Skeleton
\`\`\`
${skeleton}
\`\`\`

## Subtrees (valid source/target names)
${treesNamesStr}

## Subtree Summaries
${treesInfo}

## Call / Invocation Summary
${summaryInvokes}

## Cross-Boundary Code Excerpts
${crossCode}

Identify the data-flow edges between subtrees. Return a JSON array of edge objects. Ensure: only valid subtree names, no cycles, no self-loops, full connectivity.`

  return { system, user }
}

export function buildBatchClassPrompt(
  repoName: string,
  repoInfo: string,
  classesCode: string,
): {
  system: string
  user: string
} {
  const system = `You are a code analyst extracting semantic feature descriptions from class definitions.

## Task
Analyze every class in the provided source code and produce a structured feature description for each class and each of its methods.

## Exhaustive Coverage
- Include every class present in the input.
- For each class, include every method: constructors, destructors, getters, setters, lifecycle hooks (e.g., ngOnInit, componentDidMount), static methods, and private helpers.
- Do not skip any class or method, no matter how small.

## Feature Naming Rules (applies to both class-level and method-level features)
- Use verb+object format in lowercase (e.g., "parse abstract syntax tree", "validate schema constraints").
- Each feature string must be 3-8 words.
- Avoid vague verbs: do NOT use "handle", "manage", "process", "do", "perform", "work with".
- Use precise, domain-specific verbs: "parse", "encode", "emit", "traverse", "resolve", "index", "cache", "validate", "serialize", "transform", "query", "schedule", "authenticate", etc.
- A feature string must describe observable behavior, not implementation detail.

## Output Format
Return a single JSON object where:
- Each key is the exact class name as it appears in the source.
- Each value is either:
  - An object mapping method names (as they appear in source) to arrays of feature strings — use this when the class has methods.
  - An array of feature strings — use this for classes with no methods (data-only / type definitions).

Example:
{
  "GraphEncoder": {
    "constructor": ["initialize graph store with configuration"],
    "encode": ["traverse repository files recursively", "extract semantic features per node"],
    "getNode": ["retrieve node by identifier from store"]
  },
  "EdgeSchema": ["define directed edge structure between graph nodes"]
}`

  const user = `Extract semantic features for all classes in the following source code.

## Repository Context
Repository: ${repoName}
${repoInfo}

## Source Code
\`\`\`
${classesCode}
\`\`\`

Analyze every class and every method. Return a single JSON object mapping class names to their feature descriptions.`

  return { system, user }
}

export function buildBatchFunctionPrompt(
  repoName: string,
  repoInfo: string,
  functionsCode: string,
): {
  system: string
  user: string
} {
  const system = `You are a code analyst extracting semantic feature descriptions from standalone function definitions.

## Task
Analyze every standalone function in the provided source code and produce a list of semantic feature strings for each function.

## Exhaustive Coverage
- Include every standalone function present in the input (not methods inside classes — those are handled separately).
- Do not skip any function, no matter how short or utility-like.

## Feature Naming Rules
- Use verb+object format in lowercase (e.g., "compute cosine similarity between vectors", "format file path as posix").
- Each feature string must be 3-8 words.
- Avoid vague verbs: do NOT use "handle", "manage", "process", "do", "perform", "work with".
- Use precise, domain-specific verbs: "parse", "encode", "emit", "traverse", "resolve", "index", "cache", "validate", "serialize", "transform", "query", "schedule", "compute", "format", "normalize", etc.
- A feature string must describe observable behavior, not implementation detail.
- Provide 1-3 feature strings per function: 1 for trivial utilities, up to 3 for complex multi-step functions.

## Output Format
Return a single JSON object where:
- Each key is the exact function name as it appears in the source.
- Each value is an array of 1-3 feature strings.

Example:
{
  "buildDomainDiscoveryPrompt": [
    "construct LLM prompt for functional area discovery",
    "format file feature groups into structured text"
  ],
  "formatFileGroups": ["format file feature groups into readable text"],
  "computeCosineSimilarity": ["compute cosine similarity between two embedding vectors"]
}`

  const user = `Extract semantic features for all standalone functions in the following source code.

## Repository Context
Repository: ${repoName}
${repoInfo}

## Source Code
\`\`\`
${functionsCode}
\`\`\`

Analyze every standalone function (not class methods). Return a single JSON object mapping function names to arrays of feature strings.`

  return { system, user }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function buildRepoContext(repoName?: string, repoInfo?: string, skeleton?: string): string {
  const parts: string[] = []

  if (repoName || repoInfo) {
    parts.push('## Repository Context')
    if (repoName)
      parts.push(`Repository: ${repoName}`)
    if (repoInfo)
      parts.push(repoInfo)
    parts.push('')
  }

  if (skeleton) {
    parts.push('## Directory Skeleton')
    parts.push('```')
    parts.push(skeleton)
    parts.push('```')
    parts.push('')
  }

  return parts.length > 0 ? `${parts.join('\n')}\n` : ''
}
