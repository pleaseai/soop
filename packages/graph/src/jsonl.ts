import type { PythonEdge, PythonNode, PythonRPG } from './python-format'
import { PythonEdgeSchema, PythonNodeSchema, PythonRPGSchema } from './python-format'

/**
 * Line type discriminators for graph JSONL format.
 */
interface HeaderLine {
  type: 'header'
  repo_name: string
  repo_info: string
  excluded_files: string[]
  repo_node_id: string | null
  _dep_to_rpg_map: Record<string, string[]>
  dep_graph: unknown
}

type NodeLine = { type: 'node' } & PythonNode
type EdgeLine = { type: 'edge' } & PythonEdge

/**
 * Serialize a PythonRPG object to JSONL format.
 *
 * Line 1: header (metadata without arrays)
 * Lines 2..N: nodes sorted by id
 * Lines N+1..M: edges sorted by (src, dst, relation)
 * Lines M+1..K: data_flow sorted by (source, target, dataId)
 */
export function serializeGraphJsonl(data: PythonRPG): string {
  const { nodes, edges, data_flow, ...rest } = data

  const header: HeaderLine = { type: 'header', ...rest }
  const lines: string[] = [JSON.stringify(header)]

  const sortedNodes = nodes.toSorted((a: PythonNode, b: PythonNode) => a.id.localeCompare(b.id))
  for (const node of sortedNodes) {
    lines.push(JSON.stringify({ type: 'node', ...node } satisfies NodeLine))
  }

  const sortedEdges = edges.toSorted((a: PythonEdge, b: PythonEdge) =>
    a.src.localeCompare(b.src)
    || a.dst.localeCompare(b.dst)
    || a.relation.localeCompare(b.relation))
  for (const edge of sortedEdges) {
    lines.push(JSON.stringify({ type: 'edge', ...edge } satisfies EdgeLine))
  }

  const sortedDataFlow = data_flow.toSorted((a: any, b: any) =>
    String(a?.source ?? '').localeCompare(String(b?.source ?? ''))
    || String(a?.target ?? '').localeCompare(String(b?.target ?? ''))
    || String(a?.dataId ?? '').localeCompare(String(b?.dataId ?? '')))
  for (const df of sortedDataFlow) {
    lines.push(JSON.stringify({ type: 'data_flow', ...(df as Record<string, unknown>) }))
  }

  return lines.join('\n')
}

/**
 * Parse a JSONL string into a validated PythonRPG object.
 *
 * Expects line 1 as header and remaining lines as typed records.
 */
export function parseGraphJsonl(jsonl: string): PythonRPG {
  const lines = jsonl.split('\n').filter(line => line.trim().length > 0)
  if (lines.length === 0) {
    throw new Error('Empty JSONL content')
  }

  const firstLine = JSON.parse(lines[0]!)
  if (firstLine.type !== 'header') {
    throw new Error(`Expected header line, got type: ${firstLine.type}`)
  }

  const { type: _type, ...headerRest } = firstLine as HeaderLine
  const nodes: PythonNode[] = []
  const edges: PythonEdge[] = []
  const dataFlow: unknown[] = []

  for (let i = 1; i < lines.length; i++) {
    const record = JSON.parse(lines[i]!)
    const { type, ...rest } = record

    switch (type) {
      case 'node':
        nodes.push(PythonNodeSchema.parse(rest))
        break
      case 'edge':
        edges.push(PythonEdgeSchema.parse(rest))
        break
      case 'data_flow':
        dataFlow.push(rest)
        break
      default:
        throw new Error(`Unknown record type on line ${i + 1}: ${type}`)
    }
  }

  return PythonRPGSchema.parse({
    ...headerRest,
    nodes,
    edges,
    data_flow: dataFlow,
  })
}
